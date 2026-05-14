import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { PlateResult } from '../../../core/services/plate-recognizer.service';

export type ScanTipo    = 'credencial' | 'cedula' | 'patente';
export type ScanEstado  = 'autorizado' | 'no_autorizado' | 'expirado';

export interface ScanResultData {
  tipo:        ScanTipo;
  estado:      ScanEstado;
  nombre?:     string;
  credencial?: string;
  mensaje?:    string;
  plateResult?: PlateResult;
  fotoPreview?: string;
}

@Component({
  selector: 'app-scan-result-modal',
  templateUrl: 'scan-result-modal.component.html',
  styleUrls: ['scan-result-modal.component.scss'],
  standalone: false,
})
export class ScanResultModalComponent {
  @Input() tipo:        ScanTipo   = 'credencial';
  @Input() estado:      ScanEstado = 'autorizado';
  @Input() nombre?:     string;
  @Input() credencial?: string;
  @Input() mensaje?:    string;
  @Input() plateResult?: PlateResult;
  @Input() fotoPreview?: string;

  constructor(private modalCtrl: ModalController) {}

  get iconoEstado(): string {
    return { autorizado: 'checkmark', no_autorizado: 'close', expirado: 'warning' }[this.estado];
  }

  get colorEstado(): string {
    return { autorizado: '#4CAF50', no_autorizado: '#CC0000', expirado: '#FFA000' }[this.estado];
  }

  get titulo(): string {
    if (this.tipo === 'patente') {
      return this.plateResult ? 'Acceso Autorizado' : 'Sin Resultado';
    }
    return { autorizado: 'Acceso Autorizado', no_autorizado: 'Acceso No Autorizado', expirado: 'Código QR Expirado' }[this.estado];
  }

  get subtitulo(): string {
    if (this.mensaje) return this.mensaje;
    return {
      autorizado:      '',
      no_autorizado:   'La persona no pertenece a INACAP. Debe ingresarla como visita.',
      expirado:        'Solicitar mostrar la credencial desde la APP INACAP. Si el problema persiste solicitar Cédula de Identidad.',
    }[this.estado];
  }

  get preguntaAcceso(): string {
    return this.estado === 'no_autorizado' ? '¿Cómo ingresa el visitante?' : '¿Cómo ingresa?';
  }

  accesoAccion(via: 'peatonal' | 'estacionamiento') {
    this.modalCtrl.dismiss({ via, tipo: this.tipo, estado: this.estado }, 'accion');
  }

  cerrar() {
    this.modalCtrl.dismiss(null, 'cancelar');
  }
}
