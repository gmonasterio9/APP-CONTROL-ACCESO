export type CategoriaTipo = 'estudiante' | 'docente' | 'visita';

export type CupoIcono = 'auto' | 'moto' | 'visita';

export interface EstacionamientoDisponibilidadDetalleApi {
  aepeNcorr: number;
  aepeTnombre: string;
  tipoPersona: string;
  aeveNcorr: number;
  aeveTnombre: string;
  tipoVehiculo: string;
  cupos: number;
  ocupados: number;
  disponibles: number;
}

export interface EstacionamientoDisponibilidadTotalesApi {
  cupos: number;
  ocupados: number;
  disponibles: number;
}

export interface EstacionamientoDisponibilidadResponse {
  success: boolean;
  code?: number;
  message?: string;
  sedeCcod: number;
  jornada: string;
  detalle: EstacionamientoDisponibilidadDetalleApi[];
  totales: EstacionamientoDisponibilidadTotalesApi;
}

export interface CupoCategoriaView {
  icono: CupoIcono;
  label: string;
  disponibles: number;
  total: number;
  categoria: CategoriaTipo;
  fullWidth?: boolean;
}

export interface VehiculoActivoView {
  patente: string;
  nombre: string;
  rut: string;
  tipo: string;
  vehiculo: string;
  horaIngreso: string;
}

export interface EstacionamientoDisponibilidadView {
  nombre: string;
  sedeCcod: number;
  jornada: string;
  totales: EstacionamientoDisponibilidadTotalesApi;
  cupos: CupoCategoriaView[];
}

const ORDEN_PERSONA: Record<CategoriaTipo, number> = {
  estudiante: 0,
  docente: 1,
  visita: 2,
};

const ORDEN_VEHICULO: Record<string, number> = {
  auto: 0,
  moto: 1,
  visita: 2,
};

function normalizarClave(valor?: string): string {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function resolverCategoria(tipoPersona: string): CategoriaTipo {
  const n = normalizarClave(tipoPersona);
  if (n.includes('docent')) {
    return 'docente';
  }
  if (n.includes('visit')) {
    return 'visita';
  }
  return 'estudiante';
}

function resolverIcono(tipoVehiculo: string, categoria: CategoriaTipo): CupoIcono {
  if (categoria === 'visita') {
    return 'visita';
  }
  const n = normalizarClave(tipoVehiculo);
  if (n.includes('moto')) {
    return 'moto';
  }
  return 'auto';
}

function etiquetaCupo(item: EstacionamientoDisponibilidadDetalleApi): string {
  return `${item.aeveTnombre} ${item.aepeTnombre}`.trim();
}

function ordenarDetalle(
  items: EstacionamientoDisponibilidadDetalleApi[]
): EstacionamientoDisponibilidadDetalleApi[] {
  return [...items].sort((a, b) => {
    const catA = resolverCategoria(a.tipoPersona);
    const catB = resolverCategoria(b.tipoPersona);
    const porPersona = ORDEN_PERSONA[catA] - ORDEN_PERSONA[catB];
    if (porPersona !== 0) {
      return porPersona;
    }

    const vehA = normalizarClave(a.tipoVehiculo);
    const vehB = normalizarClave(b.tipoVehiculo);
    return (ORDEN_VEHICULO[vehA] ?? 99) - (ORDEN_VEHICULO[vehB] ?? 99);
  });
}

function mapDetalleToCupos(
  detalle: EstacionamientoDisponibilidadDetalleApi[]
): CupoCategoriaView[] {
  return ordenarDetalle(detalle).map(item => {
    const categoria = resolverCategoria(item.tipoPersona);

    return {
      icono: resolverIcono(item.tipoVehiculo, categoria),
      label: etiquetaCupo(item),
      disponibles: item.disponibles,
      total: item.cupos,
      categoria,
      fullWidth: categoria === 'visita',
    };
  });
}

export function mapEstacionamientoDisponibilidad(
  res: EstacionamientoDisponibilidadResponse,
  nombreFallback: string
): EstacionamientoDisponibilidadView {
  return {
    nombre: nombreFallback,
    sedeCcod: res.sedeCcod,
    jornada: res.jornada,
    totales: res.totales,
    cupos: mapDetalleToCupos(res.detalle ?? []),
  };
}
