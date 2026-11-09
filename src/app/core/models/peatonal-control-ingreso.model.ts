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
  code?: number | string;
  message?: string;
  messages?: string[];
  apesNcorr?: number;
  tipoQr?: string;
  estado?: EstadoControlPeatonalEscaneo;
  estadoAcceso?: string;
  persNcorr?: number;
  perfil?: number;
  perfilDescripcion?: string;
  rut?: string;
  nombreCompleto?: string;
  jornada?: string | null;
  credencialExpirada?: boolean;
  sedeSesionCcod?: number;
}

export interface ResultadoControlPeatonal {
  exito: boolean;
  registrado: boolean;
  message?: string;
  nombreCompleto?: string;
  rut?: string;
  perfilDescripcion?: string;
  jornada?: string;
  tipoQr?: string;
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
