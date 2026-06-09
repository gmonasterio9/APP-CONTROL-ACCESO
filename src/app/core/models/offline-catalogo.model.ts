import { assertApiSuccess } from '../utils/api-response.util';
import {
  LoginEstacionamientoSesion,
  LoginIngresoManualApi,
} from './login-sesion.model';


export interface OfflineCatalogoAccesoResponse {
  success: boolean;
  code?: number;
  message?: string;
  sedeCcod?: number;
  estacionamiento?: LoginEstacionamientoSesion;
  ingresoManual?: LoginIngresoManualApi;
}

export interface OfflineCatalogoAccesoView {
  sedeCcod?: number;
  estacionamiento?: LoginEstacionamientoSesion;
  sincronizadoEn: string;
}

const STORAGE_KEY = 'offline_catalogo_acceso';

export const OFFLINE_CATALOGO_STORAGE_KEY = STORAGE_KEY;

export function mapOfflineCatalogo(
  res: OfflineCatalogoAccesoResponse
): OfflineCatalogoAccesoView {
  assertApiSuccess(res);

  const estacionamiento =
    res.estacionamiento ??
    (res.ingresoManual
      ? ({
          activo: true,
          jornada: '',
          ingresoManual: res.ingresoManual,
        } satisfies LoginEstacionamientoSesion)
      : undefined);

  return {
    sedeCcod: res.sedeCcod,
    estacionamiento,
    sincronizadoEn: new Date().toISOString(),
  };
}

export function resolverEstacionamientoDesdeCatalogo(
  catalogo: OfflineCatalogoAccesoView | null | undefined
): LoginEstacionamientoSesion | null {
  return catalogo?.estacionamiento ?? null;
}
