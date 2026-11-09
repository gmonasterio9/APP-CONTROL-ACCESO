import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InicioSesionPage } from './inicio-sesion.page';

const routes: Routes = [
  { path: '', component: InicioSesionPage }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class InicioSesionPageRoutingModule {}
