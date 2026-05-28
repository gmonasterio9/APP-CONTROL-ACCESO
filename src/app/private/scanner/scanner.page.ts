import { Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
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
import { ValidarPerfilUtil } from '../../core/utils/validar-perfil.util';
import { ApiHttpError } from '../../core/services/api-http.service';
import { ScanResultModalComponent, ScanTipo, ScanEstado } from './scan-result-modal/scan-result-modal.component';

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

  constructor(
    private navCtrl:      NavController,
    private modalCtrl:    ModalController,
    private platform:     Platform,
    private ui:           UiService,
    private scanSound:    ScanSoundService,
    private plateService: PlateRecognizerService,
    private validarPerfilService: ValidarPerfilService,
    private validarPatenteService: ValidarPatenteService,
    private zone: NgZone,
  ) {}

  async ionViewWillEnter() {
    this.backButtonSub = this.platform.backButton.subscribeWithPriority(100, () => {
      void this.volver();
    });
    await this.prepararEscaneo();
  }

  ionViewWillLeave() {
    this.backButtonSub?.unsubscribe();
    this.backButtonSub = undefined;
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

      const loading = await this.ui.presentLoading('Validando perfil...');

      try {
        const res = await firstValueFrom(this.validarPerfilService.validarEscaneo(codigo));
        await this.ui.dismissLoading(loading);
        await this.mostrarResultadoModal(this.mapValidarPerfilToModal(res));
      } catch (err: unknown) {
        await this.ui.dismissLoading(loading);
        const res = ValidarPerfilUtil.extraerResponse(err);
        if (res) {
          await this.mostrarResultadoModal(this.mapValidarPerfilToModal(res));
        } else {
          const mensaje = this.extraerMensajeError(err) || 'No se pudo validar el código.';
          await this.mostrarResultadoModal({
            tipo: 'credencial',
            estado: 'no_autorizado',
            mensaje,
          });
        }
      }
    } catch {
      this.procesando = false;
    }
  }

  async capturarPatente() {
    if (this.procesando) { return; }
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

  async mostrarResultadoModal(data: {
    tipo: ScanTipo;
    estado?: ScanEstado;
    nombre?: string;
    credencial?: string;
    rut?: string;
    perfil?: string;
    perfilDescripcion?: string;
    titulo?: string;
    mensaje?: string;
    plateResult?: any;
    fotoPreview?: string;
  }) {
    const modal = await this.modalCtrl.create({
      component: ScanResultModalComponent,
      cssClass:  'modal-75',
      componentProps: {
        tipo:        data.tipo,
        estado:      data.estado ?? 'autorizado',
        nombre:      data.nombre,
        credencial:  data.credencial,
        rut:         data.rut,
        perfil:      data.perfil,
        perfilDescripcion: data.perfilDescripcion,
        titulo:      data.titulo,
        mensaje:     data.mensaje,
        plateResult: data.plateResult,
        fotoPreview: data.fotoPreview,
      },
    });

    const estado = data.estado ?? 'autorizado';
    void this.scanSound.play(estado);

    await modal.present();
    const { data: resp, role } = await modal.onDidDismiss();

    if (role === 'accion') {
      const params = this.buildAccesoQueryParams(resp);
      const ruta =
        resp?.via === 'estacionamiento' || resp?.tipo === 'patente'
          ? '/estacionamiento'
          : '/ingreso-manual';
      await this.salirScannerHacia(ruta, params);
    } else {
      await this.reanudarEscaneoTrasModal();
    }
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
    const loading = await this.ui.presentLoading('Validando patente...');

    try {
      const res = await firstValueFrom(this.validarPatenteService.validar(patente));
      await this.ui.dismissLoading(loading);
      await this.mostrarResultadoModal(this.mapValidarPatenteToModal(res, patente));
    } catch (err: unknown) {
      await this.ui.dismissLoading(loading);
      const res = ValidarPatenteUtil.extraerResponse(err);
      if (res) {
        await this.mostrarResultadoModal(this.mapValidarPatenteToModal(res, patente));
      } else {
        const mensaje = this.extraerMensajeError(err) || 'No se pudo validar la patente.';
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

  private async solicitarPatenteManual(): Promise<void> {
    await this.ui.presentAlert({
      cssClass: 'alert-salida',
      header: 'Ingresar patente',
      message: 'No se detectó automáticamente. Ingresa la patente para validar.',
      inputs: [
        {
          name: 'patente',
          type: 'text',
          placeholder: 'Ej: AB1234',
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
          handler: () => {
            void this.prepararEscaneo();
          },
        },
        {
          text: 'Validar',
          cssClass: 'alert-btn-aceptar',
          handler: (data) => {
            const patente = PatenteUtil.toApi(String(data?.patente ?? ''));
            if (PatenteUtil.isFormatValid(patente)) {
              void this.validarPatenteEscaneada(patente);
              return;
            }
            void this.mostrarError('Ingresa una patente válida de 6 caracteres.');
            void this.solicitarPatenteManual();
          },
        },
      ],
    });

    this.procesando = false;
  }

  private esperar(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private mapValidarPatenteToModal(
    res: ValidarPatenteResponse,
    patenteFallback: string
  ): {
    tipo: ScanTipo;
    estado: ScanEstado;
    nombre?: string;
    perfil?: string;
    perfilDescripcion?: string;
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
    };

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
    return {
      plate: patente.toUpperCase(),
      score: 1,
      region: 'cl',
      vehicleType: '',
    };
  }

  private esPatente(valor: string): boolean {
    return PatenteUtil.isFormatValid(valor);
  }

  private mapValidarPerfilToModal(res: ValidarPerfilResponse): {
    tipo: ScanTipo;
    estado: ScanEstado;
    nombre?: string;
    credencial?: string;
    rut?: string;
    perfil?: string;
    perfilDescripcion?: string;
    titulo?: string;
    mensaje?: string;
  } {
    const textos = ValidarPerfilUtil.extraerTituloYMensaje(res);
    const base = {
      tipo: 'credencial' as const,
      nombre: res.nombreCompleto ?? res.perfilDescripcion,
      credencial: res.codigoCredencial ?? res.rut ?? undefined,
      rut: res.rut ?? undefined,
      perfil: res.perfil != null ? String(res.perfil) : undefined,
      perfilDescripcion: res.perfilDescripcion,
      titulo: textos.titulo,
      mensaje: textos.mensaje,
    };

    if (ValidarPerfilUtil.esCredencialExpirada(res)) {
      return {
        ...base,
        estado: 'manual',
        titulo: textos.titulo ?? 'Código QR Expirado',
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

  private buildAccesoQueryParams(resp: {
    patente?: string;
    nombre?: string;
    rut?: string;
    perfil?: string;
    perfilDescripcion?: string;
    estado?: ScanEstado;
    tipo?: ScanTipo;
  }): Record<string, string | null> {
    const perfil =
      resp.perfilDescripcion ??
      (resp.estado === 'no_autorizado' ? 'Visita' : null) ??
      resp.perfil ??
      null;

    return {
      patente: resp.patente ?? null,
      nombre: resp.nombre ?? null,
      rut: resp.rut ?? null,
      perfil,
      origen: resp.tipo ?? null,
      estado: resp.estado ?? null,
    };
  }

  private extraerMensajeError(err: unknown): string | null {
    const apiErr = err as ApiHttpError;
    if (apiErr?.message) {
      return apiErr.message;
    }
    if (apiErr?.error && typeof apiErr.error === 'object' && apiErr.error !== null) {
      const body = apiErr.error as { message?: string };
      if (body.message) {
        return body.message;
      }
    }
    if (err instanceof Error && err.message) {
      return err.message;
    }
    return null;
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
