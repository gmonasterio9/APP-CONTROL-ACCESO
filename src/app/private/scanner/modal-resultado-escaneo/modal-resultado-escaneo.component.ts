import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { PlateResult } from '../../../core/services/plate-recognizer.service';
import {
  CODE_SIN_CONEXION,
  DETALLE_SIN_CONEXION_USUARIO,
  obtenerMensajeSinConexion,
  TITULO_SIN_CONEXION_USUARIO,
} from '../../../core/utils/api-response.util';
import { PatenteUtil } from '../../../core/utils/patente.util';
import { RutUtil } from '../../../core/utils/rut.util';
import { labelTipoQrPeatonal } from '../../../core/models/peatonal-detalle.model';

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
export class ModalResultadoEscaneoComponent implements OnInit, OnDestroy {
  @Input() tipo: TipoEscaneo = 'credencial';
  @Input() estado: EstadoEscaneo = 'autorizado';
  @Input() nombre?: string;
  @Input() credencial?: string;
  @Input() rut?: string;
  @Input() perfil?: string;
  @Input() perfilDescripcion?: string;
  @Input() jornada?: string;
  @Input() tipoQr?: string;
  @Input() persNcorr?: number;
  @Input() code?: string;
  @Input() titulo?: string;
  @Input() mensaje?: string;
  @Input() plateResult?: PlateResult;
  @Input() fotoPreview?: string;
  @Input() controlPeatonalExito = false;
  @Input() escaneoPorEmail = false;
  @Input() codigoEscaneado?: string;
  @Input() email?: string;
  @Input() pendienteSalida = false;
  @Input() acreNcorr?: number | null;
  @Input() aeseNcorr?: number | null;
  /** Tablet peatonal: muestra los datos y no ofrece registrar ingreso. */
  @Input() soloInformativo = false;

  private cierreTimer?: ReturnType<typeof setTimeout>;
  /** Tiempo para leer nombre, perfil y credencial antes de volver a la cámara. */
  private readonly CIERRE_AUTOMATICO_MS = 5_000;

  constructor(private modalCtrl: ModalController) {}

  ngOnInit(): void {
    if (!this.soloInformativo) {
      return;
    }
    this.cierreTimer = setTimeout(() => this.cerrar(), this.CIERRE_AUTOMATICO_MS);
  }

  ngOnDestroy(): void {
    this.cancelarCierreAutomatico();
  }

  get rutVisible(): string {
    return RutUtil.formatDisplay(this.rut);
  }

  get tipoQrVisible(): string {
    return labelTipoQrPeatonal(this.tipoQr) ?? '';
  }

  get esSinConexion(): boolean {
    if (String(this.code ?? '').toLowerCase() === CODE_SIN_CONEXION) {
      return true;
    }
    return !!obtenerMensajeSinConexion(this.mensaje, this.titulo);
  }

  get iconoEstado(): string {
    if (this.esSinConexion) {
      return 'cloud-offline';
    }
    return { autorizado: 'checkmark', no_autorizado: 'close', manual: 'warning' }[this.estado];
  }

  get colorEstado(): string {
    if (this.esSinConexion) {
      return '#64748B';
    }
    return { autorizado: '#4CAF50', no_autorizado: '#CC0000', manual: '#FFA000' }[this.estado];
  }

  get tituloModal(): string {
    if (this.esSinConexion) {
      return TITULO_SIN_CONEXION_USUARIO;
    }

    if (this.pendienteSalida) {
      return 'Acceso Autorizado';
    }

    if (this.titulo) {
      return this.titulo;
    }

    if (this.tipo === 'patente') {
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
    if (this.pendienteSalida) {
      return '';
    }

    if (this.esSinConexion) {
      return DETALLE_SIN_CONEXION_USUARIO;
    }

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

  get esAccesoBloqueado(): boolean {
    return String(this.code ?? '').toLowerCase() === 'bloqueado';
  }

  get mostrarAccesoPeatonal(): boolean {
    return (
      !this.soloInformativo &&
      !this.esSinConexion &&
      !this.pendienteSalida &&
      !this.esAccesoBloqueado &&
      this.tipo !== 'patente'
    );
  }

  get mostrarAccesoEstacionamiento(): boolean {
    return (
      !this.soloInformativo &&
      !this.esSinConexion &&
      !this.pendienteSalida &&
      !this.esAccesoBloqueado
    );
  }

  get mostrarOpcionesAcceso(): boolean {
    return this.mostrarAccesoPeatonal || this.mostrarAccesoEstacionamiento;
  }

  get preguntaAcceso(): string {
    if (!this.mostrarOpcionesAcceso) {
      return '';
    }
    if (this.tipo === 'patente') {
      return '¿Dónde registra el vehículo?';
    }
    return '¿Cómo desea registrar el ingreso?';
  }

  get patenteMedioEtiqueta(): string {
    if (!this.plateResult?.plate) {
      return '';
    }

    const medio =
      PatenteUtil.inferirMedio(PatenteUtil.limpiar(this.plateResult.plate)) ??
      (this.plateResult.vehicleType === 'moto' ? 'moto' : null);

    return PatenteUtil.etiquetaMedio(medio);
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
        controlPeatonalExito: this.controlPeatonalExito,
        escaneoPorEmail: this.escaneoPorEmail,
        codigoEscaneado: this.codigoEscaneado,
        email: this.email,
      },
      'accion'
    );
  }

  confirmarSalida() {
    this.modalCtrl.dismiss(
      {
        via: 'salida',
        tipo: this.tipo,
        estado: this.estado,
        nombre: this.nombre,
        patente: this.plateResult?.plate,
        perfil: this.perfilDescripcion ?? this.perfil,
        acreNcorr: this.acreNcorr,
        aeseNcorr: this.aeseNcorr,
      },
      'accion'
    );
  }

  cerrar() {
    this.cancelarCierreAutomatico();
    void this.modalCtrl.dismiss(null, 'cancelar');
  }

  private cancelarCierreAutomatico(): void {
    if (!this.cierreTimer) {
      return;
    }
    clearTimeout(this.cierreTimer);
    this.cierreTimer = undefined;
  }
}
