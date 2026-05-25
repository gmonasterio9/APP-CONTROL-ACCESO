export interface ValidarPatenteRequest {
  patente: string;
}

export interface ValidarPatenteResponse {
  success: boolean;
  code?: number;
  message?: string;
  patente?: string;
}
