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
  registrado?: boolean;
  code?: number;
  message?: string;
  apesNcorr?: number;
  tipoQr?: string;
  estado?: EstadoControlPeatonalEscaneo;
  estadoAcceso?: string;
  persNcorr?: number;
  perfil?: number;
  rut?: string;
  nombreCompleto?: string;
}

export interface ResultadoControlPeatonal {
  exito: boolean;
  registrado: boolean;
  message?: string;
  nombreCompleto?: string;
}

export function peatonalControlIngresoFueRegistrado(
  res: PeatonalControlIngresoResponse
): boolean {
  return res.success === true && res.registrado !== false;
}

export function peatonalControlIngresoFueExitoso(
  res: PeatonalControlIngresoResponse
): boolean {
  return res.success === true;
}

export function assertPeatonalControlIngresoOk(
  res: PeatonalControlIngresoResponse
): PeatonalControlIngresoResponse {
  assertApiSuccess(res);
  return res;
}
