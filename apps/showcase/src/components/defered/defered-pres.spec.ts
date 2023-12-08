import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeferedPresComponent } from './defered-pres.component';

describe('DeferedPresComponent', () => {
  let component: DeferedPresComponent;
  let fixture: ComponentFixture<DeferedPresComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeferedPresComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(DeferedPresComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
