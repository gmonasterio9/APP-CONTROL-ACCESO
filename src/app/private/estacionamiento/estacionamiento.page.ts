import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';
import { firstValueFrom, Subscription } from 'rxjs';
import { EstacionamientoCard } from '../../core/models/estacionamiento.model';
import { EstacionamientoIngresoRequest } from '../../core/models/estacionamiento-ingreso.model';
import {
  ingresoManualFueRegistrado,
  IngresoManualVehiculosRequest,
  normalizarObservaciones,
  resolverPerfilIngresoManual,
  TipoMedioVehiculo,
  TipoPersonaIngreso,
} from '../../core/models/ingreso-manual.model';
import { mensajeErrorUsuario } from '../../core/utils/api-response.util';
import { AuthService } from '../../core/services/auth.service';
import { acreNcorrValidoParaRequest } from '../../core/utils/acre-ncorr.util';
import { EstacionamientoService } from '../../core/services/estacionamiento.service';
import { IngresoManualService } from '../../core/services/ingreso-manual.service';
import { NetworkService } from '../../core/services/network.service';
import { OfflineService } from '../../core/services/offline.service';
import { UiService } from '../../core/services/ui.service';
import { PatenteUtil } from '../../core/utils/patente.util';

@Component({
  selector: 'app-estacionamiento',
  templateUrl: 'estacionamiento.page.html',
  styleUrls: ['estacionamiento.page.scss'],
  standalone: false,
})
export class EstacionamientoPage implements OnDestroy {
  nombre: string | null = null;
  credencial: string | null = null;
  patente: string | null = null;
  rut: string | null = null;
  perfil: string | null = null;
  origen: string | null = null;
  estadoScan: string | null = null;
  persNcorr: number | null = null;

  /** Flujo: ingreso manual → seleccionar estacionamiento → registrar. */
  modoIngresoManual = false;
  private imTipoPersona: TipoPersonaIngreso | null = null;
  private imTipoMedio: TipoMedioVehiculo | null = null;
  private imObservaciones = '';

  estacionamientos: EstacionamientoCard[] = [];
  cargandoEstacionamientos = false;
  errorEstacionamientos: string | null = null;
  private catalogoSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private ui: UiService,
    private authService: AuthService,
    private network: NetworkService,
    private offlineService: OfflineService,
    private estacionamientoService: EstacionamientoService,
    private ingresoManualService: IngresoManualService
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

    this.modoIngresoManual =
      this.route.snapshot.queryParamMap.get('modo') === 'ingreso-manual';
    if (this.modoIngresoManual) {
      const tipoPersona = this.route.snapshot.queryParamMap.get('tipoPersona');
      const tipoMedio = this.route.snapshot.queryParamMap.get('tipoMedio');
      this.imTipoPersona = (tipoPersona as TipoPersonaIngreso) || null;
      this.imTipoMedio =
        tipoMedio === 'auto' || tipoMedio === 'moto' || tipoMedio === 'bicicleta'
          ? tipoMedio
          : null;
      this.imObservaciones = normalizarObservaciones(
        this.route.snapshot.queryParamMap.get('observaciones') ?? ''
      );
    }
  }

  ionViewWillEnter(): void {
    this.catalogoSub?.unsubscribe();
    this.catalogoSub = this.offlineService.catalogoActualizado$.subscribe(() => {
      void this.refrescarDesdeCacheLocal();
    });
    void this.inicializarPagina();
  }

  ngOnDestroy(): void {
    this.catalogoSub?.unsubscribe();
  }

  private async refrescarDesdeCacheLocal(): Promise<void> {
    if (await this.network.hayInternet()) {
      return;
    }

    await this.cargarEstacionamientosDesdeCache();
  }

  private async inicializarPagina(): Promise<void> {
    await this.cargarEstacionamientos();
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

    if (this.modoIngresoManual) {
      await this.registrarDesdeIngresoManual(e);
      return;
    }

    await this.ingresar(e);
  }

  private async registrarDesdeIngresoManual(
    e: EstacionamientoCard
  ): Promise<void> {
    if (!this.imTipoPersona || !this.imTipoMedio) {
      await this.ui.presentToast('Faltan datos del ingreso manual.', {
        color: 'warning',
      });
      return;
    }

    const rut = String(this.rut ?? '').trim();
    const nombre = (this.nombre ?? '').trim();
    if (!rut || !nombre) {
      await this.ui.presentToast(
        'Faltan RUT o nombre para registrar el ingreso.',
        { color: 'warning' }
      );
      return;
    }

    const acreNcorr = acreNcorrValidoParaRequest(e.acreNcorr)
      ? e.acreNcorr
      : undefined;

    const body: IngresoManualVehiculosRequest = {
      tipoPersona: this.imTipoPersona,
      tipoMedio: this.imTipoMedio,
      rut,
      nombre,
      observaciones: this.imObservaciones,
      ...(acreNcorr != null ? { acreNcorr } : {}),
    };

    if (this.imTipoMedio === 'auto' || this.imTipoMedio === 'moto') {
      const patente = PatenteUtil.toApi(String(this.patente ?? ''));
      if (!patente) {
        await this.ui.presentToast('Falta la patente.', { color: 'warning' });
        return;
      }
      body.patente = patente;
    }

    const loading = await this.ui.presentLoading('Registrando ingreso...');

    try {
      const res = await firstValueFrom(this.ingresoManualService.registrar(body));
      await this.ui.dismissLoading(loading);

      if (!ingresoManualFueRegistrado(res)) {
        await this.ui.presentToast(
          res.message || 'No se pudo registrar el ingreso.',
          { color: 'warning' }
        );
        return;
      }

      const sede = await this.authService.getSede();
      await this.navCtrl.navigateRoot('/confirmacion', {
        queryParams: {
          nombre,
          sede: sede?.nombre ?? e.ubicacion,
          perfil: this.perfil ?? this.imTipoPersona,
          patente: body.patente ?? null,
        },
      });
    } catch (err: unknown) {
      await this.ui.dismissLoading(loading);
      await this.ui.presentToast(
        mensajeErrorUsuario(err, 'Error al registrar el ingreso.'),
        { color: 'danger' }
      );
    }
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
      const acreDesdeAuth = await this.authService.resolverAcreNcorrParaOperar();
      const acreNcorr = acreNcorrValidoParaRequest(e.acreNcorr)
        ? e.acreNcorr
        : acreNcorrValidoParaRequest(acreDesdeAuth)
          ? acreDesdeAuth
          : null;
      await this.navCtrl.navigateForward('/ingreso-manual', {
        queryParams: {
          nombre: nombreReal,
          rut: this.rut,
          patente: this.patente,
          perfil,
          tipoMedio: this.patente
            ? PatenteUtil.inferirMedio(PatenteUtil.toApi(this.patente)) ?? 'auto'
            : null,
          aeseNcorr: e.aeseNcorr,
          acreNcorr,
          estacionamiento: e.nombre,
          origen: this.origen,
        },
      });
      return;
    }

    const nombre = nombreReal ?? (this.patente ? this.patente : 'Visitante');

    const body = await this.buildIngresoBody(e);
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
        mensajeErrorUsuario(err, 'Error al confirmar el ingreso.'),
        { color: 'danger' }
      );
    }
  }

  private async buildIngresoBody(
    e: EstacionamientoCard
  ): Promise<EstacionamientoIngresoRequest | null> {
    // Preferir acreNcorr del estacionamiento seleccionado; si no, el de sesión; si no, omitir.
    const acreDesdeAuth = await this.authService.resolverAcreNcorrParaOperar();
    const acreNcorr = acreNcorrValidoParaRequest(e.acreNcorr)
      ? e.acreNcorr
      : acreNcorrValidoParaRequest(acreDesdeAuth)
        ? acreDesdeAuth
        : undefined;

    const patente = PatenteUtil.toApi(String(this.patente ?? ''));
    if (patente) {
      return acreNcorr != null ? { patente, acreNcorr } : { patente };
    }
    if (this.persNcorr != null && this.persNcorr > 0) {
      return acreNcorr != null
        ? { persNcorr: this.persNcorr, acreNcorr }
        : { persNcorr: this.persNcorr };
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
    if (this.modoIngresoManual) {
      void this.navCtrl.back();
      return;
    }
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
      const acreNcorr = this.modoIngresoManual
        ? undefined
        : await this.authService.resolverAcreNcorrParaOperar();
      this.estacionamientos = await firstValueFrom(
        this.estacionamientoService.listar(
          acreNcorrValidoParaRequest(acreNcorr) ? acreNcorr : undefined
        )
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
        'No hay estacionamientos disponibles.';
      return false;
    }

    this.estacionamientos = [...cache];
    this.errorEstacionamientos = null;
    return true;
  }
}
