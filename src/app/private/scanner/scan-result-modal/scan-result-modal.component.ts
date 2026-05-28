import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { PlateResult } from '../../../core/services/plate-recognizer.service';

export type ScanTipo    = 'credencial' | 'cedula' | 'patente';
export type ScanEstado  = 'autorizado' | 'no_autorizado' | 'manual';

export interface ScanResultData {
  tipo:        ScanTipo;
  estado:      ScanEstado;
  nombre?:     string;
  credencial?: string;
  rut?:        string;
  perfil?:     string;
  perfilDescripcion?: string;
  titulo?:     string;
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
  @Input() rut?:        string;
  @Input() perfil?:     string;
  @Input() perfilDescripcion?: string;
  @Input() titulo?:     string;
  @Input() mensaje?:    string;
  @Input() plateResult?: PlateResult;
  @Input() fotoPreview?: string;

  constructor(private modalCtrl: ModalController) {}

  get iconoEstado(): string {
    return { autorizado: 'checkmark', no_autorizado: 'close', manual: 'warning' }[this.estado];
  }

  get colorEstado(): string {
    return { autorizado: '#4CAF50', no_autorizado: '#CC0000', manual: '#FFA000' }[this.estado];
  }

  get tituloModal(): string {
    if (this.titulo) {
      return this.titulo;
    }

    if (this.tipo === 'patente') {
      if (this.titulo) {
        return this.titulo;
      }
      return this.estado === 'autorizado'
        ? 'Acceso Autorizado'
        : 'Acceso No Autorizado';
    }
    return {
      autorizado: 'Acceso Autorizado',
      no_autorizado: 'Acceso No Autorizado',
      manual: 'Ingreso manual',
    }[this.estado];
  }

  get subtitulo(): string {
    if (this.mensaje && this.mensaje !== this.titulo) {
      return this.mensaje;
    }
    return {
      autorizado:      '',
      no_autorizado:   'La persona no pertenece a INACAP. Debe ingresarla como visita.',
      manual:
        'Solicitar mostrar la credencial desde la APP INACAP. Si el problema persiste solicitar Cédula de Identidad.',
    }[this.estado];
  }

  get preguntaAcceso(): string {
    if (this.tipo === 'patente') {
      return '¿Dónde registra el vehículo?';
    }
    return this.estado === 'no_autorizado' || this.estado === 'manual'
      ? '¿Cómo ingresa el visitante?'
      : '¿Cómo ingresa?';
  }

  accesoAccion(via: 'peatonal' | 'estacionamiento') {
    this.modalCtrl.dismiss(
      {
        via,
        tipo: this.tipo,
        estado: this.estado,
        nombre: this.nombre,
        rut: this.rut ?? this.credencial,
        credencial: this.credencial,
        perfil: this.perfil,
        perfilDescripcion: this.perfilDescripcion,
        patente: this.plateResult?.plate,
      },
      'accion'
    );
  }

  cerrar() {
    this.modalCtrl.dismiss(null, 'cancelar');
  }
}
