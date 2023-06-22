import { TestBed } from '@angular/core/testing';

import { GpBoonlogicService } from './gp-boonlogic.service';

describe('GpBoonlogicService', () => {
  let service: GpBoonlogicService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GpBoonlogicService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
