import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';
import { PlateResult } from '../../../core/services/plate-recognizer.service';
import { PatenteUtil } from '../../../core/utils/patente.util';

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

const SEDES_CIERRE_RAPIDO_IDS = new Set([11, 19]);
const SEDES_CIERRE_RAPIDO_NOMBRES = ['la serena', 'copiapo'];

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

  private cierreTimer?: ReturnType<typeof setTimeout>;
  private destruido = false;

  constructor(
    private modalCtrl: ModalController,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    if (this.pendienteSalida) {
      return;
    }

    void this.programarCierreRapidoSiAplica();
  }

  ngOnDestroy(): void {
    this.destruido = true;
    this.limpiarCierreTimer();
  }

  private async programarCierreRapidoSiAplica(): Promise<void> {
    if (!(await this.esSedeCierreRapido()) || this.destruido) {
      return;
    }

    this.cierreTimer = setTimeout(() => {
      void this.cerrar();
    }, 2000);
  }

  private async esSedeCierreRapido(): Promise<boolean> {
    const sede = await this.authService.getSede();
    if (!sede) {
      return false;
    }

    if (SEDES_CIERRE_RAPIDO_IDS.has(sede.id)) {
      return true;
    }

    const nombre = this.normalizarNombreSede(sede.nombre);
    return SEDES_CIERRE_RAPIDO_NOMBRES.some(
      clave => nombre === clave || nombre.includes(clave)
    );
  }

  private normalizarNombreSede(value: string): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
  }

  get iconoEstado(): string {
    return { autorizado: 'checkmark', no_autorizado: 'close', manual: 'warning' }[this.estado];
  }

  get colorEstado(): string {
    return { autorizado: '#4CAF50', no_autorizado: '#CC0000', manual: '#FFA000' }[this.estado];
  }

  get tituloModal(): string {
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
      !this.pendienteSalida &&
      !this.esAccesoBloqueado &&
      this.tipo !== 'patente'
    );
  }

  get mostrarAccesoEstacionamiento(): boolean {
    return !this.pendienteSalida && !this.esAccesoBloqueado;
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
    this.limpiarCierreTimer();
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
    this.limpiarCierreTimer();
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
    this.limpiarCierreTimer();
    this.modalCtrl.dismiss(null, 'cancelar');
  }

  private limpiarCierreTimer(): void {
    if (this.cierreTimer) {
      clearTimeout(this.cierreTimer);
      this.cierreTimer = undefined;
    }
  }
}
