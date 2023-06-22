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
import { isDevMode, Injectable } from '@angular/core';
import {
  InventoryBinaryService,
  FetchClient,
  InventoryService,
  IManagedObject,
  IResultList,
  MeasurementService,
  IFetchOptions,
  IdReference,
} from '@c8y/client';
import { debounceTime, distinctUntilChanged, tap, switchMap, finalize, skip } from 'rxjs/operators';
import { BehaviorSubject, from, Observable, Observer } from 'rxjs';

@Injectable()
export class Commonc8yService {
  devices: any[] = [];
  statusResponse!: any;

  constructor(
    private invSvc: InventoryService,
    private msmtSvc: MeasurementService,
    private inventoryBinaryService: InventoryBinaryService,
    private fetchClient: FetchClient
  ) {}

  getTargetObject(deviceId: string): any {
    return new Promise((resolve, reject) => {
      this.invSvc.detail(deviceId).then((resp) => {
        if (resp.res.status === 200) {
          resolve(resp.data);
        } else {
          reject(resp);
        }
      });
    });
  }

  /**
   * This service will recursively get all the child devices for the given device id and return a promise with the result list.
   *
   * @param id ID of the managed object to check for child devices
   * @param pageToGet Number of the page passed to the API
   * @param allDevices Child Devices already found
   */
  getChildDevices(
    id: string,
    pageToGet: number,
    allDevices: { data: any[]; res: any }
  ): Promise<IResultList<IManagedObject>> {
    const inventoryFilter = {
      // fragmentType: 'c8y_IsDevice',
      pageSize: 50,
      withTotalPages: true,
      currentPage: pageToGet,
    };
    if (!allDevices) {
      allDevices = { data: [], res: null };
    }
    return new Promise((resolve, reject) => {
      this.invSvc.childAssetsList(id, inventoryFilter).then((resp: any) => {
        if (resp.res.status === 200) {
          if (resp.data && resp.data.length >= 0) {
            allDevices.data.push.apply(allDevices.data, resp.data);
            // response does not have totalPages... :(
            // suppose that if # of devices is less that the page size, then all devices have already been retrieved
            if (resp.data.length < inventoryFilter.pageSize) {
              resolve(allDevices);
            } else {
              this.getChildDevices(id, resp.paging.nextPage, allDevices)
                .then((np) => {
                  resolve(allDevices);
                })
                .catch((err) => reject(err));
            }
          }
        } else {
          reject(resp);
        }
      });
    });
  }

  // Regular expression for validation
  generateRegEx(input: any): string {
    const name = input + '';
    const nameLower = name.toLowerCase();
    const nameUpper = name.toUpperCase();
    let regex = '*';
    const numRegex = new RegExp(/^([0-9]+)$/);
    const splCharRegex = new RegExp(/^([,._-]+)$/);
    for (let i = 0; i < name.length; i++) {
      if (name.charAt(i) === ' ') {
        regex += ' ';
      } else if (name.charAt(i).match(numRegex)) {
        regex += '[' + name.charAt(i) + ']';
      } else if (name.charAt(i).match(splCharRegex)) {
        regex += '[' + name.charAt(i) + ']';
      } else {
        regex += '[' + nameLower.charAt(i) + '|' + nameUpper.charAt(i) + ']';
      }
    }
    regex += '*';
    return regex;
  }

  // Get All devices based on query search parameter

  getAllDevices(pageToGet: number, searchName?: any): Promise<IResultList<IManagedObject>> {
    let inventoryFilter: any = {};
    inventoryFilter = {
      pageSize: 10,
      withTotalPages: true,
      currentPage: pageToGet,
    };
    if (searchName) {
      inventoryFilter['query'] = `$filter=(has(c8y_IsDevice) and (name eq '${this.generateRegEx(
        searchName
      )}'))`;
    } else {
      inventoryFilter['query'] = `$filter=(has(c8y_IsDevice))`;
    }
    return new Promise((resolve, reject) => {
      this.invSvc.list(inventoryFilter).then((resp) => {
        if (resp.res.status === 200) {
          resolve(resp);
        } else {
          reject(resp);
        }
      });
    });
  }

  /**
   * This service will recursively get all the child devices for the given device id.
   *
   * @param id ID of the managed object to check for child additions
   * @param pageToGet Number of the page passed to the API
   * @param allAdditions Child additions already found... the newly found additions will be aded here
   * @param type Type of addition to return... the service does not use the "fragmentType"
   */
  getChildAdditions(
    id: string,
    pageToGet: number,
    allAdditions: { data: any[]; res: any },
    type: string
  ): Promise<IResultList<IManagedObject>> {
    const inventoryFilter = {
      // fragmentType: type,
      // valueFragmentType: type,
      // type: type,
      pageSize: 15,
      withTotalPages: true,
      currentPage: pageToGet,
    };
    if (!allAdditions) {
      allAdditions = { data: [], res: null };
    }
    return new Promise((resolve, reject) => {
      this.invSvc.childAdditionsList(id, inventoryFilter).then((resp: any) => {
        if (resp.res.status === 200) {
          if (resp.data && resp.data.length >= 0) {
            allAdditions.data.push.apply(allAdditions.data, resp.data);
            // response does not have totalPages... :(
            // suppose that if # of devices is less that the page size, then all devices have already been retrieved
            if (resp.data.length < inventoryFilter.pageSize) {
              allAdditions.data = allAdditions.data.filter((d) => {
                return d.type && d.type.localeCompare(type) === 0;
              });
              resolve(allAdditions);
            } else {
              this.getChildAdditions(id, resp.paging.nextPage, allAdditions, type)
                .then((np) => {
                  resolve(allAdditions);
                })
                .catch((err) => reject(err));
            }
          }
        } else {
          reject(resp);
        }
      });
    });
  }

  /**
   * Get Inventory list based on type
   */
  getInventoryItems(
    pageToGet: number,
    allInventoryItems: { data: any[]; res: any },
    type: string
  ): Promise<IResultList<IManagedObject>> {
    let inventoryFilter: any;
    inventoryFilter = {
      pageSize: 50,
      withTotalPages: true,
      currentPage: pageToGet,
      query: `type eq ${type}`,
    };
    if (!allInventoryItems) {
      allInventoryItems = { data: [], res: null };
    }
    return new Promise((resolve, reject) => {
      this.invSvc.list(inventoryFilter).then((resp: any) => {
        if (resp.res.status === 200) {
          if (resp.data && resp.data.length >= 0) {
            allInventoryItems.data.push.apply(allInventoryItems.data, resp.data);
            // response does not have totalPages... :(
            // suppose that if # of devices is less that the page size, then all devices have already been retrieved
            if (resp.data.length < inventoryFilter.pageSize) {
              // remove the additions that does not fit into the given type, if any
              resolve(allInventoryItems);
            } else {
              this.getInventoryItems(resp.paging.nextPage, allInventoryItems, type)
                .then((np) => {
                  resolve(allInventoryItems);
                })
                .catch((err) => reject(err));
            }
          }
        } else {
          reject(resp);
        }
      });
    });
  }

  getSpecificFragmentDevices(
    pageToGet: number,
    searchName?: any
  ): Promise<IResultList<IManagedObject>> {
    let inventoryFilter: any = {};
    inventoryFilter = {
      pageSize: 10,
      withTotalPages: true,
      currentPage: pageToGet,
    };
    if (searchName) {
      inventoryFilter[
        'query'
      ] = `$filter=(has(c8y_IsDevice) and (has(c8y_AmberSensorConfiguration)) and (name eq '${this.generateRegEx(
        searchName
      )}'))`;
    } else {
      inventoryFilter[
        'query'
      ] = `$filter=(has(c8y_IsDevice)) and (has(c8y_AmberSensorConfiguration)) `;
    }
    return new Promise((resolve, reject) => {
      this.invSvc.list(inventoryFilter).then((resp) => {
        if (resp.res.status === 200) {
          resolve(resp);
        } else {
          reject(resp);
        }
      });
    });
  }

  /**
   * Creates the given object using the InventoryService.
   *
   * @param managedObject Object to be created
   * @returns Promise object with the result of the service call
   */
  createManagedObject(managedObject: Partial<IManagedObject>): Promise<any> {
    return this.invSvc.create(managedObject);
  }

  updateManagedObject(managedObject: Partial<IManagedObject>): Promise<any> {
    return this.invSvc.update(managedObject);
  }

  deleteManagedObject(id: IdReference): Promise<any> {
    return this.invSvc.delete(id);
  }

  /**
   *
   * @param input Validate JSON Input
   */
  isValidJson(input: any): any {
    try {
      if (input) {
        const o = JSON.parse(input);
        if (o && o.constructor === Object) {
          return o;
        }
      }
    } catch (e) {}
    return false;
  }

  /**
   * This method used in configuration of this widget to populate available measurements for given device id or group id
   */
  getFragmentSeries(
    aDevice: any,
    fragementList: any,
    observableFragment$: BehaviorSubject<any>
  ): void {
    let deviceList: any = null;
    if (aDevice) {
      // get all child assets for the target object, defined in the configuration
      this.getTargetObject(aDevice.id)
        .then(async (mo: any) => {
          if (
            mo &&
            mo.type &&
            (mo.type.localeCompare('c8y_DeviceGroup') === 0 ||
              mo.type.localeCompare('c8y_DeviceSubgroup') === 0)
          ) {
            // GET child devices
            this.getChildDevices(aDevice.id, 1, deviceList)
              .then(async (deviceFound) => {
                deviceList = deviceFound.data;
                const uniqueDeviceList = deviceList
                  .filter(
                    (device: any, index: any, self: any) =>
                      index === self.findIndex((t: any) => t.type === device.type)
                  )
                  .map((device: any) => device.id);
                for (const device of uniqueDeviceList) {
                  const supportedMeasurements = await this.getSupportedMeasurementsForDevice(
                    device
                  );
                  const fragmentSeries = await this.getSupportedSeriesForDevice(device);
                  if (
                    fragmentSeries &&
                    fragmentSeries.c8y_SupportedSeries &&
                    supportedMeasurements &&
                    supportedMeasurements.c8y_SupportedMeasurements
                  ) {
                    fragementList = this.getFragementList(
                      fragementList,
                      fragmentSeries.c8y_SupportedSeries,
                      supportedMeasurements.c8y_SupportedMeasurements
                    );
                  }
                }
                observableFragment$.next(fragementList);
              })
              .catch((err) => {
                if (isDevMode()) {
                  console.log('+-+- ERROR FOUND WHILE GETTING CHILD DEVICES... ', err);
                }
              });
          } else {
            const supportedMeasurements = await this.getSupportedMeasurementsForDevice(aDevice.id);
            const fragmentSeries = await this.getSupportedSeriesForDevice(aDevice.id);
            if (
              fragmentSeries &&
              fragmentSeries.c8y_SupportedSeries &&
              supportedMeasurements &&
              supportedMeasurements.c8y_SupportedMeasurements
            ) {
              fragementList = this.getFragementList(
                fragementList,
                fragmentSeries.c8y_SupportedSeries,
                supportedMeasurements.c8y_SupportedMeasurements
              );
            }
            observableFragment$.next(fragementList);
          }
        })
        .catch((err: any) => {
          if (isDevMode()) {
            console.log('+-+- ERROR while getting Device details ', err);
          }
        });
    }
  }
  // This method populate measurementList/fragementList based on series and measurements
  private getFragementList(
    fragementList: any,
    fragmentSeries: any,
    supportedMeasurements: any
  ): any {
    if (fragementList) {
      fragmentSeries.forEach((fs: string) => {
        const measurementType = supportedMeasurements.filter(
          (smFilter: string) => fs.indexOf(smFilter) !== -1
        );
        if (measurementType && measurementType.length > 0) {
          const fsName = fs.replace(measurementType[0] + '.', '');
          const fsType = measurementType[0];
          const existingF = fragementList.find(
            (sm: { type: any; name: string }) => sm.type === fsType && sm.name === fsName
          );
          if (!existingF || existingF == null) {
            fragementList.push({
              name: fsName,
              type: fsType,
              description: fs,
            });
          }
        }
      });
    } else {
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
          });
        }
      });
    }
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
  // tslint:disable-next-line:max-line-length
  getLastMeasurementForSource(
    sourceId: string,
    dateFrom: string,
    dateTo: string,
    type: string,
    series: string
  ): Promise<IResultList<IManagedObject>> {
    const msmtFilter = {
      pageSize: 20,
      valueFragmentSeries: series,
      valueFragmentType: type,
      dateFrom,
      dateTo,
      revert: true,
      source: sourceId,
      // type
    };

    return new Promise((resolve) => {
      this.msmtSvc.list(msmtFilter).then((resp: any) => {
        resolve(resp);
      });
    });
  }

  getMeasurementForSource(
    sourceId: string,
    dateFrom: string,
    dateTo: string,
    type: string
  ): Promise<IResultList<IManagedObject>> {
    const msmtFilter = {
      pageSize: 10,
      valueFragmentType: type,
      dateFrom,
      dateTo,
      revert: true,
      source: sourceId,
      // type
    };

    return new Promise((resolve) => {
      this.msmtSvc.list(msmtFilter).then((resp: any) => {
        resolve(resp);
      });
    });
  }
}
