import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AccesoPeatonalDetallePage } from './acceso-peatonal-detalle.page';

const routes: Routes = [{ path: '', component: AccesoPeatonalDetallePage }];

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [AccesoPeatonalDetallePage],
})
export class AccesoPeatonalDetalleModule {}
