import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { ScannerPage } from './scanner.page';
import { ModalResultadoEscaneoComponent } from './modal-resultado-escaneo/modal-resultado-escaneo.component';

const routes: Routes = [{ path: '', component: ScannerPage }];

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [ScannerPage, ModalResultadoEscaneoComponent],
})
export class ScannerModule {}
