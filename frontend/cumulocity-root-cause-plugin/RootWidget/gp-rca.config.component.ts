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
import { Component, DoCheck, Input, isDevMode, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { MeasurementService } from '@c8y/client';
import { AlertService } from '@c8y/ngx-components';
import { BehaviorSubject } from 'rxjs';
import { Commonc8yService } from './Commonc8yservice.service';
import { debounceTime, distinctUntilChanged, tap, switchMap, finalize, skip } from 'rxjs/operators';



@Component({
  selector: 'lib-gp-config-rca',
  templateUrl: './gp-rca.config.component.html',
  styleUrls: ['./../node_modules/@ng-select/ng-select/themes/default.theme.css'],
  encapsulation: ViewEncapsulation.None,
})
export class GpRcaConfigComponent implements OnInit, DoCheck {
  @Input() config: any = {};
  measurementRCAList = [];
  observableMeasurements$ = new BehaviorSubject<any>(this.measurementRCAList);
  measurementRCAType: any;
  ListMeasurementType: any;
  measurementSubs: any;
  isOpenCP = false;
  borderCP = false;
  deviceId: any;

  rcaMeasuremntDeviceForm = new FormGroup({
    rcadevicemeasure: new FormControl(),
    intervalSelect: new FormControl(),
    chartcolor: new FormControl(),
    bordercolor: new FormControl(),
  });

  constructor(
    private cmonSvc: Commonc8yService,
    private alertervice: AlertService,
    private measurementService: MeasurementService,
    private formBuilder: FormBuilder
  ) {}

  async ngOnInit(): Promise<void> {
    if (this.config.device && this.config.device.id) {
      this.deviceId = this.config.device.id;
      await this.getmeasurement();
    }
  }

  async getmeasurement(): Promise<void> {
    if (this.deviceId) {
      const response = await this.cmonSvc.getTargetObject(this.deviceId);
      await this.cmonSvc.getFragmentSeries(
        response,
        this.measurementRCAList,
        this.observableMeasurements$
      );
      if (!this.measurementRCAType) {
        this.measurementRCAType = {};
      } else {
        if (this.ListMeasurementType.length > 0) {
          let measurementType;
          for (measurementType of this.ListMeasurementType) {
            if (this.measurementRCAType.name === measurementType.name) {
              this.measurementRCAType = measurementType;
            }
          }
        }
      }

      // Get the measurements as soon as device or group is selected
      this.measurementSubs = this.observableMeasurements$
        .pipe(skip(1))
        // tslint:disable-next-line: deprecation
        .subscribe(async (mes) => {
          this.ListMeasurementType = [];
          if (mes && mes.length > 0) {
            this.ListMeasurementType = [...mes];
          }
        });
    }
  }

  invokeSetRCA(): void {
    if (this.config.selectedRCAMeasurements.length > 0) {
    }
  }
  openColorPicker(): void {
    if (!this.isOpenCP) {
      this.isOpenCP = true;
    }
  }
  openBorderColorPicker(): void {
    if (!this.borderCP) {
      this.borderCP = true;
    }
  }
  closeColorPicker(): void {
    if (this.isOpenCP) {
      this.isOpenCP = false;
    }
  }
  closeBorderColorPicker(): void {
    if (this.borderCP) {
      this.borderCP = false;
    }
  }
  setSelectedColor(value: string): void {
    if (this.config.color) {
      this.config.color = this.config.color + ';' + value;
    } else {
      this.config.color = value;
    }
  }
  setSelectedBorderColor(value: string): void {
    if (this.config.borderColor) {
      this.config.borderColor = this.config.borderColor + ';' + value;
    } else {
      this.config.borderColor = value;
    }
  }
  ngDoCheck(): void {
    if (this.config.device && this.config.device.id !== this.deviceId) {
      this.deviceId = this.config.device.id;
      this.ListMeasurementType = [];
      this.getmeasurement();
    }
  }
}
