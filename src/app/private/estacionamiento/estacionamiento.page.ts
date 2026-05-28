import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { EstacionamientoCard } from '../../core/models/estacionamiento.model';
import { ControlIngresoOrigen } from '../../core/models/control-ingreso.model';
import { ApiHttpError } from '../../core/services/api-http.service';
import { AuthService } from '../../core/services/auth.service';
import { ControlIngresoService } from '../../core/services/control-ingreso.service';
import { EstacionamientoService } from '../../core/services/estacionamiento.service';
import { UiService } from '../../core/services/ui.service';

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

  estacionamientos: EstacionamientoCard[] = [];
  cargandoEstacionamientos = false;
  errorEstacionamientos: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private ui: UiService,
    private authService: AuthService,
    private controlIngresoService: ControlIngresoService,
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
    const perfil = this.perfil ?? 'Visita';
    const nombre = this.nombre ?? (this.patente ? this.patente : 'Visitante');
    const rechazado =
      this.estadoScan === 'no_autorizado' || this.estadoScan === 'manual';

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

    const rut = String(this.rut ?? '').trim();
    if (!rut) {
      await this.ui.presentToast('Faltan datos para registrar el ingreso.', {
        color: 'warning',
      });
      return;
    }

    const loading = await this.ui.presentLoading('Registrando ingreso...');

    try {
      const res = await firstValueFrom(
        this.controlIngresoService.registrar({
          rut,
          nombre,
          tipoMedio: 'auto',
          perfil,
          patente: this.patente ?? undefined,
          codigoCredencial: this.credencial ?? undefined,
          aeseNcorr: e.id,
          origen: this.origen as ControlIngresoOrigen | undefined,
        })
      );
      await this.ui.dismissLoading(loading);

      if (!res.success) {
        await this.ui.presentToast(
          res.message || 'No se pudo registrar el ingreso.',
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
        this.extraerMensajeError(err) || 'Error al registrar el ingreso.',
        { color: 'danger' }
      );
    }
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
