import { TestBed } from '@angular/core/testing';

import { GpRcaService } from './gp-rca.service';

describe('GpRcaService', () => {
  let service: GpRcaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GpRcaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
