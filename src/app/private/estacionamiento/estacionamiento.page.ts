import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { EstacionamientoCard } from '../../core/models/estacionamiento.model';
import { ApiHttpError } from '../../core/services/api-http.service';
import { EstacionamientoService } from '../../core/services/estacionamiento.service';

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

    await this.navCtrl.navigateForward('/confirmacion', {
      queryParams: {
        nombre,
        sede: e.ubicacion,
        perfil,
        patente: this.patente,
        aeseNcorr: e.id,
        estacionamiento: e.nombre,
        estado: this.estadoScan ?? 'autorizado',
      },
    });
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
