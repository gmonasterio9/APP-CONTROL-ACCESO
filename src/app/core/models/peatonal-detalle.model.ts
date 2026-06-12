import { assertApiSuccess } from '../utils/api-response.util';
import { RutUtil } from '../utils/rut.util';
import {
  mapPeatonalTotalesToStats,
  PeatonalResumenTotalesApi,
  PeatonalStatCard,
} from './peatonal-resumen.model';

export type PeatonalAccesoEstado =
  | 'permitido'
  | 'manual'
  | 'visita'
  | 'rechazado'
  | 'expirado';

export interface PeatonalAccesoApi {
  apesNcorr: number;
  apexNcorr?: number | null;
  persNcorr?: number | null;
  rut: string | null;
  nombre: string | null;
  tipoQr?: string | null;
  estado: string;
  tipoPerfil?: number | null;
  tipoPerfilDescripcion?: string | null;
  observacion?: string | null;
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
  tipoQrLabel: string | null;
  estado: PeatonalAccesoEstado;
  hora: string;
  observacion: string | null;
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

const ESTADO_API_MAP: Record<string, PeatonalAccesoEstado> = {
  permitido: 'permitido',
  autorizado: 'permitido',
  exitoso: 'permitido',
  manual: 'manual',
  ingreso_manual: 'manual',
  visita: 'visita',
  rechazado: 'rechazado',
  rechazada: 'rechazado',
  no_autorizado: 'rechazado',
  denegado: 'rechazado',
  expirado: 'expirado',
  expirada: 'expirado',
};

function normalizarEstado(raw?: string): PeatonalAccesoEstado {
  const n = String(raw ?? '')
    .trim()
    .toLowerCase();

  if (!n) {
    return 'rechazado';
  }

  const exacto = ESTADO_API_MAP[n];
  if (exacto) {
    return exacto;
  }

  if (n.includes('expir')) {
    return 'expirado';
  }
  if (n.includes('rechaz') || n.includes('deneg') || n.includes('no_autor')) {
    return 'rechazado';
  }
  if (n.includes('visit')) {
    return 'visita';
  }
  if (n.includes('manual') || n.includes('ingreso_manual')) {
    return 'manual';
  }
  if (n.includes('autoriz') || n.includes('permit') || n.includes('exitos')) {
    return 'permitido';
  }

  return 'rechazado';
}

const TIPO_QR_LABELS: Record<string, string> = {
  cedula: 'Cédula',
  app: 'APP INACAP',
  credencial_colaborador: 'Credencial colaborador',
};

export function labelTipoQrPeatonal(raw?: string | null): string | null {
  const clave = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!clave) {
    return null;
  }
  return TIPO_QR_LABELS[clave] ?? clave;
}

function mapAcceso(item: PeatonalAccesoApi): PeatonalAccesoView {
  const observacion = item.observacion?.trim() || null;

  return {
    apesNcorr: item.apesNcorr,
    rut: item.rut?.trim()
      ? RutUtil.formatDisplay(item.rut)
      : '—',
    nombre: item.nombre?.trim() || '—',
    tipoQrLabel: labelTipoQrPeatonal(item.tipoQr),
    estado: normalizarEstado(item.estado),
    hora: item.hora?.trim() || '—',
    observacion,
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
