import { Component } from '@angular/core';
import {
  ActionSheetController,
  NavController,
  RefresherCustomEvent,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { EstacionamientoCard } from '../../core/models/estacionamiento.model';
import { PeatonalStatCard } from '../../core/models/peatonal-resumen.model';
import { mensajeErrorUsuario } from '../../core/utils/api-response.util';
import { AuthService } from '../../core/services/auth.service';
import { EstacionamientoService } from '../../core/services/estacionamiento.service';
import { NetworkService } from '../../core/services/network.service';
import { OfflineService } from '../../core/services/offline.service';
import { PeatonalService } from '../../core/services/peatonal.service';
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

  readonly estacionamientosSkeleton = [0, 1, 2];
  readonly statsSkeleton = [0, 1, 2];

  estacionamientos: EstacionamientoCard[] = [];
  cargandoEstacionamientos = false;
  errorEstacionamientos: string | null = null;

  accesosPeatonales: AccesoPeatonal[] = [
    { id: 1, nombre: 'Entrada Principal', ubicacion: 'Acceso Av. Vitacura', estado: 'Abierto' },
    { id: 2, nombre: 'Entrada Norte', ubicacion: 'Sector Talleres', estado: 'Abierto' },
  ];

  statsPeatonal: PeatonalStatCard[] = [];
  fechaResumenPeatonal: string | null = null;
  cargandoResumenPeatonal = false;
  errorResumenPeatonal: string | null = null;

  constructor(
    private authService: AuthService,
    private estacionamientoService: EstacionamientoService,
    private network: NetworkService,
    private offlineService: OfflineService,
    private peatonalService: PeatonalService,
    private actionSheetCtrl: ActionSheetController,
    private ui: UiService,
    public navCtrl: NavController
  ) {}

  ionViewWillEnter(): void {
    void this.cargarEstacionamientos({ evitarCache: true });
    void this.cargarResumenPeatonal({ silencioso: true });
  }

  porcentaje(item: EstacionamientoCard): number {
    if (!item.cuposTotales) {
      return 0;
    }
    return Math.round((item.cuposDisponibles / item.cuposTotales) * 100);
  }

  colorBarra(item: EstacionamientoCard): string {
    return item.cuposDisponibles > 0 ? '#4CAF50' : '#C00';
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
    if (e.cuposDisponibles === 0) {
      void this.ui.presentToast(
        'No hay cupos disponibles en este estacionamiento.',
        { color: 'warning', duration: 2500 }
      );
      return;
    }

    this.navCtrl.navigateForward('/estacionamiento-detalle', {
      queryParams: {
        aeseNcorr: e.id,
        nombre: e.nombre,
        ubicacion: e.ubicacion,
      },
    });
  }

  async cargarEstacionamientos(opciones?: {
    silencioso?: boolean;
    evitarCache?: boolean;
  }): Promise<void> {
    if (!opciones?.silencioso) {
      this.cargandoEstacionamientos = true;
    }
    this.errorEstacionamientos = null;

    const hayInternet = await this.network.hayInternet();
    if (!hayInternet) {
      const cache = await this.offlineService.getEstacionamientosOffline();
      if (cache.length) {
        this.estacionamientos = [...cache];
      } else {
        this.estacionamientos = [];
        this.errorEstacionamientos =
          'No hay estacionamientos disponibles.';
      } 
      if (!opciones?.silencioso) {
        this.cargandoEstacionamientos = false;
      }
      return;
    }

    try {
      const lista = await firstValueFrom(
        this.estacionamientoService.listar({
          evitarCache: opciones?.evitarCache,
        })
      );
      this.estacionamientos = [...lista];
    } catch (err: unknown) {
      const cache = await this.offlineService.getEstacionamientosOffline();
      if (cache.length) {
        this.estacionamientos = [...cache];
        this.errorEstacionamientos = null;
      } else {
        this.estacionamientos = [];
        this.errorEstacionamientos = mensajeErrorUsuario(
          err,
          'No se pudieron cargar los estacionamientos.'
        );
      }
    } finally {
      if (!opciones?.silencioso) {
        this.cargandoEstacionamientos = false;
      }
    }
  }

  onSegmentoChange(): void {
    if (this.segmentoActivo === 'estacionamientos' && this.estacionamientos.length === 0) {
      void this.cargarEstacionamientos();
      return;
    }
    if (this.segmentoActivo === 'peatonal' && this.statsPeatonal.length === 0) {
      void this.cargarResumenPeatonal();
    }
  }

  async refrescarContenido(event: RefresherCustomEvent): Promise<void> {
    try {
      if (this.segmentoActivo === 'estacionamientos') {
        await this.cargarEstacionamientos({
          silencioso: true,
          evitarCache: true,
        });
      } else {
        await this.cargarResumenPeatonal({ silencioso: true });
      }
    } finally {
      await event.target.complete();
    }
  }

  async cargarResumenPeatonal(opciones?: { silencioso?: boolean }): Promise<void> {
    if (!opciones?.silencioso) {
      this.cargandoResumenPeatonal = true;
    }
    this.errorResumenPeatonal = null;

    const hayInternet = await this.network.hayInternet();
    if (!hayInternet) {
      const cache = await this.offlineService.getResumenPeatonalOffline();
      if (cache) {
        this.statsPeatonal = cache.stats;
        this.fechaResumenPeatonal = cache.fecha ?? null;
      } else {
        this.statsPeatonal = [];
        this.fechaResumenPeatonal = null;
        this.errorResumenPeatonal =
          'No hay resumen peatonal disponible.';
      }
      if (!opciones?.silencioso) {
        this.cargandoResumenPeatonal = false;
      }
      return;
    }

    try {
      const res = await firstValueFrom(this.peatonalService.obtenerResumen());
      this.statsPeatonal = res.stats;
      this.fechaResumenPeatonal = res.fecha ?? null;
    } catch (err: unknown) {
      const cache = await this.offlineService.getResumenPeatonalOffline();
      if (cache) {
        this.statsPeatonal = cache.stats;
        this.fechaResumenPeatonal = cache.fecha ?? null;
        this.errorResumenPeatonal = null;
      } else {
        this.statsPeatonal = [];
        this.fechaResumenPeatonal = null;
        this.errorResumenPeatonal = mensajeErrorUsuario(
          err,
          'No se pudo cargar el resumen peatonal.'
        );
      }
    } finally {
      if (!opciones?.silencioso) {
        this.cargandoResumenPeatonal = false;
      }
    }
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

}
