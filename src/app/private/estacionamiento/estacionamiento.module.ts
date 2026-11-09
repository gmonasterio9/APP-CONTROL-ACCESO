import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { EstacionamientoPage } from './estacionamiento.page';

const routes: Routes = [
  { path: '', component: EstacionamientoPage },
];

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild(routes),
  ],
  declarations: [EstacionamientoPage],
})
export class EstacionamientoModule {}
