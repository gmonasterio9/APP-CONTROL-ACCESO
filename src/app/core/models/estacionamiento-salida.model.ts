export interface EstacionamientoSalidaRequest {
  patente: string;
}

export interface EstacionamientoSalidaResponse {
  success: boolean;
  registrado: boolean;
  patente: string;
  message?: string;
}
