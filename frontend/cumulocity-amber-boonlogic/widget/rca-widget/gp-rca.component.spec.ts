import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GpRcaComponent } from './gp-rca.component';

describe('GpRcaComponent', () => {
  let component: GpRcaComponent;
  let fixture: ComponentFixture<GpRcaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GpRcaComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GpRcaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
