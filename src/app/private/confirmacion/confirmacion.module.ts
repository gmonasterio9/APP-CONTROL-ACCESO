import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ConfirmacionPage } from './confirmacion.page';

const routes: Routes = [
  { path: '', component: ConfirmacionPage },
];

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [ConfirmacionPage],
})
export class ConfirmacionModule {}
