import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { EstacionamientoDetallePage } from './estacionamiento-detalle.page';

const routes: Routes = [
  { path: '', component: EstacionamientoDetallePage },
];

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [EstacionamientoDetallePage],
})
export class EstacionamientoDetalleModule {}
