import { assertApiSuccess } from '../utils/api-response.util';

export interface EstacionamientoAbrirBarreraRequest {
  patente: string;
  aecaNcorr: number;
}

export interface EstacionamientoAbrirBarreraResponse {
  success: boolean;
  registrado?: boolean;
  message?: string;
}

export function assertAbrirBarreraOk(
  res: EstacionamientoAbrirBarreraResponse
): EstacionamientoAbrirBarreraResponse {
  assertApiSuccess(res);
  return res;
}
