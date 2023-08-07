import { Component, OnInit, Input, OnDestroy, isDevMode } from '@angular/core';
import { InventoryService, Realtime, MeasurementService } from '@c8y/client';
import { Commonc8yService } from './Commonc8yservice.service';
import { AlertService } from '@c8y/ngx-components';
import {
  debounceTime,
  distinctUntilChanged,
  tap,
  switchMap,
  finalize,
  skip,
  min,
  max,
} from 'rxjs/operators';
import { BehaviorSubject, from, never, Observable, Observer } from 'rxjs';
import { time } from 'console';
import * as moment_ from 'moment';
import { DatePipe } from '@angular/common';
import { Subject } from 'rxjs/internal/Subject';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { RCAViewModalComponent } from './rca-view-modal/rca-view-modal.component';

const moment = moment_;

@Component({
  selector: 'lib-gp-rca',
  templateUrl: './gp-rca.component.html',
  styleUrls: ['./gp-rca.component.css'],
})
export class GpRcaComponent implements OnInit, OnDestroy {
  @Input() config: any;
  deviceId: any;
  device: any;
  measurementList = [];
  observableMeasurements$ = new BehaviorSubject<any>(this.measurementList);
  measurementType: any;
  measurementTypeList: any;
  measurementSubs: any;
  valueFragmentType: any;
  valueFragmentSeries: any;
  selectedRCAMeasurements: any;
  oldDataset: any;
  public barChartOptions = {
    scaleShowVerticalLines: false,
    responsive: true,
    legend: {
      position: 'top',
      display: true,
    },
    scales: {},
    elements: {
      line: {
        fill: false,
      },
    },
  };
  public barChartType = '';
  public barChartData: any;
  public barChartLabels: any;
  public barChartColors = [];
  colorsArr = [];
  dataLoaded: Promise<boolean> | undefined;
  bsModalRefOption!: BsModalRef;
  rcaDataset: { key: string; value: any }[] = [];
  borderColor: any;
  realtimeState = true;
  interval: any;
  protected allSubscriptions: any = [];
  constructor(
    private cmonSvc: Commonc8yService,
    private alertervice: AlertService,
    private measurementService: MeasurementService,
    private formBuilder: FormBuilder,
    private modalService: BsModalService,
    private realTimeService: Realtime
  ) {}

  async ngOnInit(): Promise<void> {
    this.deviceId = this.config.device.id;
    this.selectedRCAMeasurements = this.config.selectedRCAMeasurements;
    this.interval = this.config.interval;
    this.barChartOptions['scales'] = {
      xAxes: [
        {
          ticks: {
            beginAtZero: true,
            font: {
              size: 6,
            },
          },
        },
      ],
      yAxes: [
        {
          min: 0,
          max: 2,
          ticks: {
            beginAtZero: true,
            stepSize: 1,
          },
        },
      ],
    };
    await this.LoadDeviceData();
    if (this.realtimeState) {
      this.allSubscriptions = [];
      this.realtTimeMeasurements(this.deviceId);
    }
  }

  async refresh(): Promise<void> {
    this.clearSubscriptions();
    await this.LoadDeviceData();
  }
  /** Toggles the realtime state */
  async toggle(): Promise<void> {
    this.realtimeState = !this.realtimeState;
    if (this.realtimeState) {
      this.allSubscriptions = [];
      this.realtTimeMeasurements(this.deviceId);
    } else {
      this.clearSubscriptions();
    }
  }
  private realtTimeMeasurements(deviceId: any): void {
    const measurementChannel = `/measurements/${deviceId}`;
    const detailSubs = this.realTimeService.subscribe(
      measurementChannel,
      async (response: { data: any }) => {
        if (response && response.data) {
          const measurementData = response.data;
          if (measurementData.data) {
            const msmt = measurementData.data;
            if (
              msmt &&
              msmt[this.valueFragmentType] &&
              msmt[this.valueFragmentType][this.valueFragmentSeries]
            ) {
              await this.LoadDeviceData();
            }
          }
        }
      }
    );
    if (this.realtimeState) {
      this.allSubscriptions.push({
        id: this.deviceId,
        subs: detailSubs,
        type: 'Realtime',
      });
    } else {
      this.realTimeService.unsubscribe(detailSubs);
    }
  }

  private clearSubscriptions(): void {
    if (this.allSubscriptions) {
      this.allSubscriptions.forEach((s: any) => {
        this.realTimeService.unsubscribe(s.subs);
      });
    }
  }
  async LoadDeviceData(): Promise<void> {
    this.device = await this.cmonSvc.getTargetObject(this.deviceId);
    const response = await this.cmonSvc.getSpecificFragmentDevices(1, this.device.name);
    if (response.data) {
      await this.getmeasurement();
    } else {
      this.alertervice.danger('Device is not configured to Amber');
    }
  }
  async checkFargmentSeries(): Promise<void> {
    this.measurementList.forEach((ml: any) => {
      if (ml.name === 'ad') {
        this.valueFragmentType = 'c8y_ad';
        this.valueFragmentSeries = 'ad';
      }
    });

    if (this.valueFragmentSeries && this.valueFragmentType && this.device.id) {
      await this.createChart(this.device.id);
    }
  }

  async getmeasurement(): Promise<void> {
    if (this.device && this.device.id) {
      const response = await this.cmonSvc.getTargetObject(this.device.id);
      await this.cmonSvc.getFragmentSeries(
        response,
        this.measurementList,
        this.observableMeasurements$
      );
      if (!this.measurementType) {
        this.measurementType = {};
      } else {
        if (this.measurementTypeList.length > 0) {
          let measurementType;
          for (measurementType of this.measurementTypeList) {
            if (this.measurementType.name === measurementType.name) {
              this.measurementType = measurementType;
            }
          }
        }
      }

      // Get the measurements as soon as device or group is selected
      this.measurementSubs = this.observableMeasurements$
        .pipe(skip(1))
        .pipe(distinctUntilChanged())
        // tslint:disable-next-line: deprecation
        .subscribe(async (mes) => {
          this.measurementTypeList = [];
          if (mes && mes.length > 0) {
            this.measurementTypeList = [...mes];
            await this.checkFargmentSeries();
            this.measurementSubs.unsubscribe();
          }
        });
    }
  }

  /** Fetches the events using Event Service for the given device and particular event type */
  async createChart(deviceId: any): Promise<void> {
    const now = moment();
    const totime = moment(now, 'YYYY-MM-DD HH:mm:ss').format();
    const dataSet: { key: string; value: any }[] = [];
    let fromtime: any;
    if (this.interval === 'Last Hour') {
      fromtime = moment(totime).subtract(2, 'hours').format();
    } else if (this.interval === 'Last Minute') {
      fromtime = moment(totime).subtract(1, 'minutes').format();
    } else if (this.interval === '' || this.interval === undefined) {
      fromtime = moment(totime).subtract(1, 'hours').format();
    }
    const response = (await this.cmonSvc.getLastMeasurementForSource(
      deviceId,
      fromtime,
      totime,
      this.valueFragmentType,
      this.valueFragmentSeries
    )) as any;

    if (response && response.data.length > 0) {
      response.data.forEach((mes: any) => {
        if (
          mes &&
          mes[this.valueFragmentType] &&
          mes[this.valueFragmentType][this.valueFragmentSeries]
        ) {
          const date = moment(mes.time).format('YYYY-MM-DD HH:mm:ss');
          const value = mes[this.valueFragmentType][this.valueFragmentSeries].value;
          const arr = { key: date, value };
          dataSet.push(arr);
        }
      });
      dataSet.reverse();
      const dataValues: any[] = [];
      const labels: string[] = [];
      const dataResult = {};
      this.barChartLabels = [];
      this.barChartData = [];

      dataSet.forEach((iteam) => {
        labels.push(moment(iteam.key).format('YYYY-MM-DD HH:mm:ss'));
        dataValues.push(iteam.value);
      });
      const dlabels = labels.map((l) => l.split(' '));

      if (dataValues.length > 0) {
        this.barChartLabels = dlabels;
        this.barChartData = [{ data: dataValues, label: 'AD' }];
        this.barChartType = 'line';
        this.dataLoaded = Promise.resolve(true);
      }
      this.setChartColors();
    }
  }

  public chartClicked(event: any): void {
    if (event.active.length > 0) {
      const chart = event.active[0]._chart;
      const activePoints = chart.getElementsAtEventForMode(event.event, 'point', chart.options);
      const firstPoint = activePoints[0];
      const label = chart.data.labels[firstPoint._index];
      const value = chart.data.datasets[firstPoint._datasetIndex].data[firstPoint._index];
      if (value > 0) {
        this.displayModalDialog(label, value);
      }
    } else {
      return;
    }
  }
  async getRCAValue(time: string, setfalg: any): Promise<void> {
    this.rcaDataset = [];
    let fragment: any;
    const series: { key: string }[] = [];
    let response: any;
    if (this.selectedRCAMeasurements.length > 0) {
      this.selectedRCAMeasurements.forEach(async (fs: any) => {
        const values = fs.split('.', 2);
        fragment = values[0];
        series.push(values[1]);
      });
      if (setfalg === 1) {
        const fromtime = moment(time).subtract(1, 'minutes').format();
        const totime = moment(time, 'YYYY-MM-DD HH:mm:ss').format();
        response = (await this.cmonSvc.getMeasurementForSource(
          this.deviceId,
          fromtime,
          totime,
          fragment
        )) as any;
      } else if (setfalg === 0) {
        const totime = moment(time).add(1, 'minutes').format();
        const fromtime = moment(time, 'YYYY-MM-DD HH:mm:ss').format();
        response = (await this.cmonSvc.getMeasurementForSource(
          this.deviceId,
          fromtime,
          totime,
          fragment
        )) as any;
      }
      if (response && response.data.length === 1) {
        response.data.forEach((mes: any) => {
          series.forEach((series: any) => {
            if (mes && mes[fragment]) {
              const value = mes[fragment][series].value;
              const arr = { key: series, value };
              this.rcaDataset.push(arr);
            }
          });
        });
      } else if (response && response.data.length > 1) {
        const resp = response.data[response.data.length - 1];
        series.forEach((series: any) => {
          if (series) {
            const value = resp[fragment][series].value;
            const arr = { key: series, value };
            this.rcaDataset.push(arr);
          }
        });
      }
    }
  }
  public async displayModalDialog(time: any, value: any): Promise<void> {
    const ctime = time.join(' ');
    let setflag = 1;
    await this.getRCAValue(ctime, setflag);
    if (this.rcaDataset.length === 0) {
      setflag = 0;
      await this.getRCAValue(ctime, setflag);
    }

    const initialState = {
      device: this.deviceId,
      time: ctime,
      value,
      rcaDataset: this.rcaDataset,
      configcolor: this.config.color,
      configborderColor: this.config.borderColor,
    };
    this.bsModalRefOption = this.modalService.show(RCAViewModalComponent, {
      initialState,
    });
  }

  setChartColors(): void {
    let borderColor = [];
    if (this.config.color !== undefined) {
      this.colorsArr = this.config.color.split(';');
      if (this.config.borderColor === undefined || this.config.borderColor === '') {
        borderColor = [];
      } else {
        borderColor = this.config.borderColor.split(';');
      }

      if (this.config.color === '') {
        this.barChartColors = [];
      } else if (this.colorsArr.length >= this.barChartData.length) {
        for (let k = 0; k < this.barChartData.length; k++) {
          this.barChartColors.push({
            backgroundColor: this.colorsArr[k],
            // @ts-ignore
            borderColor,
          });
        }
      } else if (this.barChartData[0].data.length <= this.colorsArr.length) {
        if (borderColor.length < this.barChartData[0].data.length) {
          borderColor = [];
        }
        this.barChartColors = [
          {
            // @ts-ignore
            backgroundColor: this.colorsArr,
            // @ts-ignore
            borderColor,
          },
        ];
      } else {
        this.barChartColors = [];
      }
    } else {
      this.barChartColors = [];
    }
  }
  ngOnDestroy(): void {
    this.clearSubscriptions();
  }
}
