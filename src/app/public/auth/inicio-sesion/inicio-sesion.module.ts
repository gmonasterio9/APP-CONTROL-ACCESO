import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { InicioSesionPageRoutingModule } from './inicio-sesion-routing.module';
import { InicioSesionPage } from './inicio-sesion.page';
import { SedesModalComponent } from './components/sedes-modal/sedes-modal.component';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    InicioSesionPageRoutingModule
  ],
  declarations: [InicioSesionPage, SedesModalComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class InicioSesionPageModule {}
