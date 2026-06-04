import { assertApiSuccess } from '../utils/api-response.util';

export interface EstacionamientoIngresoPorPersonaRequest {
  persNcorr: number;
}

export interface EstacionamientoIngresoPorPatenteRequest {
  patente: string;
}

export type EstacionamientoIngresoRequest =
  | EstacionamientoIngresoPorPersonaRequest
  | EstacionamientoIngresoPorPatenteRequest;

export interface EstacionamientoIngresoResponse {
  success: boolean;
  code?: number;
  message?: string;
}

export function assertEstacionamientoIngresoOk(
  res: EstacionamientoIngresoResponse
): EstacionamientoIngresoResponse {
  assertApiSuccess(res);
  return res;
}
