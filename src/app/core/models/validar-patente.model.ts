export interface ValidarPatenteRequest {
  patente: string;
  acreNcorr?: number;
  confirmarIngreso?: boolean;
}

export interface BarreraOpcion {
  aecaNcorr: number;
  nombre: string;
}

export interface BarreraIngreso {
  abierta?: boolean;
  requiereSeleccion?: boolean;
  opciones?: BarreraOpcion[];
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
  registrado?: boolean;
  barrera?: BarreraIngreso;
}
