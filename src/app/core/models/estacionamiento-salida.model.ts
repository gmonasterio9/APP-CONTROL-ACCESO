export interface EstacionamientoSalidaRequest {
  patente: string;
  acreNcorr?: number;
}

export interface EstacionamientoSalidaResponse {
  success: boolean;
  registrado: boolean;
  patente: string;
  message?: string;
}
