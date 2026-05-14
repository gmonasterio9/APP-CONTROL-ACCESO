import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ActionSheetController, LoadingController, ModalController, NavController, ToastController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { AuthService } from '../../core/services/auth.service';
import { ScannerService } from '../../core/services/scanner.service';
import { PlateRecognizerService } from '../../core/services/plate-recognizer.service';
import { ScanResultModalComponent, ScanTipo, ScanEstado } from './scan-result-modal/scan-result-modal.component';

export interface Estacionamiento {
  id: number;
  nombre: string;
  ubicacion: string;
  cuposDisponibles: number;
  cuposTotales: number;
}

export interface AccesoPeatonal {
  id: number;
  nombre: string;
  ubicacion: string;
  estado: string;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  segmentoActivo = 'estacionamientos';
  scannerActivo  = false;
  readonly esDev = !environment.production;

  tiposEscaneo = [
    { id: 'credencial', label: 'Credencial', svg: 'assets/svg/credencial.svg', color: '#FEEB80' },
    { id: 'cedula',     label: 'Cédula',     svg: 'assets/svg/cedula.svg',     color: '#A7B0F1' },
    { id: 'patente',    label: 'Patente',    svg: 'assets/svg/patente.svg',    color: '#FFB066' },
  ];

  estacionamientos: Estacionamiento[] = [
    { id: 1, nombre: 'Estacionamiento Principal',   ubicacion: 'Entrada Av. Vitacura',      cuposDisponibles: 71, cuposTotales: 75 },
    { id: 2, nombre: 'Estacionamiento Norte',        ubicacion: 'Sector Talleres',            cuposDisponibles: 11, cuposTotales: 75 },
    { id: 3, nombre: 'Estacionamiento Subterráneo',  ubicacion: 'Edificio Central - Subsuelo', cuposDisponibles: 46, cuposTotales: 55 },
  ];

  accesosPeatonales: AccesoPeatonal[] = [
    { id: 1, nombre: 'Entrada Principal', ubicacion: 'Acceso Av. Vitacura', estado: 'Abierto' },
    { id: 2, nombre: 'Entrada Norte',     ubicacion: 'Sector Talleres',     estado: 'Abierto' },
  ];

  statsPeatonal = [
    { valor: 142, label: 'Autorizados', color: '#2ECC71' },
    { valor: 3,   label: 'Expirados',   color: '#F39C12' },
    { valor: 5,   label: 'Visitas',     color: '#2563EB' },
  ];

  constructor(
    private authService: AuthService,
    private actionSheetCtrl: ActionSheetController,
    private loadingCtrl: LoadingController,
    private modalCtrl: ModalController,
    public navCtrl: NavController,
    private toastCtrl: ToastController,
    private scannerService: ScannerService,
    private plateService: PlateRecognizerService,
  ) {}

  porcentaje(item: Estacionamiento): number {
    return Math.round((item.cuposDisponibles / item.cuposTotales) * 100);
  }

  colorBarra(_item: Estacionamiento): string {
    return '#4CAF50';
  }

  async escanear(tipo: ScanTipo = 'credencial'): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      const toast = await this.toastCtrl.create({
        message: 'El escáner solo funciona  en dispositivos móviles.',
        duration: 2500, color: 'warning', position: 'bottom',
      });
      await toast.present();
      return;
    }

    this.scannerActivo = true;

    try {
      if (tipo === 'patente') {
        await this.escanearPatente();
      } else {
        await this.escanearQR(tipo);
      }
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (!msg.includes('cancel') && !msg.includes('Cancel') && !msg.includes('User')) {
        const toast = await this.toastCtrl.create({
          message: 'Error al escanear. Intenta de nuevo.',
          duration: 2500, color: 'danger', position: 'bottom',
        });
        await toast.present();
      }
    } finally {
      this.scannerActivo = false;
    }
  }

  private async escanearQR(tipo: ScanTipo): Promise<void> {
    const valor = await this.scannerService.scanQR();
    if (!valor) return;
    await this.procesarResultadoQR(tipo, valor);
  }

  async simularEscaneo(tipo: ScanTipo, estado: ScanEstado): Promise<void> {
    const qrMock: Record<ScanEstado, string> = {
      autorizado:    'CRED:INP-2024-001|Carlos Rojas Muñoz',
      expirado:      'EXPI:INP-2022-009|María González Pérez',
      no_autorizado: 'VISITA:EXT-2024-055',
    };
    await this.procesarResultadoQR(tipo, qrMock[estado]);
  }

  private async procesarResultadoQR(tipo: ScanTipo, valor: string): Promise<void> {
    let estado: ScanEstado;
    let nombre: string | undefined;
    let credencial: string | undefined;

    if (valor.startsWith('CRED:')) {
      estado     = 'autorizado';
      const p    = valor.replace('CRED:', '').split('|');
      credencial = p[0];
      nombre     = p[1];
    } else if (valor.startsWith('EXPI:')) {
      estado     = 'expirado';
      const p    = valor.replace('EXPI:', '').split('|');
      credencial = p[0];
      nombre     = p[1];
    } else {
      estado     = 'no_autorizado';
      credencial = valor;
    }

    await this.mostrarResultadoModal({ tipo, estado, nombre, credencial });
  }

  private async escanearPatente(): Promise<void> {
    const base64 = await this.scannerService.takePhotoBase64();
    if (!base64) return;

    const loading = await this.loadingCtrl.create({ message: 'Leyendo patente...' });
    await loading.present();

    try {
      const plate = await this.plateService.readPlate(base64);
      await loading.dismiss();
      if (plate) {
        await this.mostrarResultadoModal({ tipo: 'patente', plateResult: plate, fotoPreview: base64 });
      } else {
        const toast = await this.toastCtrl.create({
          message: 'No se detectó ninguna patente. Intenta con otra foto.',
          duration: 3000, color: 'warning', position: 'bottom',
        });
        await toast.present();
      }
    } catch {
      await loading.dismiss();
      const toast = await this.toastCtrl.create({
        message: 'Error al conectar con el servicio. Verifica tu conexión.',
        duration: 3000, color: 'danger', position: 'bottom',
      });
      await toast.present();
    }
  }

  private async mostrarResultadoModal(data: {
    tipo: ScanTipo;
    estado?: ScanEstado;
    nombre?: string;
    credencial?: string;
    mensaje?: string;
    plateResult?: any;
    fotoPreview?: string;
  }): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ScanResultModalComponent,
      componentProps: data,
      cssClass: 'modal-75',
    });
    await modal.present();

    const { data: result, role } = await modal.onDidDismiss<{ via: string; nombre?: string; credencial?: string }>();

    if (role === 'accion' && result?.via === 'estacionamiento') {
      await this.navCtrl.navigateForward('/estacionamiento', {
        queryParams: { nombre: data.nombre, credencial: data.credencial },
      });
    }

    if (role === 'accion' && result?.via === 'peatonal') {
      await this.navCtrl.navigateForward('/ingreso-manual', {
        queryParams: { nombre: data.nombre },
      });
    }
  }

  ingresoManual(): void {
    this.navCtrl.navigateForward('/ingreso-manual');
  }

  verDetalleEstacionamiento(e: Estacionamiento): void {
    this.navCtrl.navigateForward('/estacionamiento-detalle', {
      queryParams: { nombre: e.nombre, ubicacion: e.ubicacion },
    });
  }

  async cerrarSesion(): Promise<void> {
    const sheet = await this.actionSheetCtrl.create({
      header: '¿Cerrar sesión?',
      subHeader: 'Se cerrará tu sesión actual',
      buttons: [
        {
          text: 'Cerrar sesión',
          role: 'destructive',
          icon: 'log-out-outline',
          handler: async () => {
            const loading = await this.loadingCtrl.create({ message: 'Cerrando sesión...' });
            await loading.present();
            await new Promise(r => setTimeout(r, 800));
            await loading.dismiss();
            this.authService.logout();
          },
        },
        {
          text: 'Cancelar',
          role: 'cancel',
          icon: 'close-outline',
          cssClass: 'action-sheet-cancel',
        },
      ],
    });
    await sheet.present();
  }
}
