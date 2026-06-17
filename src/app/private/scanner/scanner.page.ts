import { Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController, ModalController, Platform } from '@ionic/angular';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

import { firstValueFrom, Subscription } from 'rxjs';
import { PlateRecognizerService, PlateResult } from '../../core/services/plate-recognizer.service';
import { ValidarPerfilService } from '../../core/services/validar-perfil.service';
import { ValidarPatenteService } from '../../core/services/validar-patente.service';
import { UiService } from '../../core/services/ui.service';
import { ScanSoundService } from '../../core/services/scan-sound.service';
import { ValidarPerfilResponse } from '../../core/models/validar-perfil.model';
import { ValidarPatenteResponse } from '../../core/models/validar-patente.model';
import { PatenteUtil } from '../../core/utils/patente.util';
import { ValidarPatenteUtil } from '../../core/utils/validar-patente.util';
import { resolverPerfilIngresoManual } from '../../core/models/ingreso-manual.model';
import { ValidarPerfilUtil } from '../../core/utils/validar-perfil.util';
import { ScanPerfilUtil } from '../../core/utils/scan-perfil.util';
import { PeatonalEscaneoUtil } from '../../core/utils/peatonal-escaneo.util';
import { RutUtil } from '../../core/utils/rut.util';
import {
  peatonalControlIngresoFueExitoso,
  peatonalControlIngresoFueRegistrado,
  PeatonalControlIngresoRequest,
  ResultadoControlPeatonal,
} from '../../core/models/peatonal-control-ingreso.model';
import { mensajeErrorUsuario } from '../../core/utils/api-response.util';
import { AuthService } from '../../core/services/auth.service';
import { NetworkService } from '../../core/services/network.service';
import { OfflineService } from '../../core/services/offline.service';
import { PeatonalService } from '../../core/services/peatonal.service';
import { QrOfflineService } from '../../core/services/qr-offline.service';
import { OfflineValidacionUtil } from '../../core/utils/offline-validacion.util';
import {
  ModalResultadoEscaneoComponent,
  TipoEscaneo,
  EstadoEscaneo,
} from './modal-resultado-escaneo/modal-resultado-escaneo.component';

type CamaraTrackCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  zoom?: { min: number; max: number; step?: number };
};

type CamaraTrackConstraint = MediaTrackConstraintSet & {
  torch?: boolean;
  zoom?: number;
};

@Component({
  selector: 'app-scanner',
  templateUrl: 'scanner.page.html',
  styleUrls: ['scanner.page.scss'],
  standalone: false,
})
export class ScannerPage implements OnDestroy {
  @ViewChild('videoRef') videoRef!: ElementRef<HTMLVideoElement>;

  procesando      = false;
  hayInternet     = true;
  camaraLista     = false;
  scannerVisible  = false;
  flashActivo     = false;
  flashDisponible = false;
  zoomDisponible  = false;
  zoomEsHardware  = false;
  zoomActual      = 1;
  zoomMin         = 1;
  zoomMax         = 3;
  zoomStep        = 0.1;

  private readonly zoomDigitalMax = 3;
  private readonly zoomNiveles = [1, 1.5, 2, 2.5, 3];

  private videoStream:   MediaStream | null = null;
  private videoTrack:    MediaStreamTrack | null = null;
  private scanInterval:  any = null;
  private mlkitListener: PluginListenerHandle | null = null;
  private usandoMLKit  = false;
  private backButtonSub?: Subscription;
  private networkSub?: Subscription;
  private modoAcompanantes = false;
  private retornoEstacionamiento: Record<string, string | null> = {};

  constructor(
    private navCtrl:      NavController,
    private modalCtrl:    ModalController,
    private platform:     Platform,
    private ui:           UiService,
    private scanSound:    ScanSoundService,
    private plateService: PlateRecognizerService,
    private validarPerfilService: ValidarPerfilService,
    private validarPatenteService: ValidarPatenteService,
    private peatonalService: PeatonalService,
    private authService: AuthService,
    private network: NetworkService,
    private offlineService: OfflineService,
    private qrOffline: QrOfflineService,
    private zone: NgZone,
    private route: ActivatedRoute,
  ) {}

  async ionViewWillEnter() {
    const qp = this.route.snapshot.queryParamMap;
    this.modoAcompanantes = qp.get('modo') === 'acompanantes';
    if (this.modoAcompanantes) {
      this.retornoEstacionamiento = {
        nombre: qp.get('retNombre'),
        patente: qp.get('retPatente'),
        rut: qp.get('retRut'),
        perfil: qp.get('retPerfil'),
        origen: qp.get('retOrigen'),
        estado: qp.get('retEstado'),
        persNcorr: qp.get('retPersNcorr'),
        credencial: qp.get('retCredencial'),
      };
    }

    this.backButtonSub = this.platform.backButton.subscribeWithPriority(100, () => {
      void this.volver();
    });
    await this.actualizarEstadoRed();
    this.networkSub = this.network.enLinea$.subscribe(enLinea => {
      this.zone.run(() => {
        this.hayInternet = enLinea;
      });
    });
    await this.prepararEscaneo();
  }

  ionViewWillLeave() {
    this.backButtonSub?.unsubscribe();
    this.backButtonSub = undefined;
    this.networkSub?.unsubscribe();
    this.networkSub = undefined;
    void this.apagarScanner();
  }

  ngOnDestroy() {
    this.backButtonSub?.unsubscribe();
    void this.detenerTodo();
  }

  private async prepararEscaneo(): Promise<void> {
    this.procesando = false;
    this.scannerVisible = false;
    this.detenerTodo();

    const tienePermiso = await this.verificarPermisoCamara();
    if (!tienePermiso) {
      await this.mostrarAlertPermisoCamara();
      return;
    }

    this.scannerVisible = true;
    await this.iniciarEscaneo();
  }

  async iniciarEscaneo() {
    this.camaraLista = false;

    if (Capacitor.isNativePlatform() && !('BarcodeDetector' in window)) {
      await this.iniciarMLKit();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      this.videoStream = stream;
      this.inicializarControlesCamara(stream);

      setTimeout(async () => {
        const video = this.videoRef?.nativeElement;
        if (!video) { return; }
        video.srcObject = stream;
        video.oncanplay = () => { this.zone.run(() => { this.camaraLista = true; }); };
        await video.play();
        this.iniciarDeteccionQR();
      }, 80);

    } catch (e: unknown) {
      if (this.esErrorPermisoCamara(e)) {
        this.scannerVisible = false;
        await this.mostrarAlertPermisoCamara();
        return;
      }
      await this.iniciarMLKit();
    }
  }

  private iniciarDeteccionQR() {
    if (!('BarcodeDetector' in window)) {
      this.iniciarMLKit();
      return;
    }

    const detector = new (window as any).BarcodeDetector({
      formats: ['qr_code'],
    });

    this.scanInterval = setInterval(async () => {
      if (this.procesando) { return; }
      const video = this.videoRef?.nativeElement;
      if (!video || video.readyState < 2) { return; }

      try {
        const barcodes = await detector.detect(video);
        const qr = barcodes?.find(
          (code: { format?: string; rawValue?: string }) =>
            code.format === 'qr_code' && !!code.rawValue?.trim()
        );
        const valor = qr?.rawValue?.trim();
        if (valor) {
          this.zone.run(() => this.onCodigoDetectado(valor));
        }
      } catch {}
    }, 400);
  }

  private async iniciarMLKit() {
    this.detenerVideoStream();
    try {
      const permisos = await BarcodeScanner.requestPermissions();
      if (permisos.camera !== 'granted' && permisos.camera !== 'limited') {
        await this.mostrarAlertPermisoCamara();
        return;
      }
      this.usandoMLKit = true;
      document.body.classList.add('barcode-scanning-active');

      this.mlkitListener = await BarcodeScanner.addListener('barcodesScanned', (event) => {
        if (this.procesando || !event.barcodes?.length) {
          return;
        }

        const qr =
          event.barcodes.find(code => code.format === 'QR_CODE' && code.rawValue?.trim()) ??
          event.barcodes.find(code => code.rawValue?.trim());

        const valor = qr?.rawValue?.trim();
        if (valor) {
          this.zone.run(() => this.onCodigoDetectado(valor));
        }
      });

      await BarcodeScanner.startScan();
      this.scannerVisible = true;
      this.camaraLista = true;
    } catch (e: unknown) {
      this.usandoMLKit = false;
      document.body.classList.remove('barcode-scanning-active');
      this.scannerVisible = false;
      if (this.esErrorPermisoCamara(e)) {
        await this.mostrarAlertPermisoCamara();
        return;
      }
      await this.mostrarError('No se pudo iniciar el escáner.');
    }
  }

  async onCodigoDetectado(valor: string) {
    const codigo = valor.trim();
    if (this.procesando || !codigo) { return; }
    this.procesando = true;

    try {
      if (this.esPatente(codigo)) {
        await this.validarPatenteEscaneada(codigo);
        return;
      }

      if (!ScanPerfilUtil.esEscaneoQrPerfil(codigo)) {
        await this.mostrarAlertQrFormatoInvalido();
        return;
      }

      await this.flujoEscaneoQr(codigo);
    } catch {
      this.procesando = false;
    }
  }

  async capturarPatente() {
    if (this.procesando || !this.hayInternet) { return; }
    this.procesando = true;
    const eraMLKit = this.usandoMLKit;
    await this.detenerDeteccion();

    let loading: HTMLIonLoadingElement | null = null;

    try {
      let base64: string;

      if (this.videoStream && this.videoRef?.nativeElement) {
        const video = this.videoRef.nativeElement;
        const canvas = document.createElement('canvas');
        canvas.width  = video.videoWidth  || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d')!;

        if (!this.zoomEsHardware && this.zoomActual > 1) {
          const z = this.zoomActual;
          const sw = canvas.width / z;
          const sh = canvas.height / z;
          const sx = (canvas.width - sw) / 2;
          const sy = (canvas.height - sh) / 2;
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        } else {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }

        base64 = canvas.toDataURL('image/jpeg', 0.92);
      } else if (Capacitor.isNativePlatform()) {
        const foto = await Camera.getPhoto({
          quality: 92,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
          saveToGallery: false,
        });
        base64 = foto.dataUrl ?? '';
        if (!base64) {
          throw new Error('No se pudo capturar la imagen.');
        }
      } else {
        this.procesando = false;
        if (eraMLKit) {
          await this.prepararEscaneo();
        }
        await this.mostrarError('Cámara no disponible.');
        return;
      }

      loading = await this.ui.presentLoading('Detectando patente...', {
        spinner: 'crescent',
      });

      const plateResult = await this.detectarPatenteConReintentos(base64);

      await this.ui.dismissLoading(loading);
      loading = null;

      if (plateResult?.plate) {
        await this.validarPatenteEscaneada(plateResult.plate);
        return;
      }

      await this.solicitarPatenteManual();
    } catch {
      await this.ui.dismissLoading(loading);
      await this.solicitarPatenteManual();
    }
  }

  async volver() {
    await this.apagarScanner();
    this.navCtrl.back();
  }

  async ingresarPatenteManual(patentePrefill = ''): Promise<void> {
    if (this.procesando && !patentePrefill) {
      return;
    }
    this.procesando = true;
    await this.detenerDeteccion();
    await this.solicitarPatenteManual(patentePrefill);
  }

  private async navegarIngresoManualConPatente(patente: string): Promise<void> {
    const limpia = PatenteUtil.toApi(patente);
    const medio = PatenteUtil.inferirMedio(limpia) ?? 'auto';
    await this.apagarScanner();
    this.procesando = false;
    await this.navCtrl.navigateForward('/ingreso-manual', {
      queryParams: {
        patente: limpia,
        tipoMedio: medio,
      },
    });
  }

  get mostrarVideoPreview(): boolean {
    return !!this.videoStream && !this.usandoMLKit;
  }

  get modoMLKit(): boolean {
    return this.usandoMLKit;
  }

  get zoomEtiqueta(): string {
    return `${this.zoomActual.toFixed(1)}x`;
  }

  get mostrarControlesZoom(): boolean {
    return !!this.videoStream && !this.usandoMLKit;
  }

  get zoomVideoTransform(): string {
    return this.zoomEsHardware ? 'none' : `scale(${this.zoomActual})`;
  }

  get tieneZoomAplicado(): boolean {
    return this.zoomActual > 1.05;
  }

  async toggleFlash(): Promise<void> {
    if (!this.videoTrack || !this.flashDisponible || this.procesando) {
      return;
    }

    const activar = !this.flashActivo;
    try {
      await this.videoTrack.applyConstraints({
        advanced: [{ torch: activar } as CamaraTrackConstraint],
      });
      this.flashActivo = activar;
    } catch {
      await this.ui.presentToast('No se pudo activar el flash.', {
        color: 'warning',
        duration: 2000,
      });
    }
  }

  async subirZoom(): Promise<void> {
    const idx = this.indiceZoomActual();
    if (idx >= this.zoomNiveles.length - 1) {
      return;
    }
    await this.aplicarZoom(this.zoomNiveles[idx + 1]);
  }

  async bajarZoom(): Promise<void> {
    const idx = this.indiceZoomActual();
    if (idx <= 0) {
      return;
    }
    await this.aplicarZoom(this.zoomNiveles[idx - 1]);
  }

  private indiceZoomActual(): number {
    const idx = this.zoomNiveles.findIndex(z => Math.abs(z - this.zoomActual) < 0.05);
    return idx >= 0 ? idx : 0;
  }

  private async flujoEscaneoQr(codigo: string): Promise<void> {
    const modoOffline = !this.hayInternet;
    const loading = await this.ui.presentLoading(
      modoOffline ? 'Validando perfil (sin conexión)...' : 'Validando perfil...'
    );
    const contextoEscaneo = {
      codigoEscaneado: codigo,
      rut: ScanPerfilUtil.extractRutCompletoFromEscaneo(codigo),
      email: ScanPerfilUtil.extractEmailFromEscaneo(codigo),
      tipo: ScanPerfilUtil.resolveTipoEscaneo(codigo),
      escaneoPorEmail: ScanPerfilUtil.esEscaneoPorEmail(codigo),
    };

    try {
      const res = modoOffline
        ? await this.validarPerfilOffline(contextoEscaneo)
        : await firstValueFrom(this.validarPerfilService.validarEscaneo(codigo));
      await this.ui.dismissLoading(loading);
      const modalData = this.mapValidarPerfilToModal(res, contextoEscaneo);
      const controlPeatonal = await this.registrarEscaneoPeatonalInmediato(modalData);
      await this.mostrarResultadoModal(
        this.enriquecerModalConControlPeatonal(modalData, controlPeatonal)
      );
    } catch (err: unknown) {
      await this.ui.dismissLoading(loading);
      const res = ValidarPerfilUtil.extraerResponse(err);
      if (res) {
        const modalData = this.mapValidarPerfilToModal(res, contextoEscaneo);
        const controlPeatonal = await this.registrarEscaneoPeatonalInmediato(modalData);
        await this.mostrarResultadoModal(
          this.enriquecerModalConControlPeatonal(modalData, controlPeatonal)
        );
      } else {
        const mensaje = mensajeErrorUsuario(err, 'No se pudo validar el código.');
        await this.mostrarResultadoModal({
          tipo: contextoEscaneo.tipo,
          estado: 'no_autorizado',
          mensaje,
        });
      }
    }
  }

  async mostrarResultadoModal(data: {
    tipo: TipoEscaneo;
    estado?: EstadoEscaneo;
    nombre?: string;
    credencial?: string;
    rut?: string;
    email?: string;
    codigoEscaneado?: string;
    perfil?: string;
    perfilDescripcion?: string;
    persNcorr?: number;
    code?: string;
    titulo?: string;
    mensaje?: string;
    plateResult?: any;
    fotoPreview?: string;
    controlPeatonalExito?: boolean;
    escaneoPorEmail?: boolean;
  }) {
    const esBloqueado = String(data.code ?? '').toLowerCase() === 'bloqueado';
    const modal = await this.modalCtrl.create({
      component: ModalResultadoEscaneoComponent,
      cssClass: esBloqueado ? 'modal-75 modal-75--bloqueado' : 'modal-75',
      componentProps: {
        tipo:        data.tipo,
        estado:      data.estado ?? 'autorizado',
        nombre:      data.nombre,
        credencial:  data.credencial,
        rut:         data.rut,
        email:       data.email,
        codigoEscaneado: data.codigoEscaneado,
        perfil:      data.perfil,
        perfilDescripcion: data.perfilDescripcion,
        persNcorr:   data.persNcorr,
        code:        data.code,
        titulo:      data.titulo,
        mensaje:     data.mensaje,
        plateResult: data.plateResult,
        fotoPreview: data.fotoPreview,
        controlPeatonalExito: data.controlPeatonalExito ?? false,
        escaneoPorEmail: data.escaneoPorEmail ?? false,
      },
    });

    const estado = data.estado ?? 'autorizado';
    void this.scanSound.play(estado);

    await modal.present();
    const { data: resp, role } = await modal.onDidDismiss();

    if (role === 'accion') {
      const esPatente = resp?.tipo === 'patente';

      if (resp?.via === 'peatonal' && !esPatente) {
        if (resp.estado === 'autorizado') {
          if (resp.controlPeatonalExito) {
            await this.completarIngresoPeatonalTrasEscaneo(resp);
          } else {
            await this.registrarControlIngresoPeatonal(resp);
          }
        } else if (resp.estado === 'manual') {
          await this.confirmarEscaneoPeatonalExpirado(resp);
        } else {
          await this.salirScannerHacia(
            '/ingreso-manual',
            this.buildAccesoQueryParams(resp)
          );
        }
        return;
      }

      const params = this.buildAccesoQueryParams(resp);
      const ruta = esPatente || resp?.via === 'estacionamiento'
        ? '/estacionamiento'
        : '/ingreso-manual';
      await this.salirScannerHacia(ruta, params);
    } else {
      await this.reanudarEscaneoTrasModal();
    }
  }

  private buildControlIngresoPeatonal(data: {
    tipo: TipoEscaneo;
    estado?: EstadoEscaneo;
    codigoEscaneado?: string;
    persNcorr?: number;
    rut?: string;
    email?: string;
    perfil?: string;
    perfilDescripcion?: string;
    escaneoPorEmail?: boolean;
  }): PeatonalControlIngresoRequest | null {
    if (data.tipo === 'patente') {
      return null;
    }

    return PeatonalEscaneoUtil.buildControlIngresoRequest({
      tipo: data.tipo,
      estado: data.estado,
      codigoEscaneado: data.codigoEscaneado,
      persNcorr: data.persNcorr,
      rut: data.rut,
      email: data.email,
      perfil: data.perfil,
      perfilDescripcion: data.perfilDescripcion,
      escaneoPorEmail: data.escaneoPorEmail,
    });
  }

  private enriquecerModalConControlPeatonal<
    T extends {
      estado?: EstadoEscaneo;
      mensaje?: string;
      nombre?: string;
    },
  >(
    modalData: T,
    controlPeatonal: ResultadoControlPeatonal
  ): T & {
    controlPeatonalExito: boolean;
    nombre?: string;
  } {
    const nombre =
      modalData.nombre?.trim() ||
      controlPeatonal.nombreCompleto?.trim() ||
      modalData.nombre;

    return {
      ...modalData,
      nombre,
      controlPeatonalExito: controlPeatonal.exito,
    };
  }

  /** Registra APP_PEATONAL_ESCANEOS al validar QR (éxito, rechazo o expirado). */
  private async registrarEscaneoPeatonalInmediato(data: {
    tipo: TipoEscaneo;
    estado: EstadoEscaneo;
    codigoEscaneado?: string;
    persNcorr?: number;
    rut?: string;
    email?: string;
    perfil?: string;
    perfilDescripcion?: string;
    escaneoPorEmail?: boolean;
  }): Promise<ResultadoControlPeatonal> {
    const body = this.buildControlIngresoPeatonal(data);
    if (!body) {
      return { exito: false, registrado: false };
    }

    return this.enviarControlIngresoPeatonal(body);
  }

  private async enviarControlIngresoPeatonal(
    body: PeatonalControlIngresoRequest
  ): Promise<ResultadoControlPeatonal> {
    try {
      const res = await firstValueFrom(
        this.peatonalService.registrarControlIngreso(body)
      );
      return {
        exito: peatonalControlIngresoFueExitoso(res),
        registrado: peatonalControlIngresoFueRegistrado(res),
        message: res.message,
        nombreCompleto: res.nombreCompleto,
      };
    } catch {
      return { exito: false, registrado: false };
    }
  }

  private async confirmarEscaneoPeatonalExpirado(resp: {
    tipo?: TipoEscaneo;
    estado?: EstadoEscaneo;
    persNcorr?: number;
    perfil?: string;
    perfilDescripcion?: string;
    controlPeatonalExito?: boolean;
    rut?: string;
    nombre?: string;
    credencial?: string;
    code?: string;
    email?: string;
    codigoEscaneado?: string;
    escaneoPorEmail?: boolean;
  }): Promise<void> {
    let controlPeatonal: ResultadoControlPeatonal = {
      exito: resp.controlPeatonalExito ?? false,
      registrado: false,
    };

    if (!controlPeatonal.exito) {
      controlPeatonal = await this.registrarEscaneoPeatonalInmediato({
        tipo: resp.tipo ?? 'credencial',
        estado: 'manual',
        codigoEscaneado: resp.codigoEscaneado,
        persNcorr: resp.persNcorr,
        rut: resp.rut,
        email: resp.email,
        perfil: resp.perfil,
        perfilDescripcion: resp.perfilDescripcion,
        escaneoPorEmail: resp.escaneoPorEmail,
      });

      if (!controlPeatonal.exito) {
        await this.registrarControlIngresoPeatonal({
          ...resp,
          tipo: resp.tipo ?? 'credencial',
          estado: 'manual',
        });
        return;
      }
    }

    await this.ui.presentToast('Escaneo registrado.', {
      color: 'success',
      position: 'top',
      duration: 2500,
    });
    await this.reanudarEscaneoTrasModal();
  }

  private async registrarControlIngresoPeatonal(resp: {
    nombre?: string;
    persNcorr?: number;
    rut?: string;
    perfil?: string;
    perfilDescripcion?: string;
    tipo?: TipoEscaneo;
    estado?: EstadoEscaneo;
    email?: string;
    codigoEscaneado?: string;
    escaneoPorEmail?: boolean;
  }): Promise<void> {
    const body = this.buildControlIngresoPeatonal({
      tipo: resp.tipo ?? 'credencial',
      estado: resp.estado ?? 'autorizado',
      codigoEscaneado: resp.codigoEscaneado,
      persNcorr: resp.persNcorr,
      rut: resp.rut,
      email: resp.email,
      perfil: resp.perfil,
      perfilDescripcion: resp.perfilDescripcion,
      escaneoPorEmail: resp.escaneoPorEmail,
    });

    if (!body) {
      await this.ui.presentToast(
        'Faltan datos de la persona para confirmar el ingreso.',
        { color: 'warning' }
      );
      await this.reanudarEscaneoTrasModal();
      return;
    }

    const loading = await this.ui.presentLoading('Confirmando ingreso...');

    try {
      const res = await firstValueFrom(
        this.peatonalService.registrarControlIngreso(body)
      );
      await this.ui.dismissLoading(loading);

      if (!peatonalControlIngresoFueExitoso(res)) {
        await this.ui.presentToast(
          res.message || 'No se pudo confirmar el ingreso.',
          { color: 'warning' }
        );
        await this.reanudarEscaneoTrasModal();
        return;
      }

      await this.completarIngresoPeatonalTrasEscaneo({
        ...resp,
        nombre: resp.nombre ?? res.nombreCompleto,
      });
    } catch (err: unknown) {
      await this.ui.dismissLoading(loading);
      await this.ui.presentToast(
        mensajeErrorUsuario(err, 'Error al confirmar el ingreso.'),
        { color: 'danger' }
      );
      await this.reanudarEscaneoTrasModal();
    }
  }

  private async completarIngresoPeatonalTrasEscaneo(resp: {
    nombre?: string;
    perfil?: string;
    perfilDescripcion?: string;
  }): Promise<void> {
    await this.irConfirmacionTrasEscaneo(resp, this.modoAcompanantes);
  }

  private async irConfirmacionTrasEscaneo(
    resp: {
      nombre?: string;
      perfil?: string;
      perfilDescripcion?: string;
    },
    volverAlScanner = false
  ): Promise<void> {
    const sede = await this.authService.getSede();
    const perfil = resp.perfilDescripcion ?? resp.perfil ?? null;
    const nombre = String(resp.nombre ?? '').trim();

    await this.apagarScanner();

    const queryParams = {
      nombre: nombre || null,
      sede: sede?.nombre ?? null,
      perfil,
      ...(volverAlScanner ? { retorno: 'acompanantes' } : {}),
    };

    if (volverAlScanner) {
      await this.navCtrl.navigateForward('/confirmacion', { queryParams });
      return;
    }

    await this.navCtrl.navigateRoot('/confirmacion', { queryParams });
  }

  private async salirScannerHacia(
    ruta: string,
    params: Record<string, string | null>
  ): Promise<void> {
    await this.apagarScanner();
    await this.navCtrl.navigateRoot(ruta, { queryParams: params });
  }

  private async reanudarEscaneoTrasModal(): Promise<void> {
    this.procesando = false;

    if (this.scannerEnMarcha()) {
      if (!this.usandoMLKit && this.videoStream && !this.scanInterval) {
        this.iniciarDeteccionQR();
      }
      return;
    }

    await this.prepararEscaneo();
  }

  private scannerEnMarcha(): boolean {
    return this.scannerVisible && (this.usandoMLKit || !!this.videoStream);
  }

  private restaurarEstiloApp(): void {
    document.body.classList.remove('barcode-scanning-active');

    const ionApp = document.querySelector('ion-app');
    if (ionApp instanceof HTMLElement) {
      ionApp.style.removeProperty('background');
      ionApp.style.removeProperty('--background');
    }

    document.body.style.removeProperty('background');
    document.body.style.removeProperty('--ion-background-color');
  }

  private async apagarScanner(): Promise<void> {
    this.scannerVisible = false;
    this.camaraLista = false;
    this.procesando = false;
    await this.detenerTodo();
    this.restaurarEstiloApp();
  }

  private async detenerDeteccion(): Promise<void> {
    if (this.scanInterval) { clearInterval(this.scanInterval); this.scanInterval = null; }
    if (this.usandoMLKit) {
      document.body.classList.remove('barcode-scanning-active');
      try {
        await BarcodeScanner.stopScan();
      } catch {}
      await this.mlkitListener?.remove();
      this.mlkitListener = null;
      this.usandoMLKit = false;
    }
  }

  private detenerVideoStream() {
    this.camaraLista = false;
    void this.apagarFlash();
    this.videoStream?.getTracks().forEach(t => t.stop());
    this.videoStream = null;
    this.videoTrack = null;
    this.reiniciarControlesCamara();
    const video = this.videoRef?.nativeElement;
    if (video) {
      video.pause();
      video.srcObject = null;
      video.load();
    }
  }

  private inicializarControlesCamara(stream: MediaStream): void {
    this.reiniciarControlesCamara();

    const track = stream.getVideoTracks()[0];
    if (!track) {
      this.activarZoomDigital();
      return;
    }

    this.videoTrack = track;

    if (track.getCapabilities) {
      const caps = track.getCapabilities() as CamaraTrackCapabilities;
      this.flashDisponible = caps.torch === true;

      if (caps.zoom && caps.zoom.max > caps.zoom.min) {
        this.zoomEsHardware = true;
        this.zoomDisponible = true;
        this.zoomMin = caps.zoom.min;
        this.zoomMax = caps.zoom.max;
        this.zoomStep = caps.zoom.step ?? Math.max(0.1, (caps.zoom.max - caps.zoom.min) / 20);

        const settings = track.getSettings?.() as MediaTrackSettings & { zoom?: number };
        this.zoomActual = settings?.zoom ?? caps.zoom.min;
        return;
      }
    }

    this.activarZoomDigital();
  }

  private activarZoomDigital(): void {
    this.zoomEsHardware = false;
    this.zoomDisponible = true;
    this.zoomMin = 1;
    this.zoomMax = this.zoomDigitalMax;
    this.zoomStep = 0.1;
    this.zoomActual = 1;
  }

  private reiniciarControlesCamara(): void {
    this.flashActivo = false;
    this.flashDisponible = false;
    this.zoomDisponible = false;
    this.zoomEsHardware = false;
    this.zoomActual = 1;
    this.zoomMin = 1;
    this.zoomMax = this.zoomDigitalMax;
    this.zoomStep = 0.1;
  }

  private async aplicarZoom(valor: number): Promise<void> {
    if (!this.zoomDisponible || this.procesando) {
      return;
    }

    const zoom = Math.min(this.zoomMax, Math.max(this.zoomMin, valor));
    this.zoomActual = Math.round(zoom * 10) / 10;

    if (!this.zoomEsHardware || !this.videoTrack) {
      return;
    }

    try {
      await this.videoTrack.applyConstraints({
        advanced: [{ zoom: this.zoomActual } as CamaraTrackConstraint],
      });
    } catch {
      this.activarZoomDigital();
    }
  }

  private async apagarFlash(): Promise<void> {
    if (!this.videoTrack || !this.flashActivo) {
      return;
    }

    try {
      await this.videoTrack.applyConstraints({
        advanced: [{ torch: false } as CamaraTrackConstraint],
      });
    } catch {}

    this.flashActivo = false;
  }

  private async detenerTodo(): Promise<void> {
    await this.detenerDeteccion();
    this.detenerVideoStream();
    document.body.classList.remove('barcode-scanning-active');
  }

  private async validarPatenteEscaneada(patenteRaw: string): Promise<void> {
    const patente = patenteRaw.trim().toUpperCase();
    const modoOffline = !this.hayInternet;
    const loading = await this.ui.presentLoading(
      modoOffline ? 'Validando patente (sin conexión)...' : 'Validando patente...'
    );

    try {
      const res = modoOffline
        ? await this.validarPatenteOffline(patente)
        : await firstValueFrom(this.validarPatenteService.validar(patente));
      await this.ui.dismissLoading(loading);
      await this.mostrarResultadoModal(this.mapValidarPatenteToModal(res, patente));
    } catch (err: unknown) {
      await this.ui.dismissLoading(loading);
      const res = ValidarPatenteUtil.extraerResponse(err);
      if (res) {
        await this.mostrarResultadoModal(this.mapValidarPatenteToModal(res, patente));
      } else {
        const mensaje = mensajeErrorUsuario(err, 'No se pudo validar la patente.');
        await this.mostrarResultadoModal({
          tipo: 'patente',
          estado: 'no_autorizado',
          mensaje,
          plateResult: this.toPlateResult(patente),
        });
      }
    }
  }

  private async detectarPatenteConReintentos(
    base64: string,
    intentos = 3
  ): Promise<PlateResult | null> {
    for (let i = 0; i < intentos; i++) {
      const result = await this.plateService.readPlate(base64);
      if (result?.plate) {
        return result;
      }
      if (i < intentos - 1) {
        await this.esperar(400);
      }
    }
    return null;
  }

  private async solicitarPatenteManual(patentePrefill = ''): Promise<void> {
    let avanzo = false;
    const limpioPrefill = PatenteUtil.limpiar(patentePrefill);
    const medioPrefill = PatenteUtil.inferirMedio(limpioPrefill);

    const alert = await this.ui.presentAlert({
      cssClass: 'alert-salida alert-salida--patente',
      header: 'Ingresar patente',
      message: this.mensajePatenteManual(limpioPrefill, medioPrefill),
      inputs: [
        {
          name: 'patente',
          type: 'text',
          placeholder:
            medioPrefill === 'moto'
              ? 'ABC-12 / ABCD-1'
              : 'AB-CD-12 / ABCDE-1',
          value: limpioPrefill
            ? PatenteUtil.formatInput(limpioPrefill, medioPrefill ?? 'auto')
            : '',
          attributes: {
            autocapitalize: 'characters',
            maxlength: 8,
          },
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          cssClass: 'alert-btn-cancelar',
          role: 'cancel',
        },
        {
          text: 'Validar',
          cssClass: 'alert-btn-aceptar',
          handler: (data) => {
            const raw = String(data?.patente ?? '');
            const patente = PatenteUtil.toApi(raw);
            if (!PatenteUtil.isFormatValidAutoOMoto(patente)) {
              void this.mostrarError('Patente inválida.');
              void this.solicitarPatenteManual(PatenteUtil.limpiar(raw));
              return false;
            }
            avanzo = true;
            void this.validarPatenteEscaneada(patente);
            return true;
          },
        },
      ],
    });
    await alert.onDidDismiss();
    if (!avanzo) {
      this.procesando = false;
      await this.prepararEscaneo();
    }
  }

  private esperar(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private mapValidarPatenteToModal(
    res: ValidarPatenteResponse,
    patenteFallback: string
  ): {
    tipo: TipoEscaneo;
    estado: EstadoEscaneo;
    nombre?: string;
    perfil?: string;
    perfilDescripcion?: string;
    code?: string;
    titulo?: string;
    mensaje?: string;
    plateResult?: PlateResult;
  } {
    const patente = (res.patente ?? patenteFallback).toUpperCase();
    const plateResult = this.toPlateResult(patente);
    const textos = ValidarPatenteUtil.extraerTituloYMensaje(res);
    const persona = {
      nombre: res.nombreCompleto ?? undefined,
      perfil: res.perfil != null ? String(res.perfil) : undefined,
      perfilDescripcion: res.perfilDescripcion,
      persNcorr: res.persNcorr,
    };

    if (String(res.code ?? '').toLowerCase() === 'bloqueado') {
      return {
        tipo: 'patente',
        estado: 'no_autorizado',
        code: 'bloqueado',
        ...persona,
        titulo: textos.titulo ?? 'Acceso Bloqueado',
        mensaje:
          textos.mensaje ??
          res.message ??
          'Ingreso no autorizado.',
        plateResult,
      };
    }

    if (ValidarPatenteUtil.esAutorizada(res)) {
      return {
        tipo: 'patente',
        estado: 'autorizado',
        ...persona,
        titulo: textos.titulo,
        mensaje: textos.mensaje,
        plateResult,
      };
    }

    return {
      tipo: 'patente',
      estado: 'no_autorizado',
      ...persona,
      titulo: textos.titulo,
      mensaje:
        textos.mensaje ??
        res.message ??
        'La persona no pertenece a INACAP. Debe ingresarla como visita.',
      plateResult,
    };
  }

  private toPlateResult(patente: string): PlateResult {
    const plate = patente.toUpperCase();
    const medio = PatenteUtil.inferirMedio(plate);
    return {
      plate,
      score: 1,
      region: 'cl',
      vehicleType: medio ?? '',
    };
  }

  private mensajePatenteManual(
    limpio: string,
    medio: ReturnType<typeof PatenteUtil.inferirMedio>
  ): string {
    const lineas = ['Ingresa la patente'];
    const etiqueta = PatenteUtil.etiquetaMedio(medio);

    if (etiqueta) {
      lineas.push(`Tipo: ${etiqueta}`);
    }

    return lineas.join('\n');
  }

  private esPatente(valor: string): boolean {
    return PatenteUtil.isFormatValidAutoOMoto(valor);
  }

  private mapValidarPerfilToModal(
    res: ValidarPerfilResponse,
    contexto?: {
      codigoEscaneado?: string;
      rut?: string | null;
      email?: string | null;
      tipo?: TipoEscaneo;
      escaneoPorEmail?: boolean;
    }
  ): {
    tipo: TipoEscaneo;
    estado: EstadoEscaneo;
    nombre?: string;
    credencial?: string;
    rut?: string;
    email?: string;
    codigoEscaneado?: string;
    perfil?: string;
    perfilDescripcion?: string;
    persNcorr?: number;
    titulo?: string;
    mensaje?: string;
    code?: string;
    escaneoPorEmail?: boolean;
  } {
    const textos = ValidarPerfilUtil.extraerTituloYMensaje(res);
    const nombre = String(res.nombreCompleto ?? '').trim() || undefined;
    const rut = this.resolverRutParaManual(res, contexto?.rut);
    const email =
      ValidarPerfilUtil.normalizarEmail(contexto?.email) ??
      ValidarPerfilUtil.normalizarEmail(res.email);
    const base = {
      tipo: contexto?.tipo ?? ('credencial' as const),
      nombre,
      credencial: res.codigoCredencial ?? undefined,
      rut,
      email,
      codigoEscaneado: contexto?.codigoEscaneado,
      perfil: res.perfil != null ? String(res.perfil) : undefined,
      perfilDescripcion: res.perfilDescripcion,
      persNcorr: ValidarPerfilUtil.normalizarPersNcorr(res.persNcorr),
      titulo: textos.titulo,
      mensaje: textos.mensaje,
      code: res.code,
      escaneoPorEmail: contexto?.escaneoPorEmail === true,
    };

    if (ValidarPerfilUtil.esCredencialExpirada(res)) {
      return {
        ...base,
        estado: 'manual',
        titulo: textos.titulo ?? 'Código Expirado',
        mensaje:
          textos.mensaje ??
          'Solicitar mostrar la credencial desde la APP INACAP. Si el problema persiste solicitar Cédula de Identidad.',
      };
    }

    if (ValidarPerfilUtil.requiereIngresoManual(res)) {
      return {
        ...base,
        estado: 'no_autorizado',
        mensaje:
          res.message ||
          textos.mensaje ||
          'Se debe ingresar de forma manual.',
      };
    }

    if (ValidarPerfilUtil.esAccesoBloqueado(res)) {
      return {
        ...base,
        estado: 'no_autorizado',
        titulo: textos.titulo ?? 'Acceso Bloqueado',
        mensaje:
          textos.mensaje ??
          res.observacion ??
          res.bloqueo?.observacion ??
          'Ingreso no autorizado.',
        code: 'bloqueado',
      };
    }

    if (res.success) {
      return {
        ...base,
        estado: 'autorizado',
        titulo: textos.titulo ?? 'Acceso Autorizado',
        mensaje: textos.mensaje,
      };
    }

    return {
      ...base,
      estado: 'no_autorizado',
      titulo: textos.titulo,
      mensaje:
        textos.mensaje ??
        res.message ??
        'La persona no pertenece a INACAP. Debe ingresarla como visita.',
    };
  }

  private resolverRutParaManual(
    res: ValidarPerfilResponse,
    rutEscaneado?: string | null
  ): string | undefined {
    if (rutEscaneado && RutUtil.isFormatValid(rutEscaneado)) {
      return rutEscaneado;
    }

    const apiRut = String(res.rut ?? '').trim();
    if (!apiRut) {
      return undefined;
    }

    const normalizado = RutUtil.normalizeFromRun(apiRut);
    if (normalizado.includes('-') && RutUtil.isFormatValid(normalizado)) {
      return normalizado;
    }

    return apiRut || undefined;
  }

  private buildAccesoQueryParams(resp: {
    patente?: string;
    nombre?: string;
    rut?: string;
    credencial?: string;
    perfil?: string;
    perfilDescripcion?: string;
    persNcorr?: number;
    estado?: EstadoEscaneo;
    tipo?: TipoEscaneo;
    code?: string;
    escaneoPorEmail?: boolean;
  }): Record<string, string | null> {
    const perfil = resolverPerfilIngresoManual({
      code: resp.code,
      estado: resp.estado,
      perfil: resp.perfil,
      perfilDescripcion: resp.perfilDescripcion,
      origen: resp.tipo,
      escaneoPorEmail: resp.escaneoPorEmail,
    });

    return {
      patente: resp.patente ?? null,
      tipoMedio: resp.patente
        ? PatenteUtil.inferirMedio(PatenteUtil.toApi(resp.patente)) ?? 'auto'
        : null,
      nombre: resp.nombre ?? null,
      rut: resp.rut ?? null,
      credencial: resp.credencial ?? null,
      perfil: perfil ?? null,
      perfilDescripcion: resp.perfilDescripcion ?? null,
      persNcorr:
        resp.persNcorr != null && resp.persNcorr > 0
          ? String(resp.persNcorr)
          : null,
      origen: resp.tipo ?? null,
      estado: resp.estado ?? null,
    };
  }

  private async validarPerfilOffline(contexto: {
    codigoEscaneado?: string;
    rut?: string | null;
    email?: string | null;
  }): Promise<ValidarPerfilResponse> {
    const catalogo = await this.offlineService.getCatalogo();
    if (!catalogo || !OfflineValidacionUtil.tieneCatalogoValidacion(catalogo)) {
      return {
        success: false,
        message:
          'Sin conexión y sin catálogo local. Sincroniza al iniciar sesión con internet.',
        ingresarManual: true,
      };
    }

    return OfflineValidacionUtil.validarPerfilDesdeEscaneo(
      catalogo,
      contexto,
      qr => this.qrOffline.parseCredencialInacap(qr)
    );
  }

  private async validarPatenteOffline(patente: string): Promise<ValidarPatenteResponse> {
    const catalogo = await this.offlineService.getCatalogo();
    if (!catalogo || !OfflineValidacionUtil.tieneCatalogoValidacion(catalogo)) {
      return {
        success: false,
        valida: false,
        patente: patente.toUpperCase(),
        message:
          'Sin conexión y sin catálogo local. Sincroniza al iniciar sesión con internet.',
        ingresarComoVisita: true,
      };
    }

    return OfflineValidacionUtil.validarPatente(catalogo, patente);
  }

  private async actualizarEstadoRed(): Promise<void> {
    this.hayInternet = await this.network.hayInternet();
  }

  private async mostrarError(msg: string) {
    await this.ui.presentToast(msg, { color: 'danger' });
  }

  private async verificarPermisoCamara(): Promise<boolean> {
    try {
      const estado = await navigator.permissions.query({
        name: 'camera' as PermissionName,
      });
      if (estado.state === 'denied') {
        return false;
      }
      if (estado.state === 'granted') {
        return true;
      }
    } catch {}

    try {
      const check = await BarcodeScanner.checkPermissions();
      if (check.camera === 'granted' || check.camera === 'limited') {
        return true;
      }
      if (check.camera === 'denied') {
        return false;
      }
    } catch {}

    try {
      const permisos = await BarcodeScanner.requestPermissions();
      return permisos.camera === 'granted' || permisos.camera === 'limited';
    } catch {
      return false;
    }
  }

  private esErrorPermisoCamara(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    const nombre = error.name;
    return (
      nombre === 'NotAllowedError' ||
      nombre === 'PermissionDeniedError'
    );
  }

  private async mostrarAlertQrFormatoInvalido(): Promise<void> {
    const alert = await this.ui.presentAlert({
      cssClass: 'alert-salida alert-salida--rechazo',
      header: 'Código no válido',
      message:
        'El código escaneado no cumple el formato esperado. ' +
        'Escanee un QR de credencial INACAP o cédula de identidad.',
      buttons: [
        {
          text: 'Aceptar',
          cssClass: 'alert-btn-aceptar',
          role: 'cancel',
        },
      ],
    });
    await alert.onDidDismiss();
    this.procesando = false;
    await this.reanudarEscaneoTrasModal();
  }

  private async mostrarAlertPermisoCamara(): Promise<void> {
    await this.ui.presentAlert({
      cssClass: 'alert-salida',
      header: 'Permiso de cámara',
      message: 'Se necesita permiso de cámara para escanear.',
      buttons: [
        {
          text: 'Volver',
          cssClass: 'alert-btn-cancelar',
          role: 'cancel',
          handler: () => {
            void this.volver();
          },
        },
        {
          text: 'Reintentar',
          cssClass: 'alert-btn-aceptar',
          handler: () => {
            void this.prepararEscaneo();
          },
        },
      ],
    });
  }
}
