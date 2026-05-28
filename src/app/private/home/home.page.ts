import { Component } from '@angular/core';
import {
  ActionSheetController,
  NavController,
  RefresherCustomEvent,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { EstacionamientoCard } from '../../core/models/estacionamiento.model';
import { ApiHttpError } from '../../core/services/api-http.service';
import { AuthService } from '../../core/services/auth.service';
import { EstacionamientoService } from '../../core/services/estacionamiento.service';
import { UiService } from '../../core/services/ui.service';

export interface AccesoPeatonal {
  id: number;
  nombre: string;
  ubicacion: string;
  estado: string;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  segmentoActivo = 'estacionamientos';

  tiposEscaneo = [
    { id: 'credencial', label: 'Credencial', svg: 'assets/svg/credencial.svg', color: '#FEEB80' },
    { id: 'cedula', label: 'Cédula', svg: 'assets/svg/cedula.svg', color: '#A7B0F1' },
    { id: 'patente', label: 'Patente', svg: 'assets/svg/patente.svg', color: '#FFB066' },
  ];

  estacionamientos: EstacionamientoCard[] = [];
  cargandoEstacionamientos = false;
  errorEstacionamientos: string | null = null;

  accesosPeatonales: AccesoPeatonal[] = [
    { id: 1, nombre: 'Entrada Principal', ubicacion: 'Acceso Av. Vitacura', estado: 'Abierto' },
    { id: 2, nombre: 'Entrada Norte', ubicacion: 'Sector Talleres', estado: 'Abierto' },
  ];

  statsPeatonal = [
    { valor: 142, label: 'Autorizados', color: '#2ECC71' },
    { valor: 3, label: 'Ingreso Manual', color: '#F39C12' },
    { valor: 5, label: 'Visitas', color: '#2563EB' },
  ];

  constructor(
    private authService: AuthService,
    private estacionamientoService: EstacionamientoService,
    private actionSheetCtrl: ActionSheetController,
    private ui: UiService,
    public navCtrl: NavController
  ) {}

  ionViewWillEnter(): void {
    void this.cargarEstacionamientos();
  }

  porcentaje(item: EstacionamientoCard): number {
    if (!item.cuposTotales) {
      return 0;
    }
    return Math.round((item.cuposDisponibles / item.cuposTotales) * 100);
  }

  colorBarra(item: EstacionamientoCard): string {
    return item.cuposDisponibles > 0 ? '#4CAF50' : '#CC0000';
  }

  abrirScanner(): void {
    this.navCtrl.navigateForward('/scanner');
  }

  verDetallePeatonal(): void {
    this.navCtrl.navigateForward('/acceso-peatonal-detalle');
  }

  ingresoManual(): void {
    this.navCtrl.navigateForward('/ingreso-manual');
  }

  verDetalleEstacionamiento(e: EstacionamientoCard): void {
    this.navCtrl.navigateForward('/estacionamiento-detalle', {
      queryParams: {
        aeseNcorr: e.id,
        nombre: e.nombre,
        ubicacion: e.ubicacion,
      },
    });
  }

  async cargarEstacionamientos(opciones?: { silencioso?: boolean }): Promise<void> {
    if (!opciones?.silencioso) {
      this.cargandoEstacionamientos = true;
    }
    this.errorEstacionamientos = null;

    try {
      this.estacionamientos = await firstValueFrom(
        this.estacionamientoService.listar()
      );
    } catch (err: unknown) {
      this.estacionamientos = [];
      this.errorEstacionamientos =
        this.extraerMensajeError(err) || 'No se pudieron cargar los estacionamientos.';
    } finally {
      if (!opciones?.silencioso) {
        this.cargandoEstacionamientos = false;
      }
    }
  }

  async refrescarEstacionamientos(event?: RefresherCustomEvent): Promise<void> {
    if (this.segmentoActivo !== 'estacionamientos') {
      await event?.target.complete();
      return;
    }

    if (!event) {
      this.cargandoEstacionamientos = true;
    }

    await this.cargarEstacionamientos({ silencioso: true });

    this.cargandoEstacionamientos = false;
    await event?.target.complete();
  }

  async cerrarSesion(): Promise<void> {
    const sheet = await this.actionSheetCtrl.create({
      header: '¿Cerrar sesión?',
      subHeader: 'Se cerrará tu sesión actual',
      buttons: [
        {
          text: 'Cerrar sesión',
          role: 'destructive',
          icon: 'log-out-outline',
          handler: async () => {
            const loading = await this.ui.presentLoading('Cerrando sesión...');
            try {
              await this.authService.logout();
            } finally {
              await this.ui.dismissLoading(loading);
            }
          },
        },
        {
          text: 'Cancelar',
          role: 'cancel',
          icon: 'close-outline',
          cssClass: 'action-sheet-cancel',
        },
      ],
    });
    await sheet.present();
  }

  private extraerMensajeError(err: unknown): string | null {
    const apiErr = err as ApiHttpError;
    if (apiErr?.message) {
      return apiErr.message;
    }
    if (err instanceof Error && err.message) {
      return err.message;
    }
    return null;
  }
}
