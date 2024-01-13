import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { AboutComponent } from '../about/about.component';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent {
  constructor(public dialog: MatDialog) { }

  openDialog(): void {
    this.dialog.open(AboutComponent, {});
  }
}
