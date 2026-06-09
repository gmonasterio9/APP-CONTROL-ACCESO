import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { PlateResult } from '../../../core/services/plate-recognizer.service';

export type TipoEscaneo = 'credencial' | 'cedula' | 'patente';
export type EstadoEscaneo = 'autorizado' | 'no_autorizado' | 'manual';

export interface DatosResultadoEscaneo {
  tipo: TipoEscaneo;
  estado: EstadoEscaneo;
  nombre?: string;
  credencial?: string;
  rut?: string;
  perfil?: string;
  perfilDescripcion?: string;
  persNcorr?: number;
  titulo?: string;
  mensaje?: string;
  plateResult?: PlateResult;
  fotoPreview?: string;
}

@Component({
  selector: 'app-modal-resultado-escaneo',
  templateUrl: 'modal-resultado-escaneo.component.html',
  styleUrls: ['modal-resultado-escaneo.component.scss'],
  standalone: false,
})
export class ModalResultadoEscaneoComponent {
  @Input() tipo: TipoEscaneo = 'credencial';
  @Input() estado: EstadoEscaneo = 'autorizado';
  @Input() nombre?: string;
  @Input() credencial?: string;
  @Input() rut?: string;
  @Input() perfil?: string;
  @Input() perfilDescripcion?: string;
  @Input() persNcorr?: number;
  @Input() code?: string;
  @Input() titulo?: string;
  @Input() mensaje?: string;
  @Input() plateResult?: PlateResult;
  @Input() fotoPreview?: string;
  @Input() controlPeatonalRegistrado = false;
  @Input() escaneoPorEmail = false;

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
      autorizado: '',
      no_autorizado: 'La persona no pertenece a INACAP. Debe ingresarla como visita.',
      manual:
        'Solicitar mostrar la credencial desde la APP INACAP. Si el problema persiste solicitar Cédula de Identidad.',
    }[this.estado];
  }

  /** Expirado: sin acciones; rechazado: peatonal + estacionamiento; autorizado: solo estacionamiento. */
  get mostrarAccesoPeatonal(): boolean {
    return this.tipo !== 'patente' && this.estado === 'no_autorizado';
  }

  get mostrarAccesoEstacionamiento(): boolean {
    return this.estado !== 'manual';
  }

  get mostrarOpcionesAcceso(): boolean {
    return this.mostrarAccesoPeatonal || this.mostrarAccesoEstacionamiento;
  }

  get preguntaAcceso(): string {
    if (!this.mostrarOpcionesAcceso) {
      return '';
    }
    if (this.tipo === 'patente' || this.estado === 'autorizado') {
      return '¿Dónde registra el vehículo?';
    }
    return '¿Cómo ingresa el visitante?';
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
        persNcorr: this.persNcorr,
        code: this.code,
        patente: this.plateResult?.plate,
        controlPeatonalRegistrado: this.controlPeatonalRegistrado,
        escaneoPorEmail: this.escaneoPorEmail,
      },
      'accion'
    );
  }

  cerrar() {
    this.modalCtrl.dismiss(null, 'cancelar');
  }
}
