import { assertApiSuccess } from '../utils/api-response.util';
import {
  mapPeatonalTotalesToStats,
  PeatonalResumenTotalesApi,
  PeatonalStatCard,
} from './peatonal-resumen.model';

export type PeatonalAccesoEstado =
  | 'permitido'
  | 'manual'
  | 'visita'
  | 'rechazado';

export interface PeatonalAccesoApi {
  apesNcorr: number;
  rut: string | null;
  nombre: string | null;
  estado: string;
  hora: string;
}

export interface PeatonalDetallePaginacionApi {
  pagina: number;
  tamanoPagina: number;
  totalRegistros: number;
  totalPaginas: number;
}

export interface PeatonalDetalleResponse {
  success: boolean;
  code?: number;
  message?: string;
  sedeCcod?: number;
  fecha?: string;
  totales?: PeatonalResumenTotalesApi;
  paginacion: PeatonalDetallePaginacionApi;
  accesos: PeatonalAccesoApi[];
}

export interface PeatonalAccesoView {
  apesNcorr: number;
  rut: string;
  nombre: string;
  estado: PeatonalAccesoEstado;
  hora: string;
}

export interface PeatonalDetalleView {
  sedeCcod?: number;
  fecha?: string;
  stats: PeatonalStatCard[];
  paginacion: PeatonalDetallePaginacionApi;
  accesos: PeatonalAccesoView[];
}

export interface PeatonalDetalleQuery {
  page?: number;
  pageSize?: number;
}

function normalizarEstado(raw?: string): PeatonalAccesoEstado {
  const n = String(raw ?? '')
    .trim()
    .toLowerCase();

  if (
    n === 'permitido' ||
    n === 'manual' ||
    n === 'visita' ||
    n === 'rechazado'
  ) {
    return n;
  }
  if (n.includes('rechaz')) {
    return 'rechazado';
  }
  if (n.includes('visit')) {
    return 'visita';
  }
  if (n.includes('manual')) {
    return 'manual';
  }
  return 'permitido';
}

function mapAcceso(item: PeatonalAccesoApi): PeatonalAccesoView {
  return {
    apesNcorr: item.apesNcorr,
    rut: item.rut?.trim() || '—',
    nombre: item.nombre?.trim() || '—',
    estado: normalizarEstado(item.estado),
    hora: item.hora?.trim() || '—',
  };
}

export function mapPeatonalDetalle(res: PeatonalDetalleResponse): PeatonalDetalleView {
  assertApiSuccess(res);

  return {
    sedeCcod: res.sedeCcod,
    fecha: res.fecha,
    stats: mapPeatonalTotalesToStats(res.totales),
    paginacion: res.paginacion,
    accesos: (res.accesos ?? []).map(mapAcceso),
  };
}

export function buildPeatonalDetalleQuery(params: PeatonalDetalleQuery): string {
  const q = new URLSearchParams();
  q.set('page', String(params.page ?? 1));
  q.set('pageSize', String(params.pageSize ?? 10));
  return q.toString();
}
