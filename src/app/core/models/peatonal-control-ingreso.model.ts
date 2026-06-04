import { assertApiSuccess } from '../utils/api-response.util';

export interface PeatonalControlIngresoRequest {
  persNcorr: number;
}

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
