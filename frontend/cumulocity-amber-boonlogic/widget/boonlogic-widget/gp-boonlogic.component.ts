/**
 * Copyright (c) 2020 Software AG, Darmstadt, Germany and/or its licensors
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Component,
  OnInit,
  TemplateRef,
  Output,
  EventEmitter,
  Input,
  DoCheck,
  isDevMode,
  ChangeDetectorRef,
  OnDestroy,
  ViewEncapsulation,
} from '@angular/core';
import { GpBoonlogicService } from './gp-boonlogic.service';
import { AlertService, TranslateService } from '@c8y/ngx-components';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { debounceTime, distinctUntilChanged, tap, switchMap, finalize, skip } from 'rxjs/operators';
import { BehaviorSubject, from, Observable, Observer } from 'rxjs';
import { Commonc8yService } from './Commonc8yservice.service';
import { Realtime } from '@c8y/ngx-components/api';
import {
  FetchClient,
  IFetchOptions,
  IFetchResponse,
  ApplicationService,
  UserService,
  IManagedObject,
  InventoryService,
  IResultList,
  IApplication,
} from '@c8y/client';
import { PageChangedEvent } from 'ngx-bootstrap/pagination/public_api';
import { Router } from '@angular/router';
import { AppStateService } from '@c8y/ngx-components';

@Component({
  selector: 'lib-gp-boonlogic',
  templateUrl: './gp-boonlogic.component.html',
  styleUrls: ['./.././../node_modules/@ng-select/ng-select/themes/default.theme.css', './gp-boonlogic.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class GpBoonlogicComponent implements OnInit, OnDestroy {
  @Input() config: any = {};
  isstreamingWindowDisable = false;
  credentials = { username: '', password: '', url: '' };
  selectedMeasurements = [];
  deviceMeasurements: any = [];
  DeRegister: any = [];
  deviceDelete: any = [];
  ReRegister: any = [];
  itemsPerPage: any;
  DeviceList: any = [];
  updateDevice: any = [];
  pagedItems: any = [];
  connectResponse: any;
  statusResponse: any;
  createResponse: any;
  configuration!: any;
  modalRef!: BsModalRef;
  deviceSearchTerm = new FormControl();
  measurementSubs: any;
  deviceSearchResults = [];
  searching = false;
  searchFailed = false;
  model: any;
  value: any;
  sel = false;
  Selecteddevice = { name: '', id: '' };
  suggestions$!: Observable<any[]>;
  measurementList = [];
  observableMeasurements$ = new BehaviorSubject<any>(this.measurementList);
  configDevice: any;
  measurementType: any;
  measurementTypeList: any = [];
  allSubscriptions: any = [];
  realtimeState = true;
  page = 1;
  totalPages: any;
  streamingWindowSize!: number;
  samplesToBuffer!: number;
  learningRateNumerator!: number;
  learningRateDenominator!: number;
  learningMaxSamples!: number;
  learningMaxClusters!: number;
  anomalyHistoryWindow!: number;
  featurecount!: number;
  displayReRegisterStyle!: any;
  displayDeRegisterStyle!: any;
  displayDeleteStyle!: any;
  displayStreamAllStyle!: any;
  displayStreamNoneStyle!: any;
  childDevices: any;
  selectedChildDevices: [];
  deviceMeasurementList:any=[];
  addDeviceForm = new FormGroup({
    devicename: new FormControl(),
    childDevices_: new FormControl(),
    devicemeasure: new FormControl(),
    streamingWindowSize: new FormControl({ value: 25, disabled: false }),
    samplesToBuffer: new FormControl(),
    learningRateNumerator: new FormControl(),
    learningRateDenominator: new FormControl(),
    learningMaxSamples: new FormControl(),
    anomalyHistoryWindow: new FormControl(),
  });

  editDeviceForm = new FormGroup({
    devicemeasure: new FormControl(),
    streamingWindowSize: new FormControl({ value: 25, disabled: false }),
    samplesToBuffer: new FormControl(),
    learningRateNumerator: new FormControl(),
    learningRateDenominator: new FormControl(),
    learningMaxSamples: new FormControl(),
    anomalyHistoryWindow: new FormControl(),
  });

  application!: any;
  allApplications!: IApplication[];
  userHasAdminRights!: boolean;
  submitted!: any;
  childDevicesLength: number = 0;
  includeChildDevice: any = false;
  measurementControl: any;
  concatenatedMeasurements: string;

  constructor(
    private microserviceBoonLogic: GpBoonlogicService,
    private router: Router,
    private fetchClient: FetchClient,
    private alertervice: AlertService,
    private modalService: BsModalService,
    private formBuilder: FormBuilder,
    private cmonSvc: Commonc8yService,
    private realtimeService: Realtime,
    private cd: ChangeDetectorRef,
    private appservice: ApplicationService,
    private userService: UserService,
    private appStateService: AppStateService
  ) { }

  async ngOnInit(): Promise<void> {
    this.itemsPerPage = this.config.pageSize;
    this.displayDeRegisterStyle = 'none';
    this.displayReRegisterStyle = 'none';
    await this.microserviceBoonLogic.verifySimulatorMicroServiceStatus();
    await this.getConnectionStatusValue();
    this.configDevice = '';
    this.suggestions$ = new Observable((observer: Observer<any>) => {
      this.cmonSvc.getAllDevices(1, this.model).then((res: { data: any }) => {
        observer.next(res.data);
      });
    });
    await this.loadSpecificFragmentDevice();
    this.pagination();
  }

  toggle(): void {
    this.realtimeState = !this.realtimeState;
    if (this.realtimeState) {
      this.handleRealtime();
    } else {
      this.clearSubscriptions();
    }
  }

  ngOnDestroy(): void {
    this.clearSubscriptions();
  }

  async refresh(): Promise<void> {
    this.clearSubscriptions();
    this.DeviceList = [];
    await this.loadSpecificFragmentDevice();
  }

  /**
   * Clear all Realtime subscriptions
   */
  private clearSubscriptions(): void {
    if (this.allSubscriptions) {
      this.allSubscriptions.forEach((s: any) => {
        this.realtimeService.unsubscribe(s.subs);
      });
    }
  }

  async handleRealtime(): Promise<void> {
    // Check that the response is a Group and not a device

    this.pagedItems.map(async (device: any) => {
      const manaogedObjectChannel = `/managedobjects/${device.id}`;
      const detailSubs = this.realtimeService.subscribe(
        manaogedObjectChannel,
        (resp: { data: { data: any } }) => {
          if (resp && resp.data) {
            const data = resp.data ? resp.data.data : {};
            this.manageRealtime({ device: data });
          }
        }
      );
      if (this.realtimeState) {
        this.allSubscriptions.push({
          id: device.id,
          subs: detailSubs,
          type: 'Realtime',
        });
      } else {
        this.realtimeService.unsubscribe(detailSubs);
      }
    });
  }

  async manageRealtime(device: any): Promise<void> {
    if (this.realtimeState) {
      const index = this.pagedItems.findIndex((element: { id: any }) => element.id === device.id);
      if(device.c8y_AmberSensorConfiguration){
      const isStreaming = String(device.c8y_AmberSensorConfiguration.isStreaming);
      const arr = {
        id: device.id,
        name: device.name,
        isStreaming,
        state: device.c8y_AmberSensorStatus?.state,
        progress: device.c8y_AmberSensorStatus?.progress,
        datapoints: device.c8y_AmberSensorConfiguration?.dataPoints,
        configuration: device.c8y_AmberSensorConfiguration?.configuration
      };
      if (index > -1) {
        this.pagedItems[index] = {
          id: device.id,
          name: device.name,
          isStreaming,
          state: device.c8y_AmberSensorStatus?.state,
          progress: device.c8y_AmberSensorStatus?.progress,
          datapoints: device.c8y_AmberSensorConfiguration?.dataPoints,
          configuration: device.c8y_AmberSensorConfiguration?.configuration
        };
      } else {
        this.pagedItems.push(arr);
      }
    }
  }
}


  openModal(template: TemplateRef<any>): void {
    this.modalRef = this.modalService.show(template);
  }

  async loadSpecificFragmentDevice(): Promise<any> {
    this.DeviceList = [];
    const response = await this.cmonSvc.getSpecificFragmentDevices(1);
    response.data.forEach((device: any) => {
      const isStreaming = String(device.c8y_AmberSensorConfiguration.isStreaming);
      const arr = {
        id: device.id,
        name: device.name,
        isStreaming,
        state: device.c8y_AmberSensorStatus?.state,
        progress: device.c8y_AmberSensorStatus?.progress,
        datapoints: device.c8y_AmberSensorConfiguration?.dataPoints,
        configuration: device.c8y_AmberSensorConfiguration?.configuration
      };
      this.DeviceList.push(arr);
    });
    this.pagination();
    this.handleRealtime();

    return this.DeviceList;
  }
  /**
   * This method will called during page navigation
   */
  pageChanged(event: PageChangedEvent): void {
    const startItem = (event.page - 1) * event.itemsPerPage;
    const endItem = event.page * event.itemsPerPage;
    this.pagedItems = this.DeviceList.slice(startItem, endItem); // Retrieve items for page
    this.cd.detectChanges();
  }

  pagination(): void {
    if (this.DeviceList && this.DeviceList.length > 0) {
      const startItem = (this.page - 1) * this.itemsPerPage;
      const endItem = this.page * this.itemsPerPage;
      this.pagedItems = this.DeviceList.slice(startItem, endItem); // Retrieve items for page
      this.cd.detectChanges();
    }
  }

  async getConnectionStatusValue(): Promise<void> {
    const resp1 = await this.microserviceBoonLogic.getConnectionStatus();
    this.statusResponse = resp1.status;
  }

  async invokeAction(): Promise<void> {
    if (this.config.connect === '1') {
      this.microserviceBoonLogic.listUrl = 'amber-integration/configure';
      this.connectResponse = await this.microserviceBoonLogic.post({
        username: this.config.username,
        password: this.config.password,
        url: this.config.url,
      });
      this.getConnectionStatusValue();
      if (this.connectResponse.status === 200) {
        this.alertervice.success('Connection Established');
      } else {
        this.alertervice.danger('Failed to Establish connection');
      }
    } else if (this.config.connect === '0') {
      this.microserviceBoonLogic.listUrl = 'amber-integration/disconnect';
      this.connectResponse = await this.microserviceBoonLogic.post({});
      this.getConnectionStatusValue();
      if (this.connectResponse.status === 200) {
        this.alertervice.success('Successfully Disconnected');
      } else {
        this.alertervice.danger('Failed to Disconnect');
      }
    }
  }

  changeTypeaheadLoading(e: boolean): void {
    this.searching = e;
  }

  deviceSearch(): void {
    this.deviceSearchTerm.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        skip(1),
        tap(() => (this.searching = true)),
        switchMap((value: any) =>
          from(this.cmonSvc.getAllDevices(1, value)).pipe(tap(() => (this.searching = false)))
        )
      )
      .subscribe((result: any) => {
        this.deviceSearchResults = result;
      });
  }

  /**
   * Save device id and name when device is selected
   */
  async deviceSelected(device: DeviceConfig): Promise<string | -1> {
    this.childDevicesLength = 0;
    this.selectedChildDevices = [];
    if (device) {

      this.childDevices = [...device.childDevices.references];
      this.childDevicesLength = device.childDevices.references.length;
      this.Selecteddevice = { name: '', id: '' };
      this.Selecteddevice.name = device.name;
      this.Selecteddevice.id = device.id;
      this.measurementList = [];
      this.measurementTypeList = [];
      this.selectedMeasurements = [];
      this.deviceMeasurementList=[];
      // this.getcombinemeasurement(device);
      let supportedMeasurements=await this.getSupportedMeasurementsForDevice(device.id);
      let fragmentList=await this.getSupportedSeriesForDevice(device.id);
      this.deviceMeasurementList=this.getFragementList(
        [],
        fragmentList.c8y_SupportedSeries,
        supportedMeasurements.c8y_SupportedMeasurements,
        device
      );
      this.measurementTypeList=this.deviceMeasurementList;
      return device.name;
    } else {
      return -1;
    }
  }

  /**
   * This method used in configuration of this widget to populate available measurements for given device id or group id
   */

  // This method populate measurementList/fragementList based on series and measurements
  private getFragementList(
    fragementList: any,
    fragmentSeries: any,
    supportedMeasurements: any,
    device: any
  ): any {
    if (fragementList) {console.log("frangmentList inside IF:",fragementList);
      fragmentSeries.forEach((fs: string) => {
        const measurementType = supportedMeasurements.filter(
          (smFilter: string) => fs.indexOf(smFilter) !== -1
        );console.log("measurementType:",measurementType);
        if (measurementType && measurementType.length > 0) {
          const fsName = fs.replace(measurementType[0] + '.', '');
          const fsType = measurementType[0];
          const existingF = fragementList.find(
            (sm: { type: any; name: string; id: string; }) => sm.type === fsType && (sm.id === device.id && sm.name === fsName)
          );
          fs = fs + "(" + device.name + ")";
          if (!existingF || existingF == null) {
            fragementList.push({
              name: fsName,
              type: fsType,
              description: fs,
              id: device.id
            });
          }
        }
      });
    } else {console.log("frangmentList inside ELSE:",fragementList);
      fragmentSeries.forEach((fs: string) => {
        const measurementType = supportedMeasurements.filter(
          (smFilter: string) => fs.indexOf(smFilter) !== -1
        );
        if (measurementType && measurementType.length > 0) {
          const fsName = fs.replace(measurementType[0] + '.', '');
          const fsType = measurementType[0];
          fragementList.push({
            name: fsName,
            type: fsType,
            description: fs,
            id: device.id
          });
        }
      });
    }
    console.log("Returning fragmentList:",fragementList);
    return fragementList;
  }
  // Get Supported Series for given device id/
  private async getSupportedSeriesForDevice(deviceId: string): Promise<any> {
    const options: IFetchOptions = {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    };
    return await (
      await this.fetchClient.fetch(`/inventory/managedObjects/${deviceId}/supportedSeries`, options)
    ).json();
  }
  // Get Supported Measurements for given device Id
  private async getSupportedMeasurementsForDevice(deviceId: string): Promise<any> {
    const options: IFetchOptions = {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    };
    return await (
      await this.fetchClient.fetch(
        `/inventory/managedObjects/${deviceId}/supportedMeasurements`,
        options
      )
    ).json();
  }

  /**
   * Check and reload measuerements if device is changed
   */

  closeCreateSensor(): void {
    this.modalRef.hide();
    this.addDeviceForm.reset();
    this.childDevicesLength=0;
    this.measurementTypeList=[];
    this.includeChildDevice=false;
  }

  invokeSetValue(): void {
    this.featurecount = 0;
    this.featurecount = this.selectedMeasurements.length;
    if (this.featurecount > 1) {
      this.streamingWindowSize = 1;
      this.addDeviceForm.controls.streamingWindowSize.disable();
    } else {
      this.streamingWindowSize = 25;
      this.addDeviceForm.controls.streamingWindowSize.enable();
    }
  }

  async invokeChildDevices(chDevice: ChildDeviceConfig[]): Promise<void> {console.log("chDevice:",chDevice);console.log("selectedChildDevices:",this.selectedChildDevices)
    if (this.selectedChildDevices.length > 0 && this.includeChildDevice) {
      this.measurementTypeList=this.deviceMeasurementList;console.log("measureTypeList when change in selecteddevice:",this.measurementTypeList);
      console.log("selectedChildDevices:",this.selectedChildDevices);/*this.selectedMeasurements = []*/;console.log("selectedMeasurements:",this.selectedMeasurements);
      for (let ch of this.selectedChildDevices) {
          const response = await this.cmonSvc.getTargetObject(ch);
          this.configDevice = ch;
          // this.getcombinemeasurement(response)
          const supportedMeasurements = await this.getSupportedMeasurementsForDevice(ch);console.log("supportedMeasurements of child:",supportedMeasurements);
          const fragmentSeries = await this.getSupportedSeriesForDevice(ch);console.log("fragmentSeries of child:",fragmentSeries);
          let childFragmentList :any[] =this.getFragementList(
            [],
            fragmentSeries.c8y_SupportedSeries,
            supportedMeasurements.c8y_SupportedMeasurements,
            response
          );console.log("childFragmentList:",childFragmentList);
          this.measurementTypeList=this.measurementTypeList.concat(childFragmentList);console.log("measurementTypeList after child concat:",this.measurementTypeList);
      }
    }
    else {
      const response = await this.cmonSvc.getTargetObject(this.Selecteddevice.id);
      this.measurementList = [];
      this.measurementTypeList = [];
      this.selectedMeasurements = [];
      this.measurementTypeList=this.deviceMeasurementList;
    }
  }

  async invokeParentDevice(e: DeviceConfig) {
    this.deviceSelected(e)
  }

  invokeUpdateSetValue(): void {
    this.featurecount = 0;
    this.featurecount = this.selectedMeasurements.length;
    if (this.featurecount > 1) {
      this.streamingWindowSize = 1;
      this.editDeviceForm.controls.streamingWindowSize.disable();
    } else {
      this.streamingWindowSize = 25;
      this.editDeviceForm.controls.streamingWindowSize.enable();
    }
  }

  async createSensor(): Promise<void> {
    const index = this.DeviceList.findIndex(
      (element: { id: any }) => element.id === this.Selecteddevice.id
    );
    if (index > -1) {
      this.alertervice.warning(
        'Device is already added,to reconfigure device stop streaming and use edit option'
      );
      this.modalRef.hide();
      this.addDeviceForm.reset();
      this.measurementTypeList=[];
      this.childDevicesLength=0;
      this.includeChildDevice=false;
    } else {
      this.deviceMeasurements = [];
      let mstype = '';
      let msId = '';
      let msSeries = '';

      if (this.selectedMeasurements) {
        this.selectedMeasurements.forEach((ms: string) => {
          this.measurementTypeList.forEach((ml: any) => {
            if (ml.description === ms) {
              mstype = ml.type;
              msId = ml.id;
              msSeries = ml.name;

            }
          });
          const values = ms.split('.', 2);
          const arr = { type: mstype, fragment: values[0], series: msSeries, deviceId: msId };
          this.deviceMeasurements.push(arr);
        });
        // Micorservice configration Parameters initialization
        const config = {
          featureCount: this.featurecount,
          streamingWindowSize: this.streamingWindowSize || 25,
          samplesToBuffer: this.samplesToBuffer || 10000,
          learningRateNumerator: this.learningRateNumerator || 10,
          learningRateDenominator: this.learningRateDenominator || 1000,
          learningMaxSamples: this.learningMaxSamples || 100000,
          learningMaxClusters: 1000,
          anomalyHistoryWindow: this.anomalyHistoryWindow || 1000,
        };
        this.microserviceBoonLogic.listUrl = 'amber-integration/sensors';

        this.createResponse = await this.microserviceBoonLogic.post({
          id: this.Selecteddevice.id,
          configuration: config,
          dataPoints: this.deviceMeasurements,
          childDevices: this.selectedChildDevices
        });
        await this.loadSpecificFragmentDevice();
        if (this.createResponse.status === 201 || this.createResponse.status === 200) {
          this.alertervice.success('Created Sensor and Configured Device');
        } else {
          this.alertervice.danger('Failed to Configure Device');
        }
      }
      this.modalRef.hide();
      this.addDeviceForm.reset();
      this.childDevicesLength=0;
      this.includeChildDevice=false;
      this.measurementTypeList=[];
      this.refresh();
      
    }
  }

  setStopDeviceIndex(index: any): void {
    this.DeRegister = [];
    this.DeRegister = this.pagedItems[index];
  }

  setStartDeviceIndex(index: any): void {
    this.ReRegister = [];
    this.ReRegister = this.pagedItems[index];
  }

  setDeleteDeviceIndex(index: any): void {
    this.deviceDelete = [];
    this.deviceDelete = this.pagedItems[index];
  }

  openDeletePopup(e: any, i: any): void {
    this.setDeleteDeviceIndex(i);
    this.displayDeleteStyle = 'block';
  }

  closeDeletePopup(): void {
    this.displayDeleteStyle = 'none';
  }

  openDeRegisterPopup(e: any, i: any): void {
    this.setStopDeviceIndex(i);
    this.displayDeRegisterStyle = 'block';
  }

  closeDeRegisterPopup(): void {
    this.displayDeRegisterStyle = 'none';
  }

  openReRegisterPopup(e: any, i: any): void {
    this.setStartDeviceIndex(i);
    this.displayReRegisterStyle = 'block';
  }

  closeReRegisterPopup(): void {
    this.displayReRegisterStyle = 'none';
  }

  async DeRegisterDevice(): Promise<void> {
    let getResponse: any;
    this.closeDeRegisterPopup();
    this.microserviceBoonLogic.listUrl =
      'amber-integration/sensors/' + this.DeRegister.id + '/status';
    getResponse = await this.microserviceBoonLogic.put({
      isStreaming: false,
    });
    if (getResponse.status === 200) {
      this.alertervice.success('Measurements Processing Stopped');
    } else {
      this.alertervice.danger('Failed to Stop Measurements Processing');
    }
    await this.loadSpecificFragmentDevice();
  }

  async StreamAll(): Promise<void> {
    let getResponse: any;
    if (this.pagedItems) {
      await this.pagedItems.forEach(async (sm: any) => {
        this.microserviceBoonLogic.listUrl = 'amber-integration/sensors/' + sm.id + '/status';
        getResponse = await this.microserviceBoonLogic.put({
          isStreaming: true,
        });
      });
      await this.loadSpecificFragmentDevice();
      await this.refresh();
    }
  }

  async StreamNone(): Promise<void> {
    let getResponse: any;
    if (this.pagedItems) {
      await this.pagedItems.forEach(async (sm: any) => {
        this.microserviceBoonLogic.listUrl = 'amber-integration/sensors/' + sm.id + '/status';
        getResponse = await this.microserviceBoonLogic.put({
          isStreaming: false,
        });
      });
      await this.loadSpecificFragmentDevice();
      await this.refresh();
    }
  }

  async DeleteDevice(): Promise<void> {
    let getResponse: any;
    this.closeDeletePopup();
    this.microserviceBoonLogic.listUrl = 'amber-integration/sensors/' + this.deviceDelete.id;
    getResponse = await this.microserviceBoonLogic.remove({});
    await this.loadSpecificFragmentDevice();
    await this.refresh();
    if (getResponse.status === 200) {
      this.alertervice.success('Deleted Successfully');
    } else {
      this.alertervice.danger('Failed to Delete Device');
    }
  }

  async ReRegisterDevice(): Promise<void> {
    let getResponse: any;
    this.closeReRegisterPopup();
    this.microserviceBoonLogic.listUrl =
      'amber-integration/sensors/' + this.ReRegister.id + '/status';
    getResponse = await this.microserviceBoonLogic.put({
      isStreaming: true,
    });
    if (getResponse.status === 200) {
      this.alertervice.success('Measurements Processing Started');
    } else {
      this.alertervice.danger('Failed to Start Measurements Processing');
    }
    await this.loadSpecificFragmentDevice();
  }

  async editModal(edittemplate: TemplateRef<any>, index: any): Promise<void> {

    this.updateDevice = [];
    this.updateDevice = this.pagedItems[index];
    if (this.updateDevice && this.updateDevice.id) {
      this.measurementList = [];
    }
   // if (this.updateDevice.isStreaming === 'false' || this.statusResponse !== 'READY') {
      this.modalRef = this.modalService.show(edittemplate);
      let measurements = [];

      let tempArr: any;
      this.updateDevice.datapoints.forEach((data) => {
        measurements.push(data.fragment + '.' + data.series);


      });
      tempArr = measurements.concat(this.measurementList)
      this.measurementTypeList = [...tempArr];
      this.selectedMeasurements = this.measurementTypeList;
      this.streamingWindowSize = this.updateDevice.configuration.streamingWindowSize;
      this.samplesToBuffer = this.updateDevice.configuration.samplesToBuffer;
      this.learningRateNumerator = this.updateDevice.configuration.learningRateNumerator;
      this.learningRateDenominator = this.updateDevice.configuration.learningRateDenominator;
      this.learningMaxSamples = this.updateDevice.configuration.learningMaxSamples;
      this.anomalyHistoryWindow = this.updateDevice.configuration.anomalyHistoryWindow;
      //await this.getspecificmeasurement({ deviceId: this.updateDevice.id });
    //}
  }
  clearTextValues() {
    this.anomalyHistoryWindow = null;
    this.streamingWindowSize = null;
    this.samplesToBuffer = null;
    this.learningRateNumerator = null;
    this.learningRateDenominator = null;
    this.learningMaxSamples = null;
  }

  async updateSensor(): Promise<void> {
    this.deviceMeasurements = [];

    if (this.selectedMeasurements) {
      let mstype = '';
      this.selectedMeasurements.forEach((ms: string) => {
        this.measurementList.forEach((ml: any) => {
          if (ml.description === ms) {
            mstype = ml.type;
          }
        });
        const values = ms.split('.', 2);
        const arr = { type: mstype, fragment: values[0], series: values[1] };
        this.deviceMeasurements.push(arr);
      });
      if (isDevMode()) {
        console.log('+-+- CHECKING MEASUREMENTS FOR: ', this.deviceMeasurements);
      }
      if (isDevMode()) {
        console.log('+-+- CHECKING CONFIGURATIONS FOR: ', this.configuration);
      }
      // Micorservice configration Parameters initialization
      const config = {
        featureCount: this.featurecount,
        streamingWindowSize: this.streamingWindowSize || 25,
        samplesToBuffer: this.samplesToBuffer || 10000,
        learningRateNumerator: this.learningRateNumerator || 10,
        learningRateDenominator: this.learningRateDenominator || 100000,
        learningMaxSamples: this.learningMaxSamples || 10000,
        learningMaxClusters: 1000,
        anomalyHistoryWindow: this.anomalyHistoryWindow || 1000,
      };
      this.microserviceBoonLogic.listUrl =
        'amber-integration/sensors/' + this.updateDevice.id + '/config';

      this.createResponse = await this.microserviceBoonLogic.put({
        id: this.updateDevice.id,
        configuration: config,
        dataPoints: this.deviceMeasurements,
      });
      await this.loadSpecificFragmentDevice();
      if (this.createResponse.status === 201 || this.createResponse.status === 200) {
        this.alertervice.success(' Successfully ReConfigured Device');
      } else {
        this.alertervice.danger('Failed to ReConfigure Device');
      }
      this.modalRef.hide();
      this.editDeviceForm.reset();
      this.refresh();
    }
  }

  closeUpdateSensor(): void {
    this.modalRef.hide();
    this.editDeviceForm.reset();
  }

  async navigateToLog(): Promise<void> {
    this.allApplications = [];
    this.application = [];

    this.userHasAdminRights = this.userService.hasRole(
      this.appStateService.currentUser.value!,
      'ROLE_APPLICATION_MANAGEMENT_ADMIN'
    );
    if (this.config.microservicename) {
      if (!this.allApplications || this.allApplications.length === 0) {
        this.allApplications = (
          await this.appservice.listByUser(this.appStateService.currentUser.value!, {
            pageSize: 2000,
          })
        ).data;
        this.application = this.allApplications.filter(
          (app) => app.name === this.config.microservicename
        );
      }
      if (isDevMode()) {
        console.log('+-+- AMBER MICROSERVICE OBJECT', this.application);
      }
      const appId = this.application[0].id;
      window.open(`/apps/administration/index.html#/microservices/${appId}/logs`, '_blank');
    } else {
      this.alertervice.danger(
        'You do not have admin permission to access this, please login with admin previlege to use this functionality'
      );
    }
  }

  async onCheckboxChange(event: any): Promise<void> {
    this.includeChildDevice = event.target.checked;
    if (!this.includeChildDevice) {
      const response = await this.cmonSvc.getTargetObject(this.Selecteddevice.id);
      this.measurementList = [];
      this.measurementTypeList = [];
      this.selectedMeasurements = [];
      console.log("selectedChildDevicesOncheckBoxChange:",this.selectedChildDevices);this.selectedChildDevices = [];
      // this.getcombinemeasurement(response)
      this.measurementTypeList=this.deviceMeasurementList;
    }
  }
}

export interface DeviceConfig {
  id: string;
  name: string;
  childDevices: any;
}

export interface ChildDeviceConfig {
  managedObject: {
    id: string;
    name: string;
  }
}
