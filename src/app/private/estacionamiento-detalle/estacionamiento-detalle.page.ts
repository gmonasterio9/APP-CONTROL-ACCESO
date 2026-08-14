import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  NavController,
  RefresherCustomEvent,
} from '@ionic/angular';
import { firstValueFrom, Subscription } from 'rxjs';
import {
  CategoriaTipo,
  CupoCategoriaView,
  VehiculoActivoView,
} from '../../core/models/estacionamiento-disponibilidad.model';
import { mensajeErrorUsuario } from '../../core/utils/api-response.util';
import { acreNcorrValidoParaRequest } from '../../core/utils/acre-ncorr.util';
import { EstacionamientoService } from '../../core/services/estacionamiento.service';
import { NetworkService } from '../../core/services/network.service';
import { OfflineService } from '../../core/services/offline.service';
import { UiService } from '../../core/services/ui.service';
import { AuthService } from '../../core/services/auth.service';

const COLORES: Record<CategoriaTipo, { circulo: string; barra: string }> = {
  estudiante: { circulo: '#EDF3F8', barra: '#A0C3D9' },
  docente: { circulo: '#DCDFF9', barra: '#717FE8' },
  colaborador: { circulo: '#FFF4E5', barra: '#FFB066' },
  visita: { circulo: '#DCF9F8', barra: '#99D1CF' },
};

const COLORES_DEFAULT = COLORES.estudiante;

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
  acreNcorr: number | null = null;
  jornada: string | null = null;
  cupos: CupoCategoriaView[] = [];
  vehiculos: VehiculoActivoView[] = [];

  paginaVehiculos = 1;
  readonly pageSizeVehiculos = 50;
  totalRegistrosVehiculos = 0;
  totalPaginasVehiculos = 0;

  readonly cuposSkeleton = [0, 1, 2, 3];
  readonly vehiculosSkeleton = [0, 1, 2];

  cargandoCupos = false;
  cargandoVehiculos = false;
  cargandoMasVehiculos = false;
  errorCupos: string | null = null;
  errorVehiculos: string | null = null;

  private busquedaTimer?: ReturnType<typeof setTimeout>;
  private catalogoSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private network: NetworkService,
    private offlineService: OfflineService,
    private ui: UiService,
    private authService: AuthService,
    private estacionamientoService: EstacionamientoService
  ) {}

  async ionViewWillEnter(): Promise<void> {
    const aeseParam = this.route.snapshot.queryParamMap.get('aeseNcorr');
    const acreParam = this.route.snapshot.queryParamMap.get('acreNcorr');
    const aeseParsed = aeseParam != null ? Number(aeseParam) : NaN;
    const acreParsed = acreParam != null ? Number(acreParam) : NaN;

    this.nombre =
      this.route.snapshot.queryParamMap.get('nombre') ?? 'Estacionamiento';
    const ubicacion = this.route.snapshot.queryParamMap.get('ubicacion');
    this.subtitulo = ubicacion?.trim() || 'Registro de vehículos';

    this.aeseNcorr =
      Number.isFinite(aeseParsed) && aeseParsed > 0 ? aeseParsed : null;
    this.acreNcorr =
      Number.isFinite(acreParsed) && acreParsed > 0 ? acreParsed : null;

    if (this.acreNcorr == null) {
      const acreDesdeAuth = await this.authService.resolverAcreNcorrParaOperar();
      this.acreNcorr = acreNcorrValidoParaRequest(acreDesdeAuth)
        ? acreDesdeAuth
        : null;
    }

    if (
      !acreNcorrValidoParaRequest(this.acreNcorr) &&
      (this.aeseNcorr == null || this.aeseNcorr <= 0)
    ) {
      this.errorCupos = 'Estacionamiento no válido.';
      return;
    }

    this.busqueda = '';
    this.catalogoSub?.unsubscribe();
    this.catalogoSub = this.offlineService.catalogoActualizado$.subscribe(() => {
      void this.refrescarDesdeCacheLocal();
    });
    void this.cargarDisponibilidad();
    void this.cargarVehiculosActivos(true);
  }

  ngOnDestroy(): void {
    this.catalogoSub?.unsubscribe();
    if (this.busquedaTimer) {
      clearTimeout(this.busquedaTimer);
    }
  }

  private async refrescarDesdeCacheLocal(): Promise<void> {
    if (await this.network.hayInternet()) {
      return;
    }

    await this.cargarDisponibilidadDesdeCache();
    await this.cargarVehiculosDesdeCache(true);
  }

  get hayMasVehiculos(): boolean {
    return (
      this.totalRegistrosVehiculos > 0 &&
      this.vehiculos.length < this.totalRegistrosVehiculos
    );
  }

  colorCirculo(c: CupoCategoriaView): string {
    return (COLORES[c.categoria] ?? COLORES_DEFAULT).circulo;
  }

  colorBarra(c: CupoCategoriaView): string {
    return (COLORES[c.categoria] ?? COLORES_DEFAULT).barra;
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

  limpiarBusqueda(): void {
    if (this.busquedaTimer) {
      clearTimeout(this.busquedaTimer);
    }
    this.busqueda = '';
    void this.cargarVehiculosActivos(true);
  }

  async cargarMasVehiculos(event: InfiniteScrollCustomEvent): Promise<void> {
    try {
      if (!this.hayMasVehiculos || this.cargandoMasVehiculos) {
        return;
      }

      await this.cargarVehiculosActivos(false);
    } finally {
      await event.target.complete();
      // Ionic a veces deja el infinite-scroll deshabilitado tras complete().
      event.target.disabled = !this.hayMasVehiculos;
    }
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
        this.estacionamientoService.registrarSalida(v.patente, {
          acreNcorr: this.acreNcorr,
          aeseNcorr: this.aeseNcorr,
        })
      );
      await this.ui.dismissLoading(loading);

      await this.ui.presentToast(
        res.message ?? 'Salida registrada correctamente.',
        {
          color: 'success',
          duration: 2500,
        }
      );

      this.vehiculos = this.vehiculos.filter(x => x.patente !== v.patente);
      this.totalRegistrosVehiculos = Math.max(0, this.totalRegistrosVehiculos - 1);
      void this.refrescarDetalle();
    } catch (err: unknown) {
      await this.ui.dismissLoading(loading);
      await this.ui.presentToast(
        mensajeErrorUsuario(err, 'No se pudo registrar la salida.'),
        { color: 'danger' }
      );
    }
  }

  volver(): void {
    this.navCtrl.back();
  }

  reintentarCupos(): void {
    void this.cargarDisponibilidad();
  }

  reintentarVehiculos(): void {
    void this.cargarVehiculosActivos(true);
  }

  async refrescarDetalle(event?: RefresherCustomEvent): Promise<void> {
    if (
      !acreNcorrValidoParaRequest(this.acreNcorr) &&
      (this.aeseNcorr == null || this.aeseNcorr <= 0)
    ) {
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
    if (
      !acreNcorrValidoParaRequest(this.acreNcorr) &&
      (this.aeseNcorr == null || this.aeseNcorr <= 0)
    ) {
      this.cupos = [];
      this.errorCupos = 'Estacionamiento no válido.';
      return;
    }

    if (!opciones?.silencioso) {
      this.cargandoCupos = true;
    }
    this.errorCupos = null;

    const hayInternet = await this.network.hayInternet();
    if (!hayInternet) {
      await this.cargarDisponibilidadDesdeCache();
      if (!opciones?.silencioso) {
        this.cargandoCupos = false;
      }
      return;
    }

    try {
      const data = await firstValueFrom(
        this.estacionamientoService.obtenerDisponibilidad(
          {
            acreNcorr: this.acreNcorr,
            aeseNcorr: this.aeseNcorr,
          },
          this.nombre
        )
      );

      this.aplicarDisponibilidad(data);
    } catch (err: unknown) {
      if (await this.cargarDisponibilidadDesdeCache()) {
        return;
      }
      this.cupos = [];
      this.errorCupos = mensajeErrorUsuario(
        err,
        'No se pudo cargar la disponibilidad.'
      );
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
    if (
      !acreNcorrValidoParaRequest(this.acreNcorr) &&
      (this.aeseNcorr == null || this.aeseNcorr <= 0)
    ) {
      if (reset) {
        this.vehiculos = [];
        this.totalRegistrosVehiculos = 0;
        this.totalPaginasVehiculos = 0;
        this.errorVehiculos = 'Estacionamiento no válido.';
      }
      return;
    }

    if (reset) {
      this.paginaVehiculos = 1;
      if (!opciones?.silencioso) {
        this.cargandoVehiculos = true;
      }
      this.errorVehiculos = null;
    } else {
      if (!this.hayMasVehiculos) {
        return;
      }
      this.cargandoMasVehiculos = true;
      this.paginaVehiculos += 1;
    }

    const hayInternet = await this.network.hayInternet();
    if (!hayInternet) {
      await this.cargarVehiculosDesdeCache(reset);
      if (reset) {
        if (!opciones?.silencioso) {
          this.cargandoVehiculos = false;
        }
      } else {
        this.cargandoMasVehiculos = false;
      }
      return;
    }

    try {
      const data = await firstValueFrom(
        this.estacionamientoService.listarVehiculosActivos({
          page: this.paginaVehiculos,
          pageSize: this.pageSizeVehiculos,
          patente: this.busqueda.trim() || undefined,
          ...(acreNcorrValidoParaRequest(this.acreNcorr)
            ? { acreNcorr: this.acreNcorr! }
            : {}),
          ...(this.aeseNcorr != null && this.aeseNcorr > 0
            ? { aeseNcorr: this.aeseNcorr }
            : {}),
        })
      );

      const agregados = this.aplicarVehiculosActivos(data, reset);

      // Si la API no avanzó (página vacía o repetida), no seguir pidiendo.
      if (!reset && agregados === 0) {
        this.totalRegistrosVehiculos = this.vehiculos.length;
        return;
      }

      // Primera página lista: quitar skeleton y completar el resto detrás.
      if (reset && !opciones?.silencioso) {
        this.cargandoVehiculos = false;
      }

      if (reset && this.hayMasVehiculos) {
        await this.cargarPaginasRestantesVehiculos();
      }
    } catch (err: unknown) {
      if (!reset) {
        this.paginaVehiculos = Math.max(1, this.paginaVehiculos - 1);
      }
      if (reset && (await this.cargarVehiculosDesdeCache(true))) {
        return;
      }
      if (reset) {
        this.vehiculos = [];
        this.totalRegistrosVehiculos = 0;
        this.totalPaginasVehiculos = 0;
        this.errorVehiculos = mensajeErrorUsuario(
          err,
          'No se pudieron cargar los vehículos activos.'
        );
      } else {
        await this.ui.presentToast(
          mensajeErrorUsuario(err, 'No se pudieron cargar más vehículos.'),
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

  /** Carga páginas siguientes hasta completar totalRegistros. */
  private async cargarPaginasRestantesVehiculos(): Promise<void> {
    this.cargandoMasVehiculos = true;
    try {
      while (this.hayMasVehiculos) {
        this.paginaVehiculos += 1;
        const data = await firstValueFrom(
          this.estacionamientoService.listarVehiculosActivos({
            page: this.paginaVehiculos,
            pageSize: this.pageSizeVehiculos,
            patente: this.busqueda.trim() || undefined,
            ...(acreNcorrValidoParaRequest(this.acreNcorr)
              ? { acreNcorr: this.acreNcorr! }
              : {}),
            ...(this.aeseNcorr != null && this.aeseNcorr > 0
              ? { aeseNcorr: this.aeseNcorr }
              : {}),
          })
        );

        const agregados = this.aplicarVehiculosActivos(data, false);
        if (agregados === 0) {
          this.totalRegistrosVehiculos = this.vehiculos.length;
          break;
        }
      }
    } catch {
      // Deja lo ya cargado; el infinite-scroll puede reintentar.
      this.paginaVehiculos = Math.max(1, this.paginaVehiculos - 1);
    } finally {
      this.cargandoMasVehiculos = false;
    }
  }

  private aplicarDisponibilidad(
    data: { nombre: string; jornada: string | null; cupos: CupoCategoriaView[] }
  ): void {
    this.nombre = data.nombre;
    this.jornada = data.jornada;
    this.cupos = data.cupos;

    const ubicacion = this.route.snapshot.queryParamMap.get('ubicacion');
    const base = ubicacion?.trim() || 'Registro de vehículos';
    this.subtitulo = data.jornada ? `${base} · ${data.jornada}` : base;
  }

  private aplicarVehiculosActivos(
    data: {
      paginacion: {
        totalRegistros: number;
        totalPaginas: number;
        pagina: number;
      };
      vehiculos: VehiculoActivoView[];
    },
    reset: boolean
  ): number {
    if (reset) {
      this.totalRegistrosVehiculos = data.paginacion.totalRegistros;
      this.totalPaginasVehiculos = data.paginacion.totalPaginas;
      // La página la controlamos nosotros; no confiar en la respuesta.
      this.paginaVehiculos = 1;
      this.vehiculos = data.vehiculos;
      return data.vehiculos.length;
    }

    if (data.paginacion.totalRegistros > this.totalRegistrosVehiculos) {
      this.totalRegistrosVehiculos = data.paginacion.totalRegistros;
    }
    if (data.paginacion.totalPaginas > this.totalPaginasVehiculos) {
      this.totalPaginasVehiculos = data.paginacion.totalPaginas;
    }

    const vistos = new Set(
      this.vehiculos.map(v => v.patente.toUpperCase())
    );
    const nuevos = data.vehiculos.filter(v => {
      const clave = v.patente.toUpperCase();
      if (!clave || vistos.has(clave)) {
        return false;
      }
      vistos.add(clave);
      return true;
    });

    this.vehiculos = [...this.vehiculos, ...nuevos];
    return nuevos.length;
  }

  private async cargarDisponibilidadDesdeCache(): Promise<boolean> {
    const cacheKey = this.aeseNcorr ?? this.acreNcorr;
    if (cacheKey == null) {
      return false;
    }

    const cache = await this.offlineService.getEstacionamientoDetalleOffline(
      cacheKey
    );
    if (!cache?.disponibilidad) {
      this.cupos = [];
      this.errorCupos = 'No se pudo cargar la disponibilidad.';
      return false;
    }

    this.aplicarDisponibilidad(cache.disponibilidad);
    this.errorCupos = null;
    return true;
  }

  private async cargarVehiculosDesdeCache(reset: boolean): Promise<boolean> {
    const cacheKey = this.aeseNcorr ?? this.acreNcorr;
    if (cacheKey == null) {
      return false;
    }

    if (!reset) {
      return true;
    }

    const cache = await this.offlineService.getEstacionamientoDetalleOffline(
      cacheKey
    );
    if (!cache?.vehiculosActivos) {
      this.vehiculos = [];
      this.totalRegistrosVehiculos = 0;
      this.totalPaginasVehiculos = 0;
      this.errorVehiculos =
        'No se pudieron cargar los vehículos activos.';
      return false;
    }

    const patente = this.busqueda.trim().toUpperCase();
    let vehiculos = cache.vehiculosActivos.vehiculos;
    if (patente) {
      vehiculos = vehiculos.filter(v =>
        v.patente.toUpperCase().includes(patente)
      );
    }

    this.aplicarVehiculosActivos(
      {
        paginacion: {
          ...cache.vehiculosActivos.paginacion,
          totalRegistros: vehiculos.length,
          totalPaginas: 1,
          pagina: 1,
        },
        vehiculos,
      },
      true
    );
    this.errorVehiculos = null;
    return true;
  }
}
