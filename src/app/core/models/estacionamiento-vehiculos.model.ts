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
}

function mapVehiculo(item: VehiculoActivoApi): VehiculoActivoView {
  return {
    patente: item.patente?.toUpperCase() ?? '',
    nombre: item.nombre ?? '—',
    rut: item.rut ?? '—',
    tipo: item.tipoPerfil ?? '—',
    vehiculo: item.tipoVehiculo ?? '—',
    horaIngreso: item.horaIngreso ?? '—',
  };
}

export function mapVehiculosActivos(res: VehiculosActivosResponse): VehiculosActivosView {
  return {
    sedeCcod: res.sedeCcod,
    paginacion: res.paginacion,
    vehiculos: (res.vehiculos ?? []).map(mapVehiculo),
  };
}

export function buildVehiculosActivosQuery(params: VehiculosActivosQuery): string {
  const q = new URLSearchParams();
  q.set('page', String(params.page ?? 1));
  q.set('pageSize', String(params.pageSize ?? 10));

  const patente = params.patente?.trim();
  if (patente) {
    q.set('patente', patente);
  }

  return q.toString();
}
