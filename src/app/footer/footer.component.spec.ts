import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FooterComponent } from './footer.component';
import {
  MatDialogModule,
  MatDialog
} from '@angular/material/dialog';
import { AboutComponent } from '../about/about.component';

describe('FooterComponent', () => {
  let component: FooterComponent;
  let fixture: ComponentFixture<FooterComponent>;

  const mockDialog = {
    open: jasmine.createSpy('open')
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterComponent, MatDialogModule],
      providers: [
        {
          provide: MatDialog,
          useValue: mockDialog
        }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(FooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should open dialog', () => {
    component.openDialog();
    expect(mockDialog.open).toHaveBeenCalledOnceWith(AboutComponent, {});
  });
});
