import { OfflineColaItem, normalizarPathCola } from './offline-cola.model';
import { acreNcorrValidoParaRequest } from '../utils/acre-ncorr.util';

export const OFFLINE_SINCRONIZAR_INGRESOS_VEHICULOS_PATH =
  '/offline/sincronizar-ingresos-vehiculos';

export const RUTAS_INGRESO_VEHICULAR_TIEMPO_REAL = new Set([
  '/estacionamiento/ingreso',
  '/ingreso-manual-vehiculos',
]);

export type TipoIngresoVehicularOffline =
  | 'ingreso_autorizado'
  | 'ingreso_manual';

export interface OfflineIngresoAutorizadoEvento {
  tipo: 'ingreso_autorizado';
  fechaIngreso: string;
  patente?: string;
  persNcorr?: number;
}

export interface OfflineIngresoManualEvento {
  tipo: 'ingreso_manual';
  fechaIngreso: string;
  patente?: string;
  tipoPersona: string;
  tipoMedio: string;
  rut: string;
  nombre: string;
  observaciones?: string;
}

export type OfflineIngresoVehicularEvento =
  | OfflineIngresoAutorizadoEvento
  | OfflineIngresoManualEvento;

export interface OfflineSincronizarIngresosVehiculosRequest {
  acreNcorr?: number;
  eventos: OfflineIngresoVehicularEvento[];
}

export interface OfflineSincronizarIngresosVehiculosResponse {
  success: boolean;
  message?: string;
}

const RUTAS_INGRESO_VEHICULAR = RUTAS_INGRESO_VEHICULAR_TIEMPO_REAL;

export function IngresoVehicularCola(path: string): boolean {
  return RUTAS_INGRESO_VEHICULAR.has(normalizarPathCola(path));
}

export function formatearFechaIngresoOffline(fechaIso: string): string {
  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) {
    return fechaIso;
  }

  const pad = (valor: number) => String(valor).padStart(2, '0');
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}:${pad(fecha.getSeconds())}`;
}

export function resolverAcreNcorrDesdeColaItem(
  item: OfflineColaItem,
  acreNcorrFallback?: number | null
): number | null | undefined {
  const body = (item.body ?? {}) as Record<string, unknown>;
  const acre = body['acreNcorr'];

  if (typeof acre === 'number' && acre > 0) {
    return acre;
  }

  return acreNcorrFallback;
}

export function mapColaItemAEventoIngresoVehicular(
  item: OfflineColaItem
): OfflineIngresoVehicularEvento | null {
  const ruta = normalizarPathCola(item.path);
  const body = (item.body ?? {}) as Record<string, unknown>;
  const fechaIngreso = formatearFechaIngresoOffline(item.creadoEn);

  if (ruta === '/estacionamiento/ingreso') {
    const patente = String(body['patente'] ?? '').trim().toUpperCase();
    const persNcorr = body['persNcorr'];

    if (!patente && !(typeof persNcorr === 'number' && persNcorr > 0)) {
      return null;
    }

    return {
      tipo: 'ingreso_autorizado',
      fechaIngreso,
      ...(patente ? { patente } : {}),
      ...(typeof persNcorr === 'number' && persNcorr > 0 ? { persNcorr } : {}),
    };
  }

  if (ruta === '/ingreso-manual-vehiculos') {
    const tipoPersona = String(body['tipoPersona'] ?? '').trim();
    const tipoMedio = String(body['tipoMedio'] ?? '').trim();
    const rut = String(body['rut'] ?? '').trim();
    const nombre = String(body['nombre'] ?? '').trim();
    const patente = String(body['patente'] ?? '').trim().toUpperCase();
    const observaciones = String(body['observaciones'] ?? '').trim();

    if (!tipoPersona || !tipoMedio || !rut || !nombre) {
      return null;
    }

    return {
      tipo: 'ingreso_manual',
      fechaIngreso,
      tipoPersona,
      tipoMedio,
      rut,
      nombre,
      ...(patente ? { patente } : {}),
      ...(observaciones ? { observaciones } : {}),
    };
  }

  return null;
}

export function agruparIngresosVehicularesConsecutivos(
  items: OfflineColaItem[],
  acreNcorrFallback?: number | null
): OfflineColaItem[][] {
  if (!items.length) {
    return [];
  }

  const grupos: OfflineColaItem[][] = [];
  let grupoActual: OfflineColaItem[] = [];
  let acreActual: number | null | undefined;

  for (const item of items) {
    const acre = resolverAcreNcorrDesdeColaItem(item, acreNcorrFallback);

    if (grupoActual.length && acre !== acreActual) {
      grupos.push(grupoActual);
      grupoActual = [];
    }

    grupoActual.push(item);
    acreActual = acre;
  }

  if (grupoActual.length) {
    grupos.push(grupoActual);
  }

  return grupos;
}

export function construirSincronizarIngresosVehiculosRequest(
  items: OfflineColaItem[],
  acreNcorrFallback?: number | null
): OfflineSincronizarIngresosVehiculosRequest | null {
  if (!items.length) {
    return null;
  }

  const acreNcorr = resolverAcreNcorrDesdeColaItem(items[0], acreNcorrFallback);

  const eventos = items
    .map(mapColaItemAEventoIngresoVehicular)
    .filter((evento): evento is OfflineIngresoVehicularEvento => evento != null);

  if (!eventos.length) {
    return null;
  }

  return {
    ...(acreNcorrValidoParaRequest(acreNcorr) ? { acreNcorr } : {}),
    eventos,
  };
}
