import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AccesoPeatonalRegistroPage } from './acceso-peatonal-registro.page';

const routes: Routes = [{ path: '', component: AccesoPeatonalRegistroPage }];

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [AccesoPeatonalRegistroPage],
})
export class AccesoPeatonalRegistroModule {}
