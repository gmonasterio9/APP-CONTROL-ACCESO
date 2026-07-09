import { Component, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  IonModal,
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

interface OpcionFiltro {
  value: string;
  label: string;
}

function normalizarClaveFiltro(valor?: string): string {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

@Component({
  selector: 'app-estacionamiento-detalle',
  templateUrl: 'estacionamiento-detalle.page.html',
  styleUrls: ['estacionamiento-detalle.page.scss'],
  standalone: false,
})
export class EstacionamientoDetallePage implements OnDestroy {
  @ViewChild('filtroModal') filtroModal?: IonModal;

  nombre = 'Estacionamiento';
  subtitulo = 'Registro de vehículos';
  busqueda = '';

  opcionesFiltroPersona: OpcionFiltro[] = [];
  opcionesFiltroIngreso: OpcionFiltro[] = [];

  filtroTipoPersona: string | null = null;
  filtroTipoIngreso: string | null = null;
  filtroTipoPersonaDraft: string | null = null;
  filtroTipoIngresoDraft: string | null = null;

  aeseNcorr: number | null = null;
  acreNcorr: number | null = null;
  jornada: string | null = null;
  cupos: CupoCategoriaView[] = [];
  vehiculos: VehiculoActivoView[] = [];

  paginaVehiculos = 1;
  readonly pageSizeVehiculos = 10;
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
    const recinto = await this.authService.getRecintoSeleccionado();
    this.acreNcorr = recinto?.id ?? 0;
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
    if (this.totalPaginasVehiculos > 0) {
      return this.paginaVehiculos < this.totalPaginasVehiculos;
    }
    return (
      this.totalRegistrosVehiculos > 0 &&
      this.vehiculos.length < this.totalRegistrosVehiculos
    );
  }

  get filtrosActivos(): boolean {
    return this.filtroTipoPersona != null || this.filtroTipoIngreso != null;
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

  async abrirFiltroModal(): Promise<void> {
    this.filtroTipoPersonaDraft = this.filtroTipoPersona;
    this.filtroTipoIngresoDraft = this.filtroTipoIngreso;
    this.actualizarOpcionesFiltroDesdeVehiculos(this.vehiculos);
    void this.cargarOpcionesFiltroDesdeFuente();
    await this.filtroModal?.present();
  }

  async cerrarFiltroModal(): Promise<void> {
    await this.filtroModal?.dismiss();
  }

  seleccionarFiltroPersona(value: string): void {
    this.filtroTipoPersonaDraft =
      this.filtroTipoPersonaDraft === value ? null : value;
  }

  seleccionarFiltroIngreso(value: string): void {
    this.filtroTipoIngresoDraft =
      this.filtroTipoIngresoDraft === value ? null : value;
  }

  async limpiarFiltrosModal(): Promise<void> {
    this.filtroTipoPersonaDraft = null;
    this.filtroTipoIngresoDraft = null;
    this.filtroTipoPersona = null;
    this.filtroTipoIngreso = null;
    await this.filtroModal?.dismiss();
    await this.cargarVehiculosActivos(true);
  }

  async aplicarFiltrosModal(): Promise<void> {
    this.filtroTipoPersona = this.filtroTipoPersonaDraft;
    this.filtroTipoIngreso = this.filtroTipoIngresoDraft;
    await this.filtroModal?.dismiss();
    await this.cargarVehiculosActivos(true);
  }

  async cargarMasVehiculos(event: InfiniteScrollCustomEvent): Promise<void> {
    try {
      if (!this.hayMasVehiculos || this.cargandoMasVehiculos) {
        return;
      }

      this.paginaVehiculos += 1;
      await this.cargarVehiculosActivos(false);
    } finally {
      await event.target.complete();
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
        this.estacionamientoService.registrarSalida(v.patente)
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
    if (this.acreNcorr == null || this.acreNcorr < 0) {
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
          this.acreNcorr,
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
    if (reset) {
      this.paginaVehiculos = 1;
      if (!opciones?.silencioso) {
        this.cargandoVehiculos = true;
      }
      this.errorVehiculos = null;
    } else {
      this.cargandoMasVehiculos = true;
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

    if (reset && this.filtrosActivos) {
      try {
        await this.cargarVehiculosConFiltroCliente();
      } catch (err: unknown) {
        if (await this.cargarVehiculosDesdeCache(true)) {
          return;
        }
        this.vehiculos = [];
        this.totalRegistrosVehiculos = 0;
        this.totalPaginasVehiculos = 0;
        this.errorVehiculos = mensajeErrorUsuario(
          err,
          'No se pudieron cargar los vehículos activos.'
        );
      } finally {
        if (!opciones?.silencioso) {
          this.cargandoVehiculos = false;
        }
      }
      return;
    }

    try {
      const data = await firstValueFrom(
        this.estacionamientoService.listarVehiculosActivos({
          page: this.paginaVehiculos,
          pageSize: this.pageSizeVehiculos,
          patente: this.busqueda.trim() || undefined,
          acreNcorr: this.acreNcorr ?? undefined,
        })
      );

      this.aplicarVehiculosActivos(data, reset);
    } catch (err: unknown) {
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
        this.paginaVehiculos = Math.max(1, this.paginaVehiculos - 1);
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
  ): void {
    this.totalRegistrosVehiculos = data.paginacion.totalRegistros;
    this.totalPaginasVehiculos = data.paginacion.totalPaginas;
    this.paginaVehiculos = data.paginacion.pagina;

    if (reset) {
      this.vehiculos = data.vehiculos;
    } else {
      this.vehiculos = [...this.vehiculos, ...data.vehiculos];
    }

    if (!this.filtrosActivos) {
      this.actualizarOpcionesFiltroDesdeVehiculos(this.vehiculos);
    }
  }

  private async cargarDisponibilidadDesdeCache(): Promise<boolean> {
    if (this.aeseNcorr == null) {
      return false;
    }

    const cache = await this.offlineService.getEstacionamientoDetalleOffline(
      this.aeseNcorr
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
    if (this.aeseNcorr == null) {
      return false;
    }

    if (!reset) {
      return true;
    }

    const cache = await this.offlineService.getEstacionamientoDetalleOffline(
      this.aeseNcorr
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
    const vehiculos = this.filtrarVehiculosLista(
      cache.vehiculosActivos.vehiculos
    );

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

  private async cargarVehiculosConFiltroCliente(): Promise<void> {
    const paramsBase = {
      patente: this.busqueda.trim() || undefined,
      acreNcorr: this.acreNcorr ?? undefined,
    };

    const primera = await firstValueFrom(
      this.estacionamientoService.listarVehiculosActivos({
        ...paramsBase,
        page: 1,
        pageSize: this.pageSizeVehiculos,
      })
    );

    const total = primera.paginacion.totalRegistros;
    let vehiculos = primera.vehiculos;

    if (total > vehiculos.length) {
      const completa = await firstValueFrom(
        this.estacionamientoService.listarVehiculosActivos({
          ...paramsBase,
          page: 1,
          pageSize: total,
        })
      );
      vehiculos = completa.vehiculos;
    }

    this.actualizarOpcionesFiltroDesdeVehiculos(vehiculos);
    const filtrados = this.filtrarVehiculosLista(vehiculos);

    this.aplicarVehiculosActivos(
      {
        paginacion: {
          totalRegistros: filtrados.length,
          totalPaginas: 1,
          pagina: 1,
        },
        vehiculos: filtrados,
      },
      true
    );
  }

  private filtrarVehiculosLista(
    vehiculos: VehiculoActivoView[]
  ): VehiculoActivoView[] {
    const patente = this.busqueda.trim().toUpperCase();
    let resultado = vehiculos;

    if (patente) {
      resultado = resultado.filter(v =>
        v.patente.toUpperCase().includes(patente)
      );
    }

    if (this.filtrosActivos) {
      resultado = resultado.filter(v => this.coincideFiltrosVehiculo(v));
    }

    return resultado;
  }

  private async cargarOpcionesFiltroDesdeFuente(): Promise<void> {
    try {
      const hayInternet = await this.network.hayInternet();
      if (!hayInternet) {
        const cache = this.aeseNcorr == null
          ? null
          : await this.offlineService.getEstacionamientoDetalleOffline(
              this.aeseNcorr
            );
        this.actualizarOpcionesFiltroDesdeVehiculos(
          cache?.vehiculosActivos?.vehiculos ?? this.vehiculos
        );
        return;
      }

      const paramsBase = {
        patente: this.busqueda.trim() || undefined,
        acreNcorr: this.acreNcorr ?? undefined,
      };
      const primera = await firstValueFrom(
        this.estacionamientoService.listarVehiculosActivos({
          ...paramsBase,
          page: 1,
          pageSize: this.pageSizeVehiculos,
        })
      );

      if (primera.paginacion.totalRegistros <= primera.vehiculos.length) {
        this.actualizarOpcionesFiltroDesdeVehiculos(primera.vehiculos);
        return;
      }

      const completa = await firstValueFrom(
        this.estacionamientoService.listarVehiculosActivos({
          ...paramsBase,
          page: 1,
          pageSize: primera.paginacion.totalRegistros,
        })
      );
      this.actualizarOpcionesFiltroDesdeVehiculos(completa.vehiculos);
    } catch {
      this.actualizarOpcionesFiltroDesdeVehiculos(this.vehiculos);
    }
  }

  private actualizarOpcionesFiltroDesdeVehiculos(
    vehiculos: VehiculoActivoView[]
  ): void {
    this.opcionesFiltroPersona = this.construirOpcionesFiltro(
      vehiculos.map(v => v.tipo)
    );
    this.opcionesFiltroIngreso = this.construirOpcionesFiltro(
      vehiculos.map(v => v.vehiculo)
    );

    if (
      this.filtroTipoPersona &&
      !this.opcionesFiltroPersona.some(o => o.value === this.filtroTipoPersona)
    ) {
      this.filtroTipoPersona = null;
      this.filtroTipoPersonaDraft = null;
    }

    if (
      this.filtroTipoIngreso &&
      !this.opcionesFiltroIngreso.some(o => o.value === this.filtroTipoIngreso)
    ) {
      this.filtroTipoIngreso = null;
      this.filtroTipoIngresoDraft = null;
    }
  }

  private construirOpcionesFiltro(valores: string[]): OpcionFiltro[] {
    const opciones = new Map<string, string>();
    for (const valor of valores) {
      const label = String(valor ?? '').trim();
      const value = normalizarClaveFiltro(label);
      if (!label || label === '—' || !value || opciones.has(value)) {
        continue;
      }
      opciones.set(value, label);
    }

    return Array.from(opciones.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }

  private coincideFiltrosVehiculo(v: VehiculoActivoView): boolean {
    if (
      this.filtroTipoPersona &&
      normalizarClaveFiltro(v.tipo) !== this.filtroTipoPersona
    ) {
      return false;
    }

    if (
      this.filtroTipoIngreso &&
      normalizarClaveFiltro(v.vehiculo) !== this.filtroTipoIngreso
    ) {
      return false;
    }

    return true;
  }

}
