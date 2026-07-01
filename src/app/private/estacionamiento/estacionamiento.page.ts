import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { EstacionamientoCard } from '../../core/models/estacionamiento.model';
import { EstacionamientoIngresoRequest } from '../../core/models/estacionamiento-ingreso.model';
import { mensajeErrorUsuario } from '../../core/utils/api-response.util';
import { AuthService } from '../../core/services/auth.service';
import { EstacionamientoService } from '../../core/services/estacionamiento.service';
import { NetworkService } from '../../core/services/network.service';
import { OfflineService } from '../../core/services/offline.service';
import {
  esPostEncoladoOffline,
  MENSAJE_POST_ENCOLADO,
} from '../../core/models/offline-cola.model';
import { UiService } from '../../core/services/ui.service';
import { resolverPerfilIngresoManual } from '../../core/models/ingreso-manual.model';
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
    private network: NetworkService,
    private offlineService: OfflineService,
    private estacionamientoService: EstacionamientoService
  ) {
    this.nombre = this.route.snapshot.queryParamMap.get('nombre');
    this.credencial = this.route.snapshot.queryParamMap.get('credencial');
    this.patente = this.route.snapshot.queryParamMap.get('patente');
    this.rut = this.route.snapshot.queryParamMap.get('rut');
    this.perfil = this.route.snapshot.queryParamMap.get('perfil');
    this.origen = this.route.snapshot.queryParamMap.get('origen');
    this.estadoScan = this.route.snapshot.queryParamMap.get('estado');
    const persNcorrParam = this.route.snapshot.queryParamMap.get('persNcorr');
    const persParsed = persNcorrParam != null ? Number(persNcorrParam) : NaN;
    this.persNcorr =
      Number.isFinite(persParsed) && persParsed > 0 ? persParsed : null;
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
    return e.cuposDisponibles > 0 ? '#4CAF50' : '#C00';
  }

  async seleccionarEstacionamiento(e: EstacionamientoCard): Promise<void> {
    if (e.cuposDisponibles === 0) {
      await this.ui.presentToast(
        'No hay cupos disponibles en este estacionamiento.',
        { color: 'warning', duration: 2500 }
      );
      return;
    }

    await this.ingresar(e);
  }

  async ingresar(e: EstacionamientoCard): Promise<void> {
    if (e.cuposDisponibles === 0) {
      await this.ui.presentToast(
        'No hay cupos disponibles en este estacionamiento.',
        { color: 'warning', duration: 2500 }
      );
      return;
    }

    const rechazado =
      this.estadoScan === 'no_autorizado' || this.estadoScan === 'manual';
    const perfil = rechazado
      ? resolverPerfilIngresoManual({
          perfil: this.perfil,
          estado: 'no_autorizado',
          origen: this.origen,
        }) ?? undefined
      : this.perfil ?? undefined;
    const nombreReal = (this.nombre ?? '').trim() || null;

    if (rechazado) {
      await this.navCtrl.navigateForward('/ingreso-manual', {
        queryParams: {
          nombre: nombreReal,
          rut: this.rut,
          patente: this.patente,
          perfil,
          tipoMedio: this.patente
            ? PatenteUtil.inferirMedio(PatenteUtil.toApi(this.patente)) ?? 'auto'
            : null,
          aeseNcorr: e.id,
          estacionamiento: e.nombre,
          origen: this.origen,
        },
      });
      return;
    }

    const nombre = nombreReal ?? (this.patente ? this.patente : 'Visitante');

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

      if (esPostEncoladoOffline(res)) {
        await this.ui.presentToast(res.message ?? MENSAJE_POST_ENCOLADO, {
          color: 'warning',
          duration: 3000,
        });
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
        mensajeErrorUsuario(err, 'Error al confirmar el ingreso.'),
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
    void this.navCtrl.navigateForward('/scanner', {
      queryParams: {
        modo: 'acompanantes',
        retNombre: this.nombre,
        retPatente: this.patente,
        retRut: this.rut,
        retPerfil: this.perfil,
        retOrigen: this.origen,
        retEstado: this.estadoScan,
        retPersNcorr:
          this.persNcorr != null ? String(this.persNcorr) : null,
        retCredencial: this.credencial,
      },
    });
  }

  volver(): void {
    void this.navCtrl.navigateRoot('/home');
  }

  async cargarEstacionamientos(): Promise<void> {
    this.cargandoEstacionamientos = true;
    this.errorEstacionamientos = null;

    const hayInternet = await this.network.hayInternet();
    if (!hayInternet) {
      await this.cargarEstacionamientosDesdeCache();
      this.cargandoEstacionamientos = false;
      return;
    }

    try {
      this.estacionamientos = await firstValueFrom(
        this.estacionamientoService.listar()
      );
    } catch (err: unknown) {
      if (!(await this.cargarEstacionamientosDesdeCache())) {
        this.estacionamientos = [];
        this.errorEstacionamientos = mensajeErrorUsuario(
          err,
          'No se pudieron cargar los estacionamientos.'
        );
      }
    } finally {
      this.cargandoEstacionamientos = false;
    }
  }

  private async cargarEstacionamientosDesdeCache(): Promise<boolean> {
    const cache = await this.offlineService.getEstacionamientosOffline();
    if (!cache.length) {
      this.estacionamientos = [];
      this.errorEstacionamientos =
        'No hay estacionamientos guardados. Sincroniza al iniciar sesión con internet.';
      return false;
    }

    this.estacionamientos = [...cache];
    this.errorEstacionamientos = null;
    return true;
  }

}
