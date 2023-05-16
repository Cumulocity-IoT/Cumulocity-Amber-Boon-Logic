import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GpBoonlogicComponent } from './gp-boonlogic.component';

describe('GpBoonlogicComponent', () => {
  let component: GpBoonlogicComponent;
  let fixture: ComponentFixture<GpBoonlogicComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GpBoonlogicComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GpBoonlogicComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
