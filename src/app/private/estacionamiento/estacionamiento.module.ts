import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { EstacionamientoPage } from './estacionamiento.page';
import { IngresoConfirmacionComponent } from './ingreso-confirmacion/ingreso-confirmacion.component';

const routes: Routes = [
  { path: '', component: EstacionamientoPage },
];

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild(routes),
  ],
  declarations: [EstacionamientoPage, IngresoConfirmacionComponent],
})
export class EstacionamientoModule {}
