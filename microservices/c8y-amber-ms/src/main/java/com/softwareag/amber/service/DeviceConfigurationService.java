package com.softwareag.amber.service;

import com.cumulocity.microservice.context.ContextService;
import com.cumulocity.microservice.context.credentials.MicroserviceCredentials;
import com.cumulocity.model.JSONBase;
import com.cumulocity.model.idtype.GId;
import com.cumulocity.model.measurement.MeasurementValue;
import com.cumulocity.rest.representation.event.EventRepresentation;
import com.cumulocity.rest.representation.inventory.ManagedObjectRepresentation;
import com.cumulocity.rest.representation.measurement.MeasurementRepresentation;
import com.cumulocity.sdk.client.PlatformImpl;
import com.cumulocity.sdk.client.SDKException;
import com.cumulocity.sdk.client.event.EventApi;
import com.cumulocity.sdk.client.inventory.InventoryApi;
import com.cumulocity.sdk.client.inventory.InventoryFilter;
import com.cumulocity.sdk.client.inventory.ManagedObjectCollection;
import com.cumulocity.sdk.client.measurement.MeasurementApi;
import com.cumulocity.sdk.client.notification.Subscription;
import com.cumulocity.sdk.client.notification.SubscriptionListener;
import com.softwareag.amber.model.AmberSensor;
import com.softwareag.amber.model.AmberStreamData;
import com.softwareag.amber.model.CumulocityDataPoint;
import com.softwareag.amber.model.ServiceDataStream;
import com.softwareag.amber.notification.MeasurementNotification;
import com.softwareag.amber.notification.MeasurementRealtimeNotificationSubscriber;
import lombok.extern.slf4j.Slf4j;
import org.joda.time.DateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpServerErrorException;
import org.svenson.AbstractDynamicProperties;
import org.svenson.JSON;
import org.svenson.JSONParser;

import java.math.BigDecimal;
import java.util.*;

@Slf4j
@Service
public class DeviceConfigurationService {
    private static final int TWELVE_HOURS_IN_MILLISECONDS = 1000 * 60 * 60 * 12;

    private final InventoryApi inventoryApi;

    private final MeasurementApi measurementApi;

    private final EventApi eventApi;

    private final AmberService amberService;

    private final ContextService<MicroserviceCredentials> contextService;

    private final MeasurementRealtimeNotificationSubscriber subscriber;

    private final JSONParser jsonParser = JSONBase.getJSONParser();

    private final JSON json = JSON.defaultJSON();

    private final Map<String, AmberSensor> sensors = new HashMap<>();

    private final Map<String, AmberStreamData> sensorStreamingData = new HashMap<>();

    private final Map<String, BigDecimal[]> deviceDataVectors = new HashMap<>();

    private BigDecimal[] dataVector ;

    private final Map<String, BigDecimal[]> excessDataVector = new HashMap<>();

    private Map<String, Integer> dataVectorCounter = new HashMap<>();

    private Map<String, Integer> excessDataVectorCounter = new HashMap<>();

    private final Map<String, Subscription<String>> measurementSubscriptions = new HashMap<>();

    private MicroserviceCredentials credentials;

    @Autowired
    public DeviceConfigurationService(PlatformImpl platform, InventoryApi inventoryApi, MeasurementApi measurementApi,
                                      EventApi eventApi, AmberService amberService, ContextService<MicroserviceCredentials> contextService) {
        this.inventoryApi = inventoryApi;
        this.measurementApi = measurementApi;
        this.eventApi = eventApi;
        this.amberService = amberService;
        this.contextService = contextService;
        subscriber = new MeasurementRealtimeNotificationSubscriber(platform);
    }

    public void init(final MicroserviceCredentials credentials) {
        this.credentials = credentials;
        initDeviceConfigurations();
        initMeasurementSubscriptions();
    }

    public void initDeviceConfigurations() {
        try {
            final ManagedObjectCollection managedObjectCollection = inventoryApi.getManagedObjectsByFilter(new InventoryFilter().byFragmentType(AmberSensor.class));
            final List<ManagedObjectRepresentation> devices = managedObjectCollection.get(2000).getManagedObjects();

            devices.forEach((device) -> {
                final AmberSensor sensor = jsonParser.parse(AmberSensor.class, json.forValue(device.get("c8y_AmberSensorConfiguration")));
                final AmberStreamData sensorStreamData = jsonParser.parse(AmberStreamData.class, json.forValue(device.get("c8y_AmberSensorStatus")));

                sensors.put(device.getId().getValue(), sensor);
                sensorStreamingData.put(device.getId().getValue(), sensorStreamData);
            });

            log.info("devices configured: {}", sensors.toString());
        } catch (SDKException exception) {
            log.error("Failed to initialize device configuration", exception);
        }
    }

    public void initMeasurementSubscriptions() {
        if (!amberService.isConnected()) {
            log.info("[initMeasurementSubscriptions] not connected to Amber");
            return;
        }

        for (Map.Entry<String, AmberSensor> entry : sensors.entrySet()) {
            final AmberSensor sensor = entry.getValue();
            final String deviceId = entry.getKey();

            if (sensor.isStreaming()) {
                preparetoRegisterForMeasurementNotifications(deviceId);
            }
        }
    }

    public Optional<AmberSensor> getSensorInformation(final String deviceId) {
        if (!sensors.containsKey(deviceId)) {
            return Optional.empty();
        }

        return Optional.of(sensors.get(deviceId));
    }

    public void deleteSensorFromAmber(final String deviceId) {
        if (!sensors.containsKey(deviceId)) {
            throw new HttpServerErrorException(HttpStatus.NOT_FOUND);
        }

        final AmberSensor sensor = sensors.get(deviceId);
        amberService.deleteSensor(sensor.getSensorId());
        cancelMeasurementSubscription(deviceId);
        updateCumulocityDeviceRepresentationAndRemoveConfiguration(deviceId);
        sensors.remove(deviceId);
    }

    public void updateDeviceWithAmberSensorConfiguration(final String deviceId, final AmberSensor amberSensor) {
        updateCumulocityDeviceRepresentationWithConfiguration(deviceId, amberSensor, true);
        sensors.put(deviceId, amberSensor);
        sensorStreamingData.remove(deviceId);
        updateMeasurementNotificationSubscription(deviceId);
    }

    public void toggleDeviceStreamingState(final String deviceId, final boolean isStreaming) {
        if (!sensors.containsKey(deviceId)) {
            log.error("[toggleDeviceStreamingState]: Device not found for id: ", deviceId);
            throw new HttpServerErrorException(HttpStatus.NOT_FOUND, "No Amber sensor found for device: " + deviceId);
        }

        if (isStreaming) {
            preparetoRegisterForMeasurementNotifications(deviceId);
        } else {
            cancelMeasurementSubscription(deviceId);
        }

        final AmberSensor sensor = sensors.get(deviceId);
        sensor.setStreaming(isStreaming);
        updateCumulocityDeviceRepresentationWithConfiguration(deviceId, sensor, false);
    }

    public void cancelMeasurementSubscriptions() {
        final Set<String> deviceIdsWithSubscriptions = Set.copyOf(measurementSubscriptions.keySet());
        for (String deviceId : deviceIdsWithSubscriptions) {
            cancelMeasurementSubscription(deviceId);
        }
    }

    public void cancelMeasurementSubscription(final String deviceId) {
        if (!measurementSubscriptions.containsKey(deviceId)) {
            return;
        }

        final Subscription<String> measurementSubscription = measurementSubscriptions.get(deviceId);
        measurementSubscription.unsubscribe();

        measurementSubscriptions.remove(deviceId);
    }

    public void updateMeasurementNotificationSubscription(final String deviceId) {
        final AmberSensor sensor = sensors.get(deviceId);
        final String[] childDeviceList = sensor.getChildDevices();
        // cancel and remove subscription first and subscribe again for measurement notifications
        if (measurementSubscriptions.containsKey(deviceId)) {
            final Subscription<String> measurementSubscription = measurementSubscriptions.get(deviceId);
            measurementSubscription.unsubscribe();
            measurementSubscriptions.remove(deviceId);
        }
        for (String childDeviceId : childDeviceList) {
            if (measurementSubscriptions.containsKey(childDeviceId)) {
                final Subscription<String> measurementSubscription = measurementSubscriptions.get(childDeviceId);
                measurementSubscription.unsubscribe();
                measurementSubscriptions.remove(childDeviceId);
            }
        }
        preparetoRegisterForMeasurementNotifications(deviceId);
       
        
    }

    public void preparetoRegisterForMeasurementNotifications(final String deviceId) {
        final AmberSensor sensor = sensors.get(deviceId);
        final String[] childDeviceList = sensor.getChildDevices();
        final CumulocityDataPoint[] dataPointsAll = sensor.getDataPoints();
        deviceDataVectors.put(deviceId, new BigDecimal[dataPointsAll.length]);
        dataVectorCounter.put(deviceId,0);
        excessDataVectorCounter.put(deviceId,0);
        excessDataVector.put(deviceId,new BigDecimal[dataPointsAll.length * 5]);
        dataVector = deviceDataVectors.get(deviceId);
        int counter = 0;
        if(childDeviceList != null) {
            log.info("childDeviceList Length: "+ childDeviceList.length);
            for (String childDeviceId : childDeviceList) {
                counter = 0;
                for (CumulocityDataPoint dataPoints2 : dataPointsAll) {
                        if(dataPoints2.getDeviceId() != null && dataPoints2.getDeviceId().equals(childDeviceId)) { 
                            counter ++; 
                        }
                }
                CumulocityDataPoint[] dataPoints = new CumulocityDataPoint[counter];
                log.info("Child device dataPoints length: "+ dataPoints.length);
                counter = 0;
                for (CumulocityDataPoint dataPoints2 : dataPointsAll) {
                        if(dataPoints2.getDeviceId() != null && dataPoints2.getDeviceId().equals(childDeviceId)){
                            dataPoints[counter] = dataPoints2;
                            counter ++;
                        }
                }
                log.info("childDevice Id: "+ childDeviceId);
                registerForMeasurementNotifications(deviceId, childDeviceId, dataPoints);
            }

            int deviceCounter = 0;
            for (CumulocityDataPoint dataPoints2 : dataPointsAll) {
                    if(dataPoints2.getDeviceId() != null && dataPoints2.getDeviceId().equals(deviceId)) { deviceCounter ++; }
            }
            log.info("main device counter length: "+ deviceCounter);
            CumulocityDataPoint[] dataPoints = new CumulocityDataPoint[deviceCounter];
            deviceCounter = 0;
            for (CumulocityDataPoint dataPoints2 : dataPointsAll) {
              //  log.info("dataPoints2.getDeviceId(): "+ dataPoints2.getDeviceId());
                if(dataPoints2.getDeviceId() != null && dataPoints2.getDeviceId().equals(deviceId))  {
                    dataPoints[deviceCounter] = dataPoints2;
                    deviceCounter ++;
                //    log.info("deviceCounter: "+ deviceCounter);
                }
            }
            log.info("Device Id: "+ deviceId);
            log.info("deviceCounter: "+ deviceCounter);
            log.info("main device data points length: "+ dataPoints.length);
            registerForMeasurementNotifications(deviceId, deviceId, dataPoints);
        } else {

            log.info("Child Device not found. loading default");
            registerForMeasurementNotifications(deviceId, deviceId, dataPointsAll);
        }
    }
    private void registerForMeasurementNotifications(final String deviceId,  String currentDeviceId, CumulocityDataPoint[] dataPoints) {
     
        final AmberSensor sensor = sensors.get(deviceId);
        final CumulocityDataPoint[] dataPointsAll = sensor.getDataPoints();
     
    //    log.info("current device id: "+ currentDeviceId);
    //    log.info("getting datapoint for device: "+ dataPoints.length);
    //    log.info("getting datapoint for device: {}", dataPoints.toString());
        
        final Subscription<String> measurementSubscription = subscriber.subscribe(currentDeviceId, new SubscriptionListener<>() {
            @Override
            public void onNotification(Subscription<String> arg0, MeasurementNotification notification) {
                contextService.runWithinContext(credentials, () -> {
                   
                  final MeasurementRepresentation measurement = jsonParser.parse(MeasurementRepresentation.class, json.forValue(notification.getData()));

                    // TODO filter measurement based on type
//                boolean isMeasurementRelevant = false;
//                for (CumulocityDataPoint datapoint : dataPoints) {
//                    if (measurement.getType().equals(datapoint.getType())) {
//                        isMeasurementRelevant = true;
//                    }
//                }
//
//                if (!isMeasurementRelevant) {
//                    return;
//                }

                  dataVector = deviceDataVectors.get(deviceId);
                  dataVector = writeMeasurementToDataVector(measurement, dataPoints, dataVector, deviceId);
                  deviceDataVectors.put(deviceId, dataVector);
                  int dataCounter = dataVectorCounter.get(deviceId);
                  log.info("Post data loading: dataVector Counter: "+ dataCounter);
                  if (!isDataVectorValid(deviceDataVectors.get(deviceId))) {
                        return;
                  }
                  final AmberStreamData amberStreamDataResponse = sendDataVectorToAmber(sensor.getSensorId(), deviceDataVectors.get(deviceId));
                  amberStreamDataResponse.setSampleCount(increaseSampleCount(sensorStreamingData.get(deviceId)));
                  // reset data vector
                  deviceDataVectors.put(deviceId, new BigDecimal[dataPointsAll.length]);
                  if(dataCounter >= dataPointsAll.length) {
                        dataVector =  deviceDataVectors.get(deviceId);
                        dataVectorCounter.put(deviceId,0);
                        log.info("dataVector Counter after reset: "+ dataVectorCounter);
                  }
                  log.info("amber stream data response" + amberStreamDataResponse.getState());
                  updateCumulocityDeviceWithAmberStatus(deviceId, amberStreamDataResponse);
                  final Optional<Map<String, Object>> rootCauseMeasurementFragments = createRootCauseMeasurement(deviceId,
                            amberStreamDataResponse, sensor);
                  createAmberStreamDataStatusMeasurement(deviceId, amberStreamDataResponse, rootCauseMeasurementFragments);

                  // only create Amber state event if the state has been changed
                  if (!sensorStreamingData.containsKey(deviceId)
                            || isAmberSensorStateChanged(sensorStreamingData.get(deviceId), amberStreamDataResponse)
                            || isMonitoringEventAndTimeForLastMonitoringEventElapsed(amberStreamDataResponse, sensor)) {
                        createAmberStateEvent(deviceId, amberStreamDataResponse);
                        // getting first mesurement to configure RCA widget while  stage change to learning
                        if (amberStreamDataResponse != null && StringUtils.hasText(amberStreamDataResponse.getState())) {
                                if(amberStreamDataResponse.getState().equals("Learning")){
                                    final int clusterId = amberStreamDataResponse.getID()[0];
                                    final double[] rootCause = amberService.getRootCause(sensor.getSensorId(), clusterId);
                                    final Optional<Map<String, Object>> emptyRootCauseMeasurementFragments = createRootCauseMeasurementFragments(deviceId,
                                    rootCause, sensor.getDataPoints());
                                    createAmberStreamDataStatusMeasurement(deviceId, amberStreamDataResponse, emptyRootCauseMeasurementFragments);
                                }
                        }
                  }
                  sensorStreamingData.put(deviceId, amberStreamDataResponse);
                });
            }

            @Override
            public void onError(Subscription<String> arg0, Throwable arg1) {
                log.error("An error occurred for the measurement subscription", arg1);
            }
        });

        measurementSubscriptions.put(currentDeviceId, measurementSubscription);
    }

    private AmberStreamData sendDataVectorToAmber(final String amberSensorId, final BigDecimal[] dataVector) {
        final String dataVectorPayload = Arrays.toString(dataVector).replace("[", "").replace("]", "").replace(" ", "");
        return amberService.streamData(amberSensorId, new ServiceDataStream(dataVectorPayload));
    }

    private void updateCumulocityDeviceWithAmberStatus(final String deviceId, final AmberStreamData streamData) {
        contextService.runWithinContext(credentials, () -> {
            final ManagedObjectRepresentation managedObjectRepresentation = new ManagedObjectRepresentation();
            managedObjectRepresentation.setId(new GId(deviceId));
            managedObjectRepresentation.set(streamData);

            try {
                inventoryApi.update(managedObjectRepresentation);
            } catch (SDKException exception) {
                log.error("failed to update Amber sensor status", exception);
            }
        });
    }

    private Optional<Map<String, Object>> createRootCauseMeasurement(final String deviceId, final AmberStreamData streamData,
                                                                     final AmberSensor sensor) {
        if (StringUtils.isEmpty(deviceId) || streamData == null || sensor == null) {
            log.error("Parameters must not be null");
            return Optional.empty();
        }

        // only query root cause and create rootCause measurement if an anomaly is detected
        if (streamData.getAD() == null || streamData.getAD().length == 0 || streamData.getAD()[0] == 0) {
            return Optional.empty();
        }

        if (streamData.getID() == null || streamData.getID().length == 0) {
            return Optional.empty();
        }

        final int clusterId = streamData.getID()[0];
        final double[] rootCause = amberService.getRootCause(sensor.getSensorId(), clusterId);

        if (rootCause == null || rootCause.length == 0) {
            return Optional.empty();
        }

        final Optional<Map<String, Object>> rootCauseMeasurementFragments = createRootCauseMeasurementFragments(deviceId,
                rootCause, sensor.getDataPoints());
        return rootCauseMeasurementFragments;
    }

    private void createAmberStreamDataStatusMeasurement(final String deviceId, final AmberStreamData streamData,
                                                        final Optional<Map<String, Object>> rootCauseMeasurementFragments) {
        final ManagedObjectRepresentation managedObjectRepresentation = new ManagedObjectRepresentation();
        managedObjectRepresentation.setId(new GId(deviceId));
        final MeasurementRepresentation measurementRepresentation = new MeasurementRepresentation();
        measurementRepresentation.setSource(managedObjectRepresentation);
        measurementRepresentation.setType("c8y_AmberStatus");
        measurementRepresentation.setDateTime(DateTime.now());

        if (streamData.getID() != null && streamData.getID().length > 0
                && streamData.getSI() != null && streamData.getSI().length > 0) {
            Map<String, Object> fragment = new HashMap<>();
            fragment.put("id", new MeasurementValue(new BigDecimal(streamData.getID()[0]), ""));
            measurementRepresentation.setProperty("c8y_cluster_id", fragment);
        }

        if (streamData.getSI() != null && streamData.getSI().length > 0) {
            Map<String, Object> fragment = new HashMap<>();
            fragment.put("si", new MeasurementValue(new BigDecimal(streamData.getSI()[0]), "idx"));
            measurementRepresentation.setProperty("c8y_anomaly_index", fragment);
        }

        if (streamData.getAW() != null && streamData.getAW().length > 0) {
            Map<String, Object> fragment = new HashMap<>();
            fragment.put("aw", new MeasurementValue(new BigDecimal(streamData.getAW()[0]), "int"));
            measurementRepresentation.setProperty("c8y_aw", fragment);
        }

        if (streamData.getAD() != null && streamData.getAD().length > 0) {
            Map<String, Object> fragment = new HashMap<>();
            fragment.put("ad", new MeasurementValue(new BigDecimal(streamData.getAD()[0]), "bin"));
            measurementRepresentation.setProperty("c8y_ad", fragment);
        }

        if (streamData.getNI() != null && streamData.getNI().length > 0) {
            Map<String, Object> fragment = new HashMap<>();
            fragment.put("ni", new MeasurementValue(new BigDecimal(streamData.getNI()[0]), "int"));
            measurementRepresentation.setProperty("c8y_ni", fragment);
        }

        if (streamData.getNS() != null && streamData.getNS().length > 0) {
            Map<String, Object> fragment = new HashMap<>();
            fragment.put("ns", new MeasurementValue(new BigDecimal(streamData.getNS()[0]), "int"));
            measurementRepresentation.setProperty("c8y_ns", fragment);
        }

        if (streamData.getNW() != null && streamData.getNW().length > 0) {
            Map<String, Object> fragment = new HashMap<>();
            fragment.put("nw", new MeasurementValue(new BigDecimal(streamData.getNW()[0]), "int"));
            measurementRepresentation.setProperty("c8y_nw", fragment);
        }

        if (streamData.getOM() != null && streamData.getOM().length > 0) {
            Map<String, Object> fragment = new HashMap<>();
            fragment.put("om", new MeasurementValue(new BigDecimal(streamData.getOM()[0]), "int"));
            measurementRepresentation.setProperty("c8y_om", fragment);
        }


        if (rootCauseMeasurementFragments.isPresent()) {
            measurementRepresentation.setProperty("c8y_AmberRootCause", rootCauseMeasurementFragments.get());
        }

        Map<String, Object> sampleCountFragment = new HashMap<>();
        sampleCountFragment.put("sample_count", new MeasurementValue(new BigDecimal(streamData.getSampleCount()), ""));
        measurementRepresentation.setProperty("c8y_sample_count", sampleCountFragment);
        log.info("Amber response creating measurements" + measurementRepresentation);
        measurementApi.createWithoutResponse(measurementRepresentation);
    }

    private void createAmberStateEvent(final String deviceId, final AmberStreamData streamData) {
        if (streamData == null || StringUtils.isEmpty(streamData.getState())) {
            return;
        }

        final ManagedObjectRepresentation managedObjectRepresentation = new ManagedObjectRepresentation();
        managedObjectRepresentation.setId(new GId(deviceId));
        final EventRepresentation eventRepresentation = new EventRepresentation();
        eventRepresentation.setSource(managedObjectRepresentation);
        eventRepresentation.setDateTime(DateTime.now());
        eventRepresentation.setType("c8y_nano_state");
        eventRepresentation.setText(streamData.getState());
        eventRepresentation.setProperty("state_flow", streamData.getState());

        eventApi.createAsync(eventRepresentation);
    }

    private void updateCumulocityDeviceRepresentationWithConfiguration(final String deviceId, final AmberSensor sensor,
                                                                       final boolean isClearSensorStatus) {
        final ManagedObjectRepresentation managedObjectRepresentation = new ManagedObjectRepresentation();
        managedObjectRepresentation.setId(new GId(deviceId));
        managedObjectRepresentation.set(sensor);

        if (isClearSensorStatus) {
            // reset sensor status to default after configuration has been changed
            managedObjectRepresentation.set(null, "c8y_AmberSensorStatus");
        }

        try {
            inventoryApi.update(managedObjectRepresentation);
        } catch (SDKException exception) {
            log.error("failed to update Amber configuration", exception);
        }
    }

    private void updateCumulocityDeviceRepresentationAndRemoveConfiguration(final String deviceId) {
        final ManagedObjectRepresentation managedObjectRepresentation = new ManagedObjectRepresentation();
        managedObjectRepresentation.setId(new GId(deviceId));
        managedObjectRepresentation.set(null, "c8y_AmberSensorConfiguration");

        try {
            inventoryApi.update(managedObjectRepresentation);
        } catch (SDKException exception) {
            log.error("failed to clear Amber configuration", exception);
        }
    }

    private BigDecimal[] writeMeasurementToDataVector(final MeasurementRepresentation measurementRepresentation, final CumulocityDataPoint[] dataPoints,
                                                      final BigDecimal[] dataVector, final String deviceId) {
        if (dataPoints == null || dataPoints.length == 0) {
            log.error("No data points defined");
            return new BigDecimal[0];
        }
        BigDecimal[] excessDataVectorObj = excessDataVector.get(deviceId);
        log.info("current datapoints length: " + dataPoints.length);
        log.info("datavector length: " + dataVector.length);
        log.info("reserve datavector length: " + excessDataVectorObj.length);
        int dataCounterNum = dataVectorCounter.get(deviceId);
        int excessCounter = excessDataVectorCounter.get(deviceId);
        log.info("dataVector Counter:" + dataVectorCounter);
        log.info("Reserve DataVector Counter:" + excessDataVectorCounter);
        if(dataCounterNum < dataVector.length){
            for(int index = 0; index < excessCounter; index++) {
                dataVector[dataCounterNum + index] = excessDataVectorObj[index];
            }
            dataCounterNum = dataCounterNum + excessCounter;
            excessCounter = 0;
            excessDataVectorObj = excessDataVector.get(deviceId);
        }
        log.info("dataVectorCounter after populating from reserve:" + dataVectorCounter);
        log.info("Reserve DataVectorCounter (Leftover):" + excessDataVectorCounter);
        int dataCounter = 0;
        for (int index = 0; index < dataPoints.length; index++) {
            CumulocityDataPoint dataPoint = dataPoints[index];
            if (!measurementRepresentation.hasProperty(dataPoint.getFragment())) {
                continue;
            }

            final Map<String, Object> fragment = getMeasurementFragment(measurementRepresentation, dataPoint.getFragment());
            if (!fragment.containsKey(dataPoint.getSeries())) {
                continue;
            }

            final MeasurementValue measurementValue = jsonParser.parse(MeasurementValue.class, json.forValue(fragment.get(dataPoint.getSeries())));
            if((dataCounterNum + index) >= dataVector.length) {
                if((dataCounterNum + index) < excessDataVectorObj.length) {
                    excessDataVectorObj[excessCounter] =measurementValue.getValue();
                    excessCounter ++;
                } else {
                     log.error("Unable to add data in stack for device id: " + deviceId + "Please restart microservice");
                }
               

            } else {
                dataVector[dataCounterNum + index] = measurementValue.getValue();
                dataCounter ++;
            }         
        }
        dataCounterNum = dataCounterNum + dataCounter;
        dataVectorCounter.put(deviceId,dataCounterNum);
        excessDataVectorCounter.put(deviceId,excessCounter);
        excessDataVector.put(deviceId, excessDataVectorObj);
        return dataVector;
    }

    private boolean isDataVectorValid(final BigDecimal[] dataVector) {
        if (dataVector == null || dataVector.length == 0) {
            log.error("Data vector is not available.");
            return false;
        }

        for (BigDecimal entry : dataVector) {
            if (entry == null) {
                return false;
            }
        }

        return true;
    }

    private boolean isAmberSensorStateChanged(final AmberStreamData oldStreamData, final AmberStreamData newStreamData) {
        if (oldStreamData == null || newStreamData == null) {
            return false;
        }

        return !oldStreamData.getState().equalsIgnoreCase(newStreamData.getState());
    }

    private boolean isMonitoringEventAndTimeForLastMonitoringEventElapsed(final AmberStreamData amberStreamData,
                                                                          final AmberSensor sensor) {
        if (amberStreamData == null || sensor == null) {
            return false;
        }

        if (!amberStreamData.getState().equals("Monitoring")) {
            return false;
        }

        final DateTime currentTime = new DateTime();

        // if timestamp hasn't been set yet or if twelve hours have elapsed since the last monitoring event send
        // out a new monitoring event
        if (sensor.getTimestampOfLastMonitoringEventSent() == 0
                || (sensor.getTimestampOfLastMonitoringEventSent() <= currentTime.getMillis() - TWELVE_HOURS_IN_MILLISECONDS)) {
            sensor.setTimestampOfLastMonitoringEventSent(currentTime.getMillis());
            return true;
        }

        return false;
    }

    private int increaseSampleCount(final AmberStreamData oldStreamData) {
        // if there isn't a stream dataset available, then we can assume it's the first sample, which has been sent
        if (oldStreamData == null) {
            return 1;
        }

        return oldStreamData.getSampleCount() + 1;
    }

    private Map<String, Object> getMeasurementFragment(final MeasurementRepresentation measurementRepresentation,
                                                       final String fragmentName) {
        final Object measurementObject = measurementRepresentation.getProperty(fragmentName);
        Map<String, Object> fragment;
        if (measurementObject instanceof Map) {
            fragment = (Map<String, Object>) measurementObject;
        } else if (measurementObject instanceof AbstractDynamicProperties) {
            fragment = ((AbstractDynamicProperties) measurementObject).getAttrs();
        } else {
            throw new ClassCastException();
        }

        return fragment;
    }

    private Optional<Map<String, Object>> createRootCauseMeasurementFragments(final String deviceId, final double[] rootCause,
                                                                              final CumulocityDataPoint[] dataPoints) {
        if (rootCause == null || rootCause.length == 0) {
            return Optional.empty();
        }

        Map<String, Object> fragments = new HashMap<>();

        for (int index = 0; index < rootCause.length; index++) {
            if (index >= dataPoints.length) {
                log.error("root cause vector does not match data points");
                break;
            }

            final String datapointName = dataPoints[index].getFragment() + "-" + dataPoints[index].getSeries();
            fragments.put(datapointName, new MeasurementValue(new BigDecimal(rootCause[index]), ""));
        }

        return Optional.of(fragments);
    }
}
