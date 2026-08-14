export interface ValidarPatenteRequest {
  patente: string;
  acreNcorr?: number;
}

export interface ValidarPatenteResponse {
  success: boolean;
  valida?: boolean;
  tipoAcceso?: string;
  ingresarComoVisita?: boolean;
  perfil?: string | number;
  perfilDescripcion?: string;
  nombreCompleto?: string | null;
  code?: number | string;
  message?: string;
  messages?: string[];
  patente?: string;
  persNcorr?: number;
  ingresoActivo?: boolean;
  dentro?: boolean;
  salidaPendiente?: boolean;
  acreNcorr?: number;
  aeseNcorr?: number;
}
