import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { ScannerPage } from './scanner.page';
import { ScanResultModalComponent } from './scan-result-modal/scan-result-modal.component';

const routes: Routes = [{ path: '', component: ScannerPage }];

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [ScannerPage, ScanResultModalComponent],
})
export class ScannerModule {}
