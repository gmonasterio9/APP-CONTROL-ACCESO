import { RutUtil } from '../utils/rut.util';
import { VehiculoActivoView } from './estacionamiento-disponibilidad.model';

export interface VehiculoActivoApi {
  patente: string;
  nombre: string;
  rut: string;
  tipoPerfil: string;
  tipoVehiculo: string;
  horaIngreso: string;
}

export interface VehiculosActivosPaginacionApi {
  pagina: number;
  tamanoPagina: number;
  totalRegistros: number;
  totalPaginas: number;
}

export interface VehiculosActivosResponse {
  success: boolean;
  code?: number;
  message?: string;
  sedeCcod: number;
  paginacion: VehiculosActivosPaginacionApi;
  vehiculos: VehiculoActivoApi[];
}

export interface VehiculosActivosView {
  sedeCcod: number;
  paginacion: VehiculosActivosPaginacionApi;
  vehiculos: VehiculoActivoView[];
}

export interface VehiculosActivosQuery {
  page?: number;
  pageSize?: number;
  patente?: string;
  acreNcorr?: number;
  aeseNcorr?: number;
  tipoPerfil?: string;
  tipoVehiculo?: string;
}

function mapVehiculo(item: VehiculoActivoApi): VehiculoActivoView {
  return {
    patente: item.patente?.toUpperCase() ?? '',
    nombre: item.nombre ?? '—',
    rut: item.rut?.trim()
      ? RutUtil.formatDisplay(item.rut)
      : '—',
    tipo: item.tipoPerfil ?? '—',
    vehiculo: item.tipoVehiculo ?? '—',
    horaIngreso: item.horaIngreso ?? '—',
  };
}

export function mapVehiculosActivos(res: VehiculosActivosResponse): VehiculosActivosView {
  const pag = res.paginacion ?? {
    pagina: 1,
    tamanoPagina: 10,
    totalRegistros: 0,
    totalPaginas: 0,
  };

  const totalRegistros = Number(pag.totalRegistros) || 0;
  const tamanoPagina = Number(pag.tamanoPagina) || 10;
  const totalPaginas =
    Number(pag.totalPaginas) ||
    (totalRegistros > 0 ? Math.ceil(totalRegistros / tamanoPagina) : 0);

  return {
    sedeCcod: res.sedeCcod,
    paginacion: {
      pagina: Number(pag.pagina) || 1,
      tamanoPagina,
      totalRegistros,
      totalPaginas,
    },
    vehiculos: (res.vehiculos ?? []).map(mapVehiculo),
  };
}

export function buildVehiculosActivosQuery(params: VehiculosActivosQuery): string {
  const q = new URLSearchParams();
  q.set('page', String(params.page ?? 1));

  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 50));
  q.set('pageSize', String(pageSize));

  const patente = params.patente?.trim();
  if (patente) {
    q.set('patente', patente);
  }

  if (params.acreNcorr != null && params.acreNcorr > 0) {
    q.set('acreNcorr', String(params.acreNcorr));
  }

  if (params.aeseNcorr != null && params.aeseNcorr > 0) {
    q.set('aeseNcorr', String(params.aeseNcorr));
  }

  const tipoPerfil = params.tipoPerfil?.trim();
  if (tipoPerfil) {
    q.set('tipoPerfil', tipoPerfil);
  }

  const tipoVehiculo = params.tipoVehiculo?.trim();
  if (tipoVehiculo) {
    q.set('tipoVehiculo', tipoVehiculo);
  }

  return q.toString();
}
