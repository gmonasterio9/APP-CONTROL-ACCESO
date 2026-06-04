import { assertApiSuccess } from '../utils/api-response.util';
import { TipoQrPeatonal } from './ingreso-manual.model';

export type EstadoControlPeatonalEscaneo = 'EXITOSO' | 'RECHAZADO' | 'EXPIRADO';

export interface PeatonalControlIngresoBase {
  tipoQr: TipoQrPeatonal;
  estado: EstadoControlPeatonalEscaneo;
}

export type IdentificadorControlIngresoPeatonal =
  | { persNcorr: number }
  | { rut: string }
  | { email: string }
  | { qr: string };

export type PeatonalControlIngresoRequest = PeatonalControlIngresoBase &
  IdentificadorControlIngresoPeatonal;

export interface PeatonalControlIngresoResponse {
  success: boolean;
  code?: number;
  message?: string;
}

export function assertPeatonalControlIngresoOk(
  res: PeatonalControlIngresoResponse
): PeatonalControlIngresoResponse {
  assertApiSuccess(res);
  return res;
}
