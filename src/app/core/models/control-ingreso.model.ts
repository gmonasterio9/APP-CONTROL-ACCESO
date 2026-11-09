export type ControlIngresoOrigen = 'credencial' | 'cedula' | 'patente';

export type ControlIngresoTipoMedio = 'peatonal' | 'auto';

export interface ControlIngresoRequest {
  rut: string;
  nombre: string;
  tipoMedio: ControlIngresoTipoMedio;
  perfil?: string;
  perfilDescripcion?: string;
  patente?: string;
  codigoCredencial?: string;
  persNcorr?: number;
  aeseNcorr?: number;
  origen?: ControlIngresoOrigen;
}

export interface ControlIngresoResponse {
  success: boolean;
  code?: number;
  message?: string;
}
