package com.softwareag.amber.controller;

import com.cumulocity.microservice.context.ContextService;
import com.cumulocity.microservice.context.credentials.MicroserviceCredentials;
import com.cumulocity.microservice.subscription.model.MicroserviceSubscriptionAddedEvent;
import com.cumulocity.sdk.client.SDKException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.softwareag.amber.model.*;
import com.softwareag.amber.service.AmberService;
import com.softwareag.amber.service.CredentialsConfigurationService;
import com.softwareag.amber.service.DeviceConfigurationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpServerErrorException;

import javax.validation.Valid;
import java.util.Optional;

@Slf4j
@org.springframework.web.bind.annotation.RestController
public class RestController {

    private final AmberService amberService;

    private final CredentialsConfigurationService configurationService;

    private final DeviceConfigurationService deviceConfigurationService;

    private final ContextService<MicroserviceCredentials> contextService;

    @Autowired
    public RestController(AmberService amberService, final CredentialsConfigurationService configurationService,
                          DeviceConfigurationService deviceConfigurationService, final ContextService<MicroserviceCredentials> contextService) {
        this.amberService = amberService;
        this.configurationService = configurationService;
        this.deviceConfigurationService = deviceConfigurationService;
        this.contextService = contextService;
    }

    @EventListener(MicroserviceSubscriptionAddedEvent.class)
    private void initConfiguration(MicroserviceSubscriptionAddedEvent event) {
        contextService.runWithinContext(event.getCredentials(), () -> {
            initializeAmberConnection();
            deviceConfigurationService.init(event.getCredentials());
        });
    }

    @RequestMapping(value = "/status", produces = MediaType.APPLICATION_JSON_VALUE, method = RequestMethod.GET)
    @ResponseStatus(HttpStatus.OK)
    @ResponseBody
    public ResponseEntity<ServiceStatus> getStatus() {
        if (!amberService.isConnected()) {
            return new ResponseEntity<>(ServiceStatus.notAuthenticated(), HttpStatus.OK);
        }

        return new ResponseEntity<>(ServiceStatus.ready(), HttpStatus.OK);
    }

    @RequestMapping(value = "/sensors", produces = MediaType.APPLICATION_JSON_VALUE, method = RequestMethod.GET)
    @ResponseStatus(HttpStatus.OK)
    @ResponseBody
    public ResponseEntity<AmberSensor[]> getSensors() {
        if (!amberService.isConnected()) {
            return new ResponseEntity<>(null, HttpStatus.INTERNAL_SERVER_ERROR);
        }

        try {
            return new ResponseEntity<>(amberService.getSensors(), HttpStatus.OK);
        } catch (HttpServerErrorException exception) {
            log.error("Failed to query sensors", exception);
            return new ResponseEntity<>(exception.getStatusCode());
        }
    }

    @RequestMapping(value = "/sensors/{id}", produces = MediaType.APPLICATION_JSON_VALUE, method = RequestMethod.GET)
    @ResponseStatus(HttpStatus.OK)
    @ResponseBody
    public ResponseEntity<AmberSensor> getSensor(@PathVariable final String id) {
        if (!amberService.isConnected()) {
            return new ResponseEntity<>(null, HttpStatus.INTERNAL_SERVER_ERROR);
        }

        try {
            final Optional<AmberSensor> optionalAmberSensor = amberService.getSensor(id);
            if (optionalAmberSensor.isEmpty()) {
                return new ResponseEntity<>(null, HttpStatus.NOT_FOUND);
            }

            return new ResponseEntity<>(optionalAmberSensor.get(), HttpStatus.OK);
        } catch (HttpServerErrorException exception) {
            log.error(exception.getMessage(), exception);
            return new ResponseEntity<>(exception.getStatusCode());
        }
    }

    @RequestMapping(value = "/sensors", consumes = MediaType.APPLICATION_JSON_VALUE, method = RequestMethod.POST)
    @ResponseStatus(HttpStatus.OK)
    @ResponseBody
    public ResponseEntity<AmberSensor> createSensor(@Valid @RequestBody CumulocityDeviceConfiguration deviceConfiguration) {
        if (!amberService.isConnected()) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        try {
            final AmberSensor amberSensor = amberService.createSensor();
            final AmberSensorConfiguration amberSensorConfiguration = amberService.createSensorConfiguration(amberSensor.getSensorId(), deviceConfiguration.getConfiguration());
            amberSensor.setConfiguration(amberSensorConfiguration);
            amberSensor.setDataPoints(deviceConfiguration.getDataPoints());
            amberSensor.setStreaming(true);
            amberSensor.setChildDevices(deviceConfiguration.getChildDevices());
            deviceConfigurationService.updateDeviceWithAmberSensorConfiguration(deviceConfiguration.getId(), amberSensor);

            return new ResponseEntity<>(amberSensor, HttpStatus.CREATED);
        } catch (HttpServerErrorException exception) {
            log.error(exception.getMessage(), exception);
            return new ResponseEntity<>(exception.getStatusCode());
        }
    }

    @RequestMapping(value = "/sensors/{id}", method = RequestMethod.DELETE)
    @ResponseBody
    public ResponseEntity<Void> deleteSensor(@PathVariable final String id) {
        if (!amberService.isConnected()) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        deviceConfigurationService.deleteSensorFromAmber(id);
        return new ResponseEntity<>(HttpStatus.OK);
    }

    @RequestMapping(value = "/sensors/{id}/config", consumes = MediaType.APPLICATION_JSON_VALUE, method = RequestMethod.PUT)
    @ResponseStatus(HttpStatus.OK)
    @ResponseBody
    public ResponseEntity<Void> updateSensorConfiguration(@PathVariable final String id, @Valid @RequestBody CumulocityDeviceConfiguration sensorConfigurationRequest) {
        if (!amberService.isConnected()) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        final Optional<AmberSensor> sensorOptional = deviceConfigurationService.getSensorInformation(id);
        if (sensorOptional.isEmpty()) {
            return new ResponseEntity<>(HttpStatus.NOT_FOUND);
        }

        try {
            final AmberSensor sensor = sensorOptional.get();
            final AmberSensorConfiguration sensorConfiguration = amberService.createSensorConfiguration(sensorOptional.get().getSensorId(), sensorConfigurationRequest.getConfiguration());

            sensor.setConfiguration(sensorConfiguration);
            sensor.setDataPoints(sensorConfigurationRequest.getDataPoints());
            deviceConfigurationService.updateDeviceWithAmberSensorConfiguration(id, sensor);
            return new ResponseEntity<>(HttpStatus.OK);
        } catch (HttpServerErrorException exception) {
            log.error(exception.getMessage(), exception);
            return new ResponseEntity<>(exception.getStatusCode());
        }
    }

    @RequestMapping(value = "/sensors/{id}/config", produces = MediaType.APPLICATION_JSON_VALUE, method = RequestMethod.GET)
    @ResponseStatus(HttpStatus.OK)
    @ResponseBody
    public ResponseEntity<AmberSensorConfiguration> getSensorConfiguration(@PathVariable final String id) {
        if (!amberService.isConnected()) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        try {
            return new ResponseEntity<>(amberService.getSensorConfiguration(id), HttpStatus.OK);
        } catch (HttpServerErrorException exception) {
            log.error(exception.getMessage(), exception);
            return new ResponseEntity<>(exception.getStatusCode());
        }
    }

    @RequestMapping(value = "/sensors/{id}/status", consumes = MediaType.APPLICATION_JSON_VALUE, method = RequestMethod.PUT)
    @ResponseStatus(HttpStatus.OK)
    @ResponseBody
    public ResponseEntity<Void> updateSensorStatus(@PathVariable final String id, @Valid @RequestBody SensorStatus sensorStatus) {
        if (!amberService.isConnected()) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        try {
            deviceConfigurationService.toggleDeviceStreamingState(id, sensorStatus.isStreaming());
            return new ResponseEntity<>(HttpStatus.OK);
        } catch (HttpServerErrorException exception) {
            log.error(exception.getMessage(), exception);
            return new ResponseEntity<>(exception.getStatusCode());
        }
    }

    @RequestMapping(value = "/sensors/{id}/stream", consumes = MediaType.APPLICATION_JSON_VALUE, method = RequestMethod.POST)
    @ResponseStatus(HttpStatus.OK)
    @ResponseBody
    public ResponseEntity<AmberStreamData> streamData(@PathVariable final String id, @Valid @RequestBody ServiceDataStream serviceDataStream) {
        if (!amberService.isConnected()) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        try {
            return new ResponseEntity<>(amberService.streamData(id, serviceDataStream), HttpStatus.OK);
        } catch (HttpServerErrorException exception) {
            log.error(exception.getMessage(), exception);
            return new ResponseEntity<>(exception.getStatusCode());
        }
    }

    @RequestMapping(value = "/configure", consumes = MediaType.APPLICATION_JSON_VALUE, method = RequestMethod.POST)
    @ResponseStatus(HttpStatus.OK)
    public ResponseEntity<String> connect(@Valid @RequestBody ServiceConfiguration configurationRequest) {
        try {
            amberService.checkAuthentication(configurationRequest.getUrl(), configurationRequest.getUsername(),
                    configurationRequest.getPassword());
        } catch (HttpServerErrorException exception) {
            log.error(exception.getMessage(), exception);
            return new ResponseEntity<>(exception.getStatusCode());
        }

        try {
            amberService.initializeConnection(configurationRequest.getUrl(), configurationRequest.getUsername(),
                    configurationRequest.getPassword());
            configurationService.saveConfiguration(configurationRequest);
            deviceConfigurationService.initMeasurementSubscriptions();

            return new ResponseEntity<>(HttpStatus.OK);
        } catch (HttpServerErrorException exception) {
            log.error(exception.getMessage(), exception);
            return new ResponseEntity<>(exception.getStatusCode());
        } catch (JsonProcessingException exception) {
            log.error(exception.getMessage(), exception);
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @RequestMapping(value = "/disconnect", method = RequestMethod.POST)
    public ResponseEntity<Void> disconnectClient() {
        try {
            amberService.clearConnection();
            configurationService.deleteConfiguration();
            deviceConfigurationService.cancelMeasurementSubscriptions();

            return new ResponseEntity<>(HttpStatus.OK);
        } catch (SDKException exception) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private void initializeAmberConnection() {
        final Optional<ServiceConfiguration> optionalConfiguration = configurationService.loadConfiguration();
        if (optionalConfiguration.isEmpty()) {
            log.info("no configuration found");
            return;
        }

        try {
            amberService.initializeConnection(optionalConfiguration.get().getUrl(),
                    optionalConfiguration.get().getUsername(), optionalConfiguration.get().getPassword());
        } catch (HttpServerErrorException exception) {
            log.error("Failed to authenticate client", exception);
        }
    }
}
