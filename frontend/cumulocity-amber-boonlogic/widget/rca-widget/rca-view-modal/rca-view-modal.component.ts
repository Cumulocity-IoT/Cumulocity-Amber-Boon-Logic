import { Component, Input, isDevMode, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import {
  ActionControl,
  Column,
  ColumnDataType,
  ConfirmModalComponent,
  DataGridComponent,
  gettext,
  ModalLabels,
  Pagination,
  Status,
  StatusType,
} from '@c8y/ngx-components';
import { BehaviorSubject, Subject } from 'rxjs';
import { Commonc8yService } from '../Commonc8yservice.service';
import { debounceTime, distinctUntilChanged, tap, switchMap, finalize, skip } from 'rxjs/operators';

@Component({
  selector: 'lib-rca-view-modal',
  templateUrl: 'rca-view-modal.component.html',
  styleUrls: ['./styles.less'],
  encapsulation: ViewEncapsulation.None,
})
export class RCAViewModalComponent implements OnInit {
  //@ViewChild(DataGridComponent, { static: true })
  @Input() device!: any;
  @Input() label!: any;
  @Input() value!: any;
  @Input() rcaDataset!: any;
  @Input() configcolor!: any;
  @Input() configborderColor!: any;

  public barChartType = '';
  public barChartData: any;
  public barChartLabels: any;
  public barChartColors = [];
  colorsArr = [];
  dataLoaded: Promise<boolean> | undefined;
  bsModalRefOption!: BsModalRef;
  public barChartOptions = {
    scaleShowVerticalLines: false,
    responsive: true,
    legend: {
      title: {
        display: true,
        text: 'RCA',
      },
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
  measurementList = [];
  observableMeasurements$ = new BehaviorSubject<any>(this.measurementList);
  measurementType: any;
  measurementTypeList: any;
  measurementSubs: any;

  constructor(
    private cmonSvc: Commonc8yService,
    private bsModalRef: BsModalRef,
    private bsModalService: BsModalService
  ) {}

  async ngOnInit(): Promise<void> {
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
          ticks: {
            beginAtZero: true,
            stepSize: 0.2,
          },
        },
      ],
    };
    this.createchart();
  }
  async createchart(): Promise<void> {
    const dataValues: any[] = [];
    const labels: string[] = [];
    const dataResult = {};
    this.barChartLabels = [];
    this.barChartData = [];
    this.rcaDataset.forEach((iteam: any) => {
      labels.push(iteam.key);
      dataValues.push(iteam.value);
    });
    const dlabels = labels.map((l) => l.split('-'));
    const vlabels: any[] = [];
    dlabels.forEach((label: any) => {
      vlabels.push(label[1]);
    });
    if (dataValues.length > 0) {
      this.barChartLabels = vlabels;
      this.barChartData = [{ data: dataValues, label: 'Amber Route Cause' }];
      this.barChartType = 'bar';
      this.dataLoaded = Promise.resolve(true);
    }
    this.setChartColors();
  }
  setChartColors(): void {
    let borderColor = [];
    if (this.configcolor !== undefined) {
      this.colorsArr = this.configcolor.split(';');
      if (this.configborderColor === undefined || this.configborderColor === '') {
        borderColor = [];
      } else {
        borderColor = this.configborderColor.split(';');
      }

      if (this.configcolor === '') {
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

  public onCancelClicked(): void {
    this.bsModalRef.hide();
  }
}
