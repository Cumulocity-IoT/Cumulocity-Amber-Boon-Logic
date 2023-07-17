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

import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { GpBoonlogicComponent } from './gp-boonlogic.component';
import { CommonModule, CoreModule, HOOK_COMPONENTS } from '@c8y/ngx-components';
import { GpBoonlogicConfigComponent } from './config/gp-boonlogic-config.component';
import { GpBoonlogicService } from './gp-boonlogic.service';
import { ButtonsModule } from 'ngx-bootstrap/buttons';
import { ModalModule, BsModalService } from 'ngx-bootstrap/modal';
import { TypeaheadModule } from 'ngx-bootstrap/typeahead';
import { Commonc8yService } from './Commonc8yservice.service';
import { NgSelectModule } from '@ng-select/ng-select';
import { PaginationModule } from 'ngx-bootstrap/pagination';
import * as preview from './preview-image';

@NgModule({
  declarations: [GpBoonlogicComponent, GpBoonlogicConfigComponent],
  imports: [
    CoreModule,
    CommonModule,
    ModalModule,
    NgSelectModule,
    ButtonsModule.forRoot(),
    TypeaheadModule.forRoot(),
    FormsModule,
    ReactiveFormsModule,
    PaginationModule.forRoot(),
  ],
  entryComponents: [GpBoonlogicComponent, GpBoonlogicConfigComponent],
  exports: [GpBoonlogicComponent, GpBoonlogicConfigComponent],
  providers: [
    GpBoonlogicService,
    BsModalService,
    Commonc8yService,
    {
      provide: HOOK_COMPONENTS,
      multi: true,
      useValue: {
        id: 'boonlogic-config.widget',
        label: 'Amber Boon Logic Config Widget',
        previewImage: preview.previewImage,
        description: 'Amber BoonLogic Config Widget',
        component: GpBoonlogicComponent,
        configComponent: GpBoonlogicConfigComponent,
        data: {
          ng1: {
            options: {
              noDeviceTarget: true,
              noNewWidgets: false,
              deviceTargetNotRequired: true,
              groupsSelectable: false,
            },
          },
        },
      },
    },
  ],
})
export class GpBoonlogicModule {}