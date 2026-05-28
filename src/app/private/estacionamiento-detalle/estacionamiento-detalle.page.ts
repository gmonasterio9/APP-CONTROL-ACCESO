import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  NavController,
  RefresherCustomEvent,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import {
  CategoriaTipo,
  CupoCategoriaView,
  VehiculoActivoView,
} from '../../core/models/estacionamiento-disponibilidad.model';
import { ApiHttpError } from '../../core/services/api-http.service';
import { EstacionamientoService } from '../../core/services/estacionamiento.service';
import { UiService } from '../../core/services/ui.service';

const COLORES: Record<CategoriaTipo, { circulo: string; barra: string }> = {
  estudiante: { circulo: '#EDF3F8', barra: '#A0C3D9' },
  docente: { circulo: '#DCDFF9', barra: '#717FE8' },
  visita: { circulo: '#DCF9F8', barra: '#99D1CF' },
};

const BUSQUEDA_DEBOUNCE_MS = 400;

@Component({
  selector: 'app-estacionamiento-detalle',
  templateUrl: 'estacionamiento-detalle.page.html',
  styleUrls: ['estacionamiento-detalle.page.scss'],
  standalone: false,
})
export class EstacionamientoDetallePage implements OnDestroy {
  nombre = 'Estacionamiento';
  subtitulo = 'Registro de vehículos';
  busqueda = '';

  aeseNcorr: number | null = null;
  jornada: string | null = null;
  cupos: CupoCategoriaView[] = [];
  vehiculos: VehiculoActivoView[] = [];

  paginaVehiculos = 1;
  readonly pageSizeVehiculos = 10;
  totalRegistrosVehiculos = 0;
  totalPaginasVehiculos = 0;

  cargandoCupos = false;
  cargandoVehiculos = false;
  cargandoMasVehiculos = false;
  errorCupos: string | null = null;
  errorVehiculos: string | null = null;

  private busquedaTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private ui: UiService,
    private estacionamientoService: EstacionamientoService
  ) {}

  ionViewWillEnter(): void {
    const idParam = this.route.snapshot.queryParamMap.get('aeseNcorr');
    const parsed = idParam != null ? Number(idParam) : NaN;

    this.nombre =
      this.route.snapshot.queryParamMap.get('nombre') ?? 'Estacionamiento';
    const ubicacion = this.route.snapshot.queryParamMap.get('ubicacion');
    this.subtitulo = ubicacion?.trim() || 'Registro de vehículos';

    if (!Number.isFinite(parsed) || parsed <= 0) {
      this.errorCupos = 'Estacionamiento no válido.';
      return;
    }

    this.aeseNcorr = parsed;
    void this.cargarDisponibilidad();
    void this.cargarVehiculosActivos(true);
  }

  ngOnDestroy(): void {
    if (this.busquedaTimer) {
      clearTimeout(this.busquedaTimer);
    }
  }

  get hayMasVehiculos(): boolean {
    return this.paginaVehiculos < this.totalPaginasVehiculos;
  }

  colorCirculo(c: CupoCategoriaView): string {
    return COLORES[c.categoria].circulo;
  }

  colorBarra(c: CupoCategoriaView): string {
    return COLORES[c.categoria].barra;
  }

  porcentaje(c: CupoCategoriaView): number {
    if (!c.total) {
      return 0;
    }
    return Math.round((c.disponibles / c.total) * 100);
  }

  onBusquedaPatente(): void {
    if (this.busquedaTimer) {
      clearTimeout(this.busquedaTimer);
    }

    this.busquedaTimer = setTimeout(() => {
      void this.cargarVehiculosActivos(true);
    }, BUSQUEDA_DEBOUNCE_MS);
  }

  async cargarMasVehiculos(event: InfiniteScrollCustomEvent): Promise<void> {
    if (!this.hayMasVehiculos || this.cargandoMasVehiculos) {
      await event.target.complete();
      return;
    }

    this.paginaVehiculos += 1;
    await this.cargarVehiculosActivos(false);
    await event.target.complete();
  }

  async marcarSalida(v: VehiculoActivoView): Promise<void> {
    await this.ui.presentAlert({
      header: 'Autorizar Salida',
      message: '¿Estás seguro que deseas autorizar la salida?',
      cssClass: 'alert-salida',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'alert-btn-cancelar',
        },
        {
          text: 'Aceptar',
          cssClass: 'alert-btn-aceptar',
          handler: () => {
            void this.ejecutarSalida(v);
          },
        },
      ],
    });
  }

  private async ejecutarSalida(v: VehiculoActivoView): Promise<void> {
    const loading = await this.ui.presentLoading('Registrando salida...');

    try {
      const res = await firstValueFrom(
        this.estacionamientoService.registrarSalida(v.patente)
      );
      await this.ui.dismissLoading(loading);

      await this.ui.presentToast(
        res.message ?? 'Salida registrada correctamente.',
        { color: 'success', duration: 2500 }
      );

      this.vehiculos = this.vehiculos.filter(x => x.patente !== v.patente);
      this.totalRegistrosVehiculos = Math.max(0, this.totalRegistrosVehiculos - 1);
      void this.refrescarDetalle();
    } catch (err: unknown) {
      await this.ui.dismissLoading(loading);
      await this.ui.presentToast(
        this.extraerMensajeError(err) || 'No se pudo registrar la salida.',
        { color: 'danger' }
      );
    }
  }

  volver(): void {
    this.navCtrl.back();
  }

  async refrescarDetalle(event?: RefresherCustomEvent): Promise<void> {
    if (this.aeseNcorr == null) {
      await event?.target.complete();
      return;
    }

    await Promise.all([
      this.cargarDisponibilidad({ silencioso: true }),
      this.cargarVehiculosActivos(true, { silencioso: true }),
    ]);

    await event?.target.complete();
  }

  async cargarDisponibilidad(opciones?: { silencioso?: boolean }): Promise<void> {
    if (this.aeseNcorr == null) {
      return;
    }

    if (!opciones?.silencioso) {
      this.cargandoCupos = true;
    }
    this.errorCupos = null;

    try {
      const data = await firstValueFrom(
        this.estacionamientoService.obtenerDisponibilidad(
          this.aeseNcorr,
          this.nombre
        )
      );

      this.nombre = data.nombre;
      this.jornada = data.jornada;
      this.cupos = data.cupos;

      const ubicacion = this.route.snapshot.queryParamMap.get('ubicacion');
      const base = ubicacion?.trim() || 'Registro de vehículos';
      this.subtitulo = data.jornada ? `${base} · ${data.jornada}` : base;
    } catch (err: unknown) {
      this.cupos = [];
      this.errorCupos =
        this.extraerMensajeError(err) ||
        'No se pudo cargar la disponibilidad.';
    } finally {
      if (!opciones?.silencioso) {
        this.cargandoCupos = false;
      }
    }
  }

  async cargarVehiculosActivos(
    reset: boolean,
    opciones?: { silencioso?: boolean }
  ): Promise<void> {
    if (reset) {
      this.paginaVehiculos = 1;
      if (!opciones?.silencioso) {
        this.cargandoVehiculos = true;
      }
      this.errorVehiculos = null;
    } else {
      this.cargandoMasVehiculos = true;
    }

    try {
      const data = await firstValueFrom(
        this.estacionamientoService.listarVehiculosActivos({
          page: this.paginaVehiculos,
          pageSize: this.pageSizeVehiculos,
          patente: this.busqueda.trim() || undefined,
        })
      );

      this.totalRegistrosVehiculos = data.paginacion.totalRegistros;
      this.totalPaginasVehiculos = data.paginacion.totalPaginas;
      this.paginaVehiculos = data.paginacion.pagina;

      if (reset) {
        this.vehiculos = data.vehiculos;
      } else {
        this.vehiculos = [...this.vehiculos, ...data.vehiculos];
      }
    } catch (err: unknown) {
      if (reset) {
        this.vehiculos = [];
        this.totalRegistrosVehiculos = 0;
        this.totalPaginasVehiculos = 0;
        this.errorVehiculos =
          this.extraerMensajeError(err) ||
          'No se pudieron cargar los vehículos activos.';
      } else {
        this.paginaVehiculos = Math.max(1, this.paginaVehiculos - 1);
        await this.ui.presentToast(
          this.extraerMensajeError(err) ||
            'No se pudieron cargar más vehículos.',
          { color: 'warning' }
        );
      }
    } finally {
      if (reset) {
        if (!opciones?.silencioso) {
          this.cargandoVehiculos = false;
        }
      } else {
        this.cargandoMasVehiculos = false;
      }
    }
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
