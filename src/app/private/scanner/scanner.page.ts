import { Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { NavController, ModalController, ToastController } from '@ionic/angular';
import { PluginListenerHandle } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

import { PlateRecognizerService } from '../../core/services/plate-recognizer.service';
import { ScanResultModalComponent, ScanTipo, ScanEstado } from './scan-result-modal/scan-result-modal.component';

@Component({
  selector: 'app-scanner',
  templateUrl: 'scanner.page.html',
  styleUrls: ['scanner.page.scss'],
  standalone: false,
})
export class ScannerPage implements OnDestroy {
  @ViewChild('videoRef') videoRef!: ElementRef<HTMLVideoElement>;

  procesando      = false;
  permisoDenegado = false;
  camaraLista     = false;

  private videoStream:   MediaStream | null = null;
  private scanInterval:  any = null;
  private mlkitListener: PluginListenerHandle | null = null;
  private usandoMLKit  = false;

  constructor(
    private navCtrl:      NavController,
    private modalCtrl:    ModalController,
    private toastCtrl:    ToastController,
    private plateService: PlateRecognizerService,
    private zone:         NgZone,
  ) {}

  async ionViewWillEnter() {
    await this.iniciarEscaneo();
  }

  async ionViewWillLeave() {
    this.detenerTodo();
  }

  ngOnDestroy() {
    this.detenerTodo();
  }

  // ─── Iniciar cámara y escaneo QR ──────────────────────────────────
  async iniciarEscaneo() {
    this.permisoDenegado = false;
    this.camaraLista     = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      this.videoStream = stream;

      setTimeout(async () => {
        const video = this.videoRef?.nativeElement;
        if (!video) { return; }
        video.srcObject = stream;
        video.oncanplay = () => { this.zone.run(() => { this.camaraLista = true; }); };
        await video.play();
        this.iniciarDeteccionQR();
      }, 80);

    } catch (e: any) {
      if (e?.name === 'NotAllowedError') {
        this.permisoDenegado = true;
      } else {
        await this.iniciarMLKit();
      }
    }
  }

  // ─── Detección QR con BarcodeDetector (WebView nativo) ───────────
  private iniciarDeteccionQR() {
    if (!('BarcodeDetector' in window)) {
      this.iniciarMLKit();
      return;
    }

    const detector = new (window as any).BarcodeDetector({
      formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'data_matrix'],
    });

    this.scanInterval = setInterval(async () => {
      if (this.procesando) { return; }
      const video = this.videoRef?.nativeElement;
      if (!video || video.readyState < 2) { return; }

      try {
        const barcodes = await detector.detect(video);
        if (barcodes?.length > 0) {
          const valor = barcodes[0].rawValue as string;
          this.zone.run(() => this.onCodigoDetectado(valor));
        }
      } catch {}
    }, 400);
  }

  // ─── Fallback: MLKit con fondo transparente ───────────────────────
  private async iniciarMLKit() {
    this.detenerVideoStream();
    try {
      const permisos = await BarcodeScanner.requestPermissions();
      if (permisos.camera !== 'granted' && permisos.camera !== 'limited') {
        this.permisoDenegado = true;
        return;
      }
      this.usandoMLKit = true;
      document.body.classList.add('barcode-scanning-active');

      this.mlkitListener = await BarcodeScanner.addListener('barcodesScanned', (event) => {
        if (!this.procesando && event.barcodes?.length > 0) {
          const valor = event.barcodes[0].rawValue ?? '';
          this.zone.run(() => this.onCodigoDetectado(valor));
        }
      });

      await BarcodeScanner.startScan();
    } catch {
      await this.mostrarError('No se pudo iniciar el escáner.');
    }
  }

  // ─── Código detectado (QR o barcode) ─────────────────────────────
  async onCodigoDetectado(valor: string) {
    if (this.procesando || !valor.trim()) { return; }
    this.procesando = true;
    this.detenerDeteccion();

    const tipo: ScanTipo = this.esPatente(valor) ? 'patente' : 'credencial';

    if (tipo === 'patente') {
      await this.mostrarResultadoModal({
        tipo: 'patente',
        estado: 'autorizado',
        plateResult: { plate: valor.toUpperCase(), score: 1, region: 'cl', vehicleType: '' },
      });
    } else {
      await this.mostrarResultadoModal(this.validarQR(valor));
    }

    this.procesando = false;
  }

  // ─── Capturar frame para patente ──────────────────────────────────
  async capturarPatente() {
    if (this.procesando) { return; }
    this.procesando = true;
    this.detenerDeteccion();

    try {
      let base64: string;

      if (this.videoStream) {
        const video = this.videoRef.nativeElement;
        const canvas = document.createElement('canvas');
        canvas.width  = video.videoWidth  || 1280;
        canvas.height = video.videoHeight || 720;
        canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
        base64 = canvas.toDataURL('image/jpeg', 0.92);
      } else {
        this.procesando = false;
        await this.mostrarError('Cámara no disponible.');
        return;
      }

      const plateResult = await this.plateService.readPlate(base64);
      await this.mostrarResultadoModal({
        tipo: 'patente',
        estado: 'autorizado',
        plateResult: plateResult ?? undefined,
        fotoPreview: base64,
      });
    } catch {
      await this.mostrarError('Error al detectar la patente. Intenta de nuevo.');
      await this.iniciarEscaneo();
    }

    this.procesando = false;
  }

  // ─── Cerrar ───────────────────────────────────────────────────────
  async volver() {
    this.detenerTodo();
    this.navCtrl.back();
  }

  // ─── Modal resultado ──────────────────────────────────────────────
  async mostrarResultadoModal(data: {
    tipo: ScanTipo;
    estado?: ScanEstado;
    nombre?: string;
    credencial?: string;
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
        mensaje:     data.mensaje,
        plateResult: data.plateResult,
        fotoPreview: data.fotoPreview,
      },
    });

    await modal.present();
    const { data: resp, role } = await modal.onDidDismiss();

    if (role === 'accion') {
      if (resp?.via === 'estacionamiento') {
        this.navCtrl.navigateForward('/estacionamiento');
      } else if (resp?.via === 'peatonal') {
        this.navCtrl.navigateForward('/ingreso-manual');
      }
    } else {
      await this.iniciarEscaneo();
    }
  }

  // ─── Detener ──────────────────────────────────────────────────────
  private detenerDeteccion() {
    if (this.scanInterval) { clearInterval(this.scanInterval); this.scanInterval = null; }
    if (this.usandoMLKit) {
      document.body.classList.remove('barcode-scanning-active');
      BarcodeScanner.stopScan().catch(() => {});
      this.mlkitListener?.remove();
      this.mlkitListener = null;
      this.usandoMLKit = false;
    }
  }

  private detenerVideoStream() {
    this.camaraLista = false;
    this.videoStream?.getTracks().forEach(t => t.stop());
    this.videoStream = null;
    if (this.videoRef?.nativeElement) {
      this.videoRef.nativeElement.srcObject = null;
    }
  }

  private detenerTodo() {
    this.detenerDeteccion();
    this.detenerVideoStream();
  }

  // ─── Helpers ──────────────────────────────────────────────────────
  private esPatente(valor: string): boolean {
    return /^[A-Za-z]{2,4}\d{2,4}$/.test(valor.trim());
  }

  private validarQR(valor: string): { tipo: ScanTipo; estado: ScanEstado; nombre?: string; credencial?: string } {
    if (valor.startsWith('CRED:')) {
      const p = valor.replace('CRED:', '').split('|');
      return { tipo: 'credencial', estado: 'autorizado', nombre: p[0], credencial: p[1] };
    }
    if (valor.startsWith('EXPI:')) {
      return { tipo: 'credencial', estado: 'expirado' };
    }
    if (valor.startsWith('VISITA:')) {
      return { tipo: 'cedula', estado: 'no_autorizado', credencial: valor.replace('VISITA:', '') };
    }
    return { tipo: 'credencial', estado: 'no_autorizado' };
  }

  private async mostrarError(msg: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2500, color: 'danger', position: 'bottom' });
    await t.present();
  }
}
