import { Component, OnDestroy, ViewChild } from '@angular/core';
import {
  InfiniteScrollCustomEvent,
  IonInfiniteScroll,
  NavController,
  RefresherCustomEvent,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import {
  PeatonalAccesoEstado,
  PeatonalAccesoView,
  PeatonalDetalleQuery,
} from '../../core/models/peatonal-detalle.model';
import { PeatonalStatCard } from '../../core/models/peatonal-resumen.model';
import { mensajeErrorUsuario } from '../../core/utils/api-response.util';
import { NetworkService } from '../../core/services/network.service';
import { OfflineService } from '../../core/services/offline.service';
import { PeatonalService } from '../../core/services/peatonal.service';
import { UiService } from '../../core/services/ui.service';

const BUSQUEDA_DEBOUNCE_MS = 400;

@Component({
  selector: 'app-acceso-peatonal-detalle',
  templateUrl: 'acceso-peatonal-detalle.page.html',
  styleUrls: ['acceso-peatonal-detalle.page.scss'],
  standalone: false,
})
export class AccesoPeatonalDetallePage implements OnDestroy {
  @ViewChild(IonInfiniteScroll) infiniteScroll?: IonInfiniteScroll;

  readonly statsSkeleton = [0, 1, 2];
  readonly accesosSkeleton = [0, 1, 2];

  stats: PeatonalStatCard[] = [];
  accesos: PeatonalAccesoView[] = [];
  fecha: string | null = null;
  busqueda = '';
  filtroEstado: PeatonalAccesoEstado | null = null;

  get fechaDisplay(): string | null {
    if (!this.fecha) {
      return null;
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(this.fecha.trim());
    if (!match) {
      return this.fecha;
    }

    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  pagina = 1;
  readonly pageSize = 50;
  totalRegistros = 0;
  totalPaginas = 0;

  cargando = false;
  cargandoMas = false;
  error: string | null = null;

  private busquedaTimer?: ReturnType<typeof setTimeout>;
  private cargaId = 0;

  constructor(
    private navCtrl: NavController,
    private network: NetworkService,
    private offlineService: OfflineService,
    private peatonalService: PeatonalService,
    private ui: UiService
  ) {}

  ionViewWillEnter(): void {
    void this.cargarDetalle(true);
  }

  ngOnDestroy(): void {
    if (this.busquedaTimer) {
      clearTimeout(this.busquedaTimer);
    }
    this.cargaId += 1;
  }

  get hayMasAccesos(): boolean {
    const pagina = Number(this.pagina) || 1;
    const totalPaginas = Number(this.totalPaginas) || 0;
    const totalRegistros = Number(this.totalRegistros) || 0;

    if (totalPaginas > 0) {
      return pagina < totalPaginas;
    }
    return totalRegistros > 0 && this.accesos.length < totalRegistros;
  }

  get accesosFiltrados(): PeatonalAccesoView[] {
    return this.accesos.filter(acceso => this.coincideFiltros(acceso));
  }

  get mensajeSinResultados(): string {
    if (this.busqueda.trim() || this.filtroEstado) {
      return 'Sin resultados para la búsqueda';
    }
    return 'Sin accesos registrados';
  }

  private get tieneFiltroActivo(): boolean {
    return !!this.busqueda.trim() || !!this.filtroEstado;
  }

  onBusqueda(event: Event): void {
    this.busqueda = (event.target as HTMLInputElement | null)?.value ?? '';
    this.programarBusquedaServidor();
  }

  limpiarBusqueda(): void {
    if (this.busquedaTimer) {
      clearTimeout(this.busquedaTimer);
    }
    this.busqueda = '';
    void this.cargarDetalle(true, { silencioso: true });
  }

  estadoDeStat(stat: PeatonalStatCard): PeatonalAccesoEstado | null {
    switch (stat.label) {
      case 'Autorizados':
        return 'permitido';
      case 'Visitas':
        return 'visita';
      case 'Ingreso Manual':
        return 'manual';
      default:
        return null;
    }
  }

  alternarFiltro(stat: PeatonalStatCard): void {
    const estado = this.estadoDeStat(stat);
    if (!estado) {
      return;
    }
    this.filtroEstado = this.filtroEstado === estado ? null : estado;
    this.programarBusquedaServidor(0);
  }

  chipLabel(estado: PeatonalAccesoEstado): string {
    return {
      permitido: 'Permitido',
      manual: 'Manual',
      visita: 'Visita',
      rechazado: 'Rechazado',
      expirado: 'Expirado',
    }[estado];
  }

  verRegistro(acceso: PeatonalAccesoView): void {
    void this.navCtrl.navigateForward('/acceso-peatonal-registro', {
      queryParams: {
        apesNcorr: acceso.apesNcorr,
        nombre: acceso.nombre,
        rut: acceso.rut,
        tipoQr: acceso.tipoQrLabel ?? '',
        estado: acceso.estado,
        hora: acceso.hora,
        observacion: acceso.observacion ?? '',
      },
    });
  }

  volver(): void {
    this.navCtrl.back();
  }

  async refrescar(event?: RefresherCustomEvent): Promise<void> {
    await this.cargarDetalle(true, { silencioso: true });
    await event?.target.complete();
    this.activarInfiniteScrollSiCorresponde();
  }

  async cargarMasAccesos(event: InfiniteScrollCustomEvent): Promise<void> {
    try {
      if (!this.hayMasAccesos || this.cargandoMas || this.cargando) {
        return;
      }

      this.pagina += 1;
      await this.cargarDetalle(false);
    } finally {
      await event.target.complete();
      this.activarInfiniteScrollSiCorresponde();
    }
  }

  reintentar(): void {
    void this.cargarDetalle(true);
  }

  private programarBusquedaServidor(delayMs = BUSQUEDA_DEBOUNCE_MS): void {
    if (this.busquedaTimer) {
      clearTimeout(this.busquedaTimer);
    }

    this.busquedaTimer = setTimeout(() => {
      void this.cargarDetalle(true, { silencioso: true });
    }, delayMs);
  }

  private queryDetalle(): PeatonalDetalleQuery {
    return {
      page: this.pagina,
      pageSize: this.pageSize,
      q: this.busqueda.trim() || undefined,
      estado: this.filtroEstado ?? undefined,
    };
  }

  private async cargarDetalle(
    reset: boolean,
    opciones?: { silencioso?: boolean }
  ): Promise<void> {
    const cargaId = reset ? ++this.cargaId : this.cargaId;

    if (reset) {
      this.pagina = 1;
      if (!opciones?.silencioso) {
        this.cargando = true;
      }
      this.error = null;
    } else {
      this.cargandoMas = true;
    }

    const hayInternet = await this.network.hayInternet();
    if (!hayInternet) {
      await this.cargarDetalleDesdeCache(reset);
      if (reset) {
        if (!opciones?.silencioso) {
          this.cargando = false;
        }
      } else {
        this.cargandoMas = false;
      }
      return;
    }

    try {
      const data = await firstValueFrom(
        this.peatonalService.obtenerDetalle(this.queryDetalle())
      );

      if (cargaId !== this.cargaId) {
        return;
      }

      this.stats = data.stats;
      this.fecha = data.fecha ?? null;
      this.totalRegistros = Number(data.paginacion?.totalRegistros) || 0;
      this.totalPaginas =
        Number(data.paginacion?.totalPaginas) ||
        (this.totalRegistros > 0
          ? Math.ceil(this.totalRegistros / this.pageSize)
          : 0);
      this.pagina = Number(data.paginacion?.pagina) || this.pagina;

      if (reset) {
        this.accesos = data.accesos;
      } else {
        this.accesos = [...this.accesos, ...data.accesos];
      }

      if (reset && this.tieneFiltroActivo && this.hayMasAccesos) {
        if (!opciones?.silencioso) {
          this.cargando = false;
        }
        await this.cargarPaginasRestantes(cargaId);
      }
    } catch (err: unknown) {
      if (cargaId !== this.cargaId) {
        return;
      }
      if (reset && (await this.cargarDetalleDesdeCache(true))) {
        return;
      }
      if (reset) {
        this.stats = [];
        this.accesos = [];
        this.fecha = null;
        this.totalRegistros = 0;
        this.totalPaginas = 0;
        this.error = mensajeErrorUsuario(
          err,
          'No se pudo cargar el detalle peatonal.'
        );
      } else {
        this.pagina = Math.max(1, this.pagina - 1);
        await this.ui.presentToast(
          mensajeErrorUsuario(err, 'No se pudieron cargar más accesos.'),
          { color: 'warning' }
        );
      }
    } finally {
      if (cargaId === this.cargaId) {
        if (reset) {
          if (!opciones?.silencioso) {
            this.cargando = false;
          }
        } else {
          this.cargandoMas = false;
        }
        this.activarInfiniteScrollSiCorresponde();
      }
    }
  }

  private async cargarPaginasRestantes(cargaId: number): Promise<void> {
    this.cargandoMas = true;
    try {
      while (cargaId === this.cargaId && this.hayMasAccesos) {
        this.pagina += 1;
        const data = await firstValueFrom(
          this.peatonalService.obtenerDetalle(this.queryDetalle())
        );

        if (cargaId !== this.cargaId) {
          return;
        }

        const nuevos = data.accesos ?? [];
        if (nuevos.length === 0) {
          this.totalRegistros = this.accesos.length;
          break;
        }

        this.accesos = [...this.accesos, ...nuevos];
        this.totalRegistros = Number(data.paginacion?.totalRegistros) || this.totalRegistros;
        this.totalPaginas =
          Number(data.paginacion?.totalPaginas) ||
          (this.totalRegistros > 0
            ? Math.ceil(this.totalRegistros / this.pageSize)
            : this.totalPaginas);
        this.pagina = Number(data.paginacion?.pagina) || this.pagina;
      }
    } catch {
      this.pagina = Math.max(1, this.pagina - 1);
    } finally {
      if (cargaId === this.cargaId) {
        this.cargandoMas = false;
        this.activarInfiniteScrollSiCorresponde();
      }
    }
  }

  private activarInfiniteScrollSiCorresponde(): void {
    const deshabilitar = !this.hayMasAccesos;
    setTimeout(() => {
      if (this.infiniteScroll) {
        this.infiniteScroll.disabled = deshabilitar;
      }
    });
  }

  private coincideFiltros(acceso: PeatonalAccesoView): boolean {
    if (this.filtroEstado && acceso.estado !== this.filtroEstado) {
      return false;
    }

    const query = this.busqueda.trim();
    if (!query) {
      return true;
    }

    const queryNombre = this.normalizarTexto(query);
    const queryRut = this.normalizarRut(query);
    const nombre = this.normalizarTexto(acceso.nombre);
    const rut = this.normalizarRut(acceso.rut);

    return (
      (!!queryNombre && nombre.includes(queryNombre)) ||
      (!!queryRut && rut.includes(queryRut))
    );
  }

  private normalizarTexto(value: string): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
  }

  private normalizarRut(value: string): string {
    return String(value ?? '')
      .replace(/[^0-9kK]/gi, '')
      .toUpperCase();
  }

  private async cargarDetalleDesdeCache(reset: boolean): Promise<boolean> {
    if (!reset) {
      return true;
    }

    const cache = await this.offlineService.getDetallePeatonalOffline();
    if (!cache) {
      this.stats = [];
      this.accesos = [];
      this.fecha = null;
      this.totalRegistros = 0;
      this.totalPaginas = 0;
      this.error =
        'No se pudo cargar el detalle peatonal.';
      return false;
    }

    this.stats = cache.stats;
    this.fecha = cache.fecha ?? null;
    this.totalRegistros = cache.paginacion.totalRegistros;
    this.totalPaginas = cache.paginacion.totalPaginas;
    this.pagina = cache.paginacion.pagina;
    this.accesos = cache.accesos;
    this.error = null;
    return true;
  }

}
