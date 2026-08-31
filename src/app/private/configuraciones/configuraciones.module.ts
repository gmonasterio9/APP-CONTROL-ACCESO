import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ConfiguracionesPage } from './configuraciones.page';

const routes: Routes = [{ path: '', component: ConfiguracionesPage }];

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [ConfiguracionesPage],
})
export class ConfiguracionesModule {}
