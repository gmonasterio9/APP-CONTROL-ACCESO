import { Component } from '@angular/core';
import {
  InfiniteScrollCustomEvent,
  NavController,
  RefresherCustomEvent,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import {
  PeatonalAccesoEstado,
  PeatonalAccesoView,
} from '../../core/models/peatonal-detalle.model';
import { PeatonalStatCard } from '../../core/models/peatonal-resumen.model';
import { mensajeErrorUsuario } from '../../core/utils/api-response.util';
import { PeatonalService } from '../../core/services/peatonal.service';
import { UiService } from '../../core/services/ui.service';

@Component({
  selector: 'app-acceso-peatonal-detalle',
  templateUrl: 'acceso-peatonal-detalle.page.html',
  styleUrls: ['acceso-peatonal-detalle.page.scss'],
  standalone: false,
})
export class AccesoPeatonalDetallePage {
  readonly statsSkeleton = [0, 1, 2, 3, 4];
  readonly accesosSkeleton = [0, 1, 2];

  stats: PeatonalStatCard[] = [];
  accesos: PeatonalAccesoView[] = [];
  fecha: string | null = null;

  pagina = 1;
  readonly pageSize = 10;
  totalRegistros = 0;
  totalPaginas = 0;

  cargando = false;
  cargandoMas = false;
  error: string | null = null;

  constructor(
    private navCtrl: NavController,
    private peatonalService: PeatonalService,
    private ui: UiService
  ) {}

  ionViewWillEnter(): void {
    void this.cargarDetalle(true);
  }

  get hayMasAccesos(): boolean {
    if (this.totalPaginas > 0) {
      return this.pagina < this.totalPaginas;
    }
    return this.totalRegistros > 0 && this.accesos.length < this.totalRegistros;
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

  muestraNombreRut(acceso: PeatonalAccesoView): boolean {
    return acceso.estado === 'manual' || acceso.estado === 'visita';
  }

  muestraTipoQr(acceso: PeatonalAccesoView): boolean {
    if (!acceso.tipoQrLabel) {
      return false;
    }
    return (
      acceso.estado === 'permitido' ||
      acceso.estado === 'rechazado' ||
      acceso.estado === 'expirado'
    );
  }

  volver(): void {
    this.navCtrl.back();
  }

  async refrescar(event?: RefresherCustomEvent): Promise<void> {
    await this.cargarDetalle(true, { silencioso: true });
    await event?.target.complete();
  }

  async cargarMasAccesos(event?: InfiniteScrollCustomEvent): Promise<void> {
    if (!this.hayMasAccesos || this.cargandoMas) {
      await event?.target.complete();
      return;
    }

    this.pagina += 1;
    await this.cargarDetalle(false);
    await event?.target.complete();
  }

  async cargarMasManual(): Promise<void> {
    if (!this.hayMasAccesos || this.cargandoMas) {
      return;
    }
    this.pagina += 1;
    await this.cargarDetalle(false);
  }

  reintentar(): void {
    void this.cargarDetalle(true);
  }

  private async cargarDetalle(
    reset: boolean,
    opciones?: { silencioso?: boolean }
  ): Promise<void> {
    if (reset) {
      this.pagina = 1;
      if (!opciones?.silencioso) {
        this.cargando = true;
      }
      this.error = null;
    } else {
      this.cargandoMas = true;
    }

    try {
      const data = await firstValueFrom(
        this.peatonalService.obtenerDetalle({
          page: this.pagina,
          pageSize: this.pageSize,
        })
      );

      this.stats = data.stats;
      this.fecha = data.fecha ?? null;
      this.totalRegistros = data.paginacion.totalRegistros;
      this.totalPaginas = data.paginacion.totalPaginas;
      this.pagina = data.paginacion.pagina;

      if (reset) {
        this.accesos = data.accesos;
      } else {
        this.accesos = [...this.accesos, ...data.accesos];
      }
    } catch (err: unknown) {
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
      if (reset) {
        if (!opciones?.silencioso) {
          this.cargando = false;
        }
      } else {
        this.cargandoMas = false;
      }
    }
  }

}
