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
    await this.navCtrl.navigateForward('/confirmacion', {
      queryParams: {
        nombre: this.nombre ?? 'Visitante',
        sede: e.ubicacion,
        perfil: 'Visita',
        aeseNcorr: e.id,
        estacionamiento: e.nombre,
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
