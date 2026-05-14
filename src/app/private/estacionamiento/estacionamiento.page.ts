import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ModalController, NavController, ToastController } from '@ionic/angular';
import { IngresoConfirmacionComponent } from './ingreso-confirmacion/ingreso-confirmacion.component';

export interface Estacionamiento {
  id: number;
  nombre: string;
  ubicacion: string;
  cuposDisponibles: number;
  cuposTotales: number;
}

@Component({
  selector: 'app-estacionamiento',
  templateUrl: 'estacionamiento.page.html',
  styleUrls: ['estacionamiento.page.scss'],
  standalone: false,
})
export class EstacionamientoPage {

  nombre:    string | null = null;
  credencial: string | null = null;

  estacionamientos: Estacionamiento[] = [
    { id: 1, nombre: 'Estacionamiento Principal',   ubicacion: 'Entrada Av. Vitacura',       cuposDisponibles: 71, cuposTotales: 75 },
    { id: 2, nombre: 'Estacionamiento Norte',        ubicacion: 'Sector Talleres',             cuposDisponibles: 0,  cuposTotales: 75 },
    { id: 3, nombre: 'Estacionamiento Subterráneo',  ubicacion: 'Edificio Central - Subsuelo', cuposDisponibles: 0,  cuposTotales: 55 },
  ];

  constructor(
    private route: ActivatedRoute,
    private modalCtrl: ModalController,
    private navCtrl: NavController,
    private toastCtrl: ToastController,
  ) {
    this.nombre     = this.route.snapshot.queryParamMap.get('nombre');
    this.credencial = this.route.snapshot.queryParamMap.get('credencial');
  }

  porcentaje(e: Estacionamiento): number {
    return Math.round((e.cuposDisponibles / e.cuposTotales) * 100);
  }

  colorBarra(e: Estacionamiento): string {
    return e.cuposDisponibles > 0 ? '#4CAF50' : '#CC0000';
  }

  async ingresar(e: Estacionamiento): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: IngresoConfirmacionComponent,
      componentProps: {
        nombre:          this.nombre ?? 'Visitante',
        sede:            'Arica',
        perfil:          'Visita',
        estacionamiento: e.nombre,
      },
      cssClass: 'modal-fullscreen',
    });
    await modal.present();
  }

  registrarAcompanante(): void {
    this.navCtrl.navigateForward('/ingreso-manual', {
      queryParams: { nombre: this.nombre ?? '' },
    });
  }

  volver(): void {
    this.navCtrl.back();
  }
}
