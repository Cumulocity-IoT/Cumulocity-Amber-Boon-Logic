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

import { Injectable, OnInit } from '@angular/core';
import { Service, FetchClient } from '@c8y/client';
import { AlertService } from '@c8y/ngx-components';
@Injectable()
export class GpBoonlogicService extends Service<any> {
  listUrl = '';
  // microservice navigation url list
  baseUrl = 'service';
  isMSExist = false;

  constructor(client: FetchClient, private alertervice: AlertService) {
    super(client);
  }

  post(amberBoonLogicObj: any): any {
    if (!this.isMSExist) {
      return;
    }
    return this.client.fetch(`${this.baseUrl}/${this.listUrl}`, {
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(amberBoonLogicObj),
      method: 'POST',
    });
  }

  put(amberBoonLogicObj: any): any {
    if (!this.isMSExist) {
      return;
    }
    return this.client.fetch(`${this.baseUrl}/${this.listUrl}`, {
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(amberBoonLogicObj),
      method: 'PUT',
    });
  }

  remove(amberBoonLogicObj: any): any {
    if (!this.isMSExist) {
      return;
    }
    return this.client.fetch(`${this.baseUrl}/${this.listUrl}`, {
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(amberBoonLogicObj),
      method: 'DELETE',
    });
  }

  async verifySimulatorMicroServiceStatus(): Promise<void> {
    const response = await this.client.fetch('service/amber-integration/health');
    const data = await response.json();
    if (data && data.status && data.status === 'UP') {
      this.isMSExist = true;
    } else {
      this.isMSExist = false;
      this.alertervice.danger('Please Install respective Amber Microservice ');
    }
  }

  async getConnectionStatus(): Promise<any> {
    if (!this.isMSExist) {
      return;
    } else {
      const response = this.client.fetch('service/amber-integration/status');
      const data = await (await response).json();
      return data;
    }
  }
}
