import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { EstacionamientoCard } from '../../core/models/estacionamiento.model';
import { EstacionamientoIngresoRequest } from '../../core/models/estacionamiento-ingreso.model';
import { ApiHttpError } from '../../core/services/api-http.service';
import { AuthService } from '../../core/services/auth.service';
import { EstacionamientoService } from '../../core/services/estacionamiento.service';
import { UiService } from '../../core/services/ui.service';
import { PatenteUtil } from '../../core/utils/patente.util';

@Component({
  selector: 'app-estacionamiento',
  templateUrl: 'estacionamiento.page.html',
  styleUrls: ['estacionamiento.page.scss'],
  standalone: false,
})
export class EstacionamientoPage {
  nombre: string | null = null;
  credencial: string | null = null;
  patente: string | null = null;
  rut: string | null = null;
  perfil: string | null = null;
  origen: string | null = null;
  estadoScan: string | null = null;
  persNcorr: number | null = null;

  estacionamientos: EstacionamientoCard[] = [];
  cargandoEstacionamientos = false;
  errorEstacionamientos: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private ui: UiService,
    private authService: AuthService,
    private estacionamientoService: EstacionamientoService
  ) {
    this.nombre = this.route.snapshot.queryParamMap.get('nombre');
    this.credencial = this.route.snapshot.queryParamMap.get('credencial');
    this.patente = this.route.snapshot.queryParamMap.get('patente');
    this.rut = this.route.snapshot.queryParamMap.get('rut');
    this.perfil = this.route.snapshot.queryParamMap.get('perfil');
    this.origen = this.route.snapshot.queryParamMap.get('origen');
    this.estadoScan = this.route.snapshot.queryParamMap.get('estado');
  }

  ionViewWillEnter(): void {
    void this.cargarEstacionamientos();
  }

  porcentaje(e: EstacionamientoCard): number {
    if (!e.cuposTotales) {
      return 0;
    }
    return Math.round((e.cuposDisponibles / e.cuposTotales) * 100);
  }

  colorBarra(e: EstacionamientoCard): string {
    return e.cuposDisponibles > 0 ? '#4CAF50' : '#CC0000';
  }

  async ingresar(e: EstacionamientoCard): Promise<void> {
    const rechazado =
      this.estadoScan === 'no_autorizado' || this.estadoScan === 'manual';
    const perfil = this.perfil ?? (rechazado ? 'visita' : undefined);
    const nombre = this.nombre ?? (this.patente ? this.patente : 'Visitante');

    if (rechazado) {
      await this.navCtrl.navigateForward('/ingreso-manual', {
        queryParams: {
          nombre,
          rut: this.rut,
          patente: this.patente,
          perfil,
          tipoMedio: this.patente ? 'auto' : null,
          aeseNcorr: e.id,
          estacionamiento: e.nombre,
          origen: this.origen,
        },
      });
      return;
    }

    const body = this.buildIngresoBody();
    if (!body) {
      await this.ui.presentToast(
        'Faltan datos para confirmar el ingreso del vehículo.',
        { color: 'warning' }
      );
      return;
    }

    const loading = await this.ui.presentLoading('Confirmando ingreso...');

    try {
      const res = await firstValueFrom(
        this.estacionamientoService.registrarIngreso(body)
      );
      await this.ui.dismissLoading(loading);

      if (!res.success) {
        await this.ui.presentToast(
          res.message || 'No se pudo confirmar el ingreso.',
          { color: 'warning' }
        );
        return;
      }

      const sede = await this.authService.getSede();

      await this.navCtrl.navigateForward('/confirmacion', {
        queryParams: {
          nombre,
          sede: sede?.nombre ?? e.ubicacion,
          perfil,
          patente: this.patente,
        },
      });
    } catch (err: unknown) {
      await this.ui.dismissLoading(loading);
      await this.ui.presentToast(
        this.extraerMensajeError(err) || 'Error al confirmar el ingreso.',
        { color: 'danger' }
      );
    }
  }

  private buildIngresoBody(): EstacionamientoIngresoRequest | null {
    const patente = PatenteUtil.toApi(String(this.patente ?? ''));
    if (patente) {
      return { patente };
    }
    if (this.persNcorr != null && this.persNcorr > 0) {
      return { persNcorr: this.persNcorr };
    }
    return null;
  }

  registrarAcompanante(): void {
    this.navCtrl.navigateForward('/scanner');
  }

  volver(): void {
    this.navCtrl.back();
  }

  async cargarEstacionamientos(): Promise<void> {
    this.cargandoEstacionamientos = true;
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
      this.cargandoEstacionamientos = false;
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
