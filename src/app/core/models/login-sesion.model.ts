import {
  TipoMedioIngreso,
  TipoMedioVehiculo,
  TipoPersonaIngreso,
} from './ingreso-manual.model';

/** Catálogo mínimo en POST /login → `estacionamiento.ingresoManual`. */
export interface LoginIngresoManualApi {
  personas: string[];
  vehiculos: string[];
  peatonal: string[];
}

export interface LoginEstacionamientoSesion {
  activo: boolean;
  jornada: string;
  ingresoManual?: LoginIngresoManualApi;
}

export interface OpcionTipoPersonaIngreso {
  value: TipoPersonaIngreso;
  label: string;
  aepeNcorr?: number;
  apexNtipoPerfil?: number;
  cupoDesde?: TipoPersonaIngreso;
}

export interface OpcionTipoMedioIngreso {
  value: TipoMedioIngreso;
  label: string;
  aeveNcorr?: number;
}

export interface CatalogoIngresoManualSesion {
  vehicular: {
    tiposPersona: OpcionTipoPersonaIngreso[];
    tiposMedio: OpcionTipoMedioIngreso[];
  };
  peatonal: {
    tiposPersona: OpcionTipoPersonaIngreso[];
  };
  medios: OpcionTipoMedioIngreso[];
}

const PERSONAS_VALIDAS: readonly TipoPersonaIngreso[] = [
  'estudiante',
  'docente',
  'colaborador',
  'visita',
];

const VEHICULOS_VALIDOS: readonly TipoMedioVehiculo[] = [
  'auto',
  'moto',
  'bicicleta',
];

const PERSONA_LABEL: Record<TipoPersonaIngreso, string> = {
  estudiante: 'Estudiante',
  docente: 'Docente',
  colaborador: 'Colaborador',
  visita: 'Visita',
};

const MEDIO_LABEL: Record<TipoMedioVehiculo, string> = {
  auto: 'Auto',
  moto: 'Moto',
  bicicleta: 'Bicicleta',
};

/** Perfil peatonal por slug (cuando el login no envía `perfil`). */
const PERFIL_PEATONAL_POR_PERSONA: Record<TipoPersonaIngreso, number> = {
  estudiante: 1,
  docente: 2,
  colaborador: 3,
  visita: 4,
};

const PERSONA_DEFAULT: OpcionTipoPersonaIngreso[] = PERSONAS_VALIDAS.map(
  value => ({ value, label: PERSONA_LABEL[value] })
);

const MEDIO_VEHICULAR_DEFAULT: OpcionTipoMedioIngreso[] = VEHICULOS_VALIDOS.map(
  value => ({ value, label: MEDIO_LABEL[value] })
);

function normalizarSlug(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function parseTipoPersona(raw: string): TipoPersonaIngreso | null {
  const n = normalizarSlug(raw);
  return PERSONAS_VALIDAS.find(p => p === n) ?? null;
}

function parseTipoVehiculo(raw: string): TipoMedioVehiculo | null {
  const n = normalizarSlug(raw);
  if (VEHICULOS_VALIDOS.includes(n as TipoMedioVehiculo)) {
    return n as TipoMedioVehiculo;
  }
  if (n.includes('moto')) {
    return 'moto';
  }
  if (n.includes('bicic')) {
    return 'bicicleta';
  }
  if (n.includes('auto') || n.includes('automov')) {
    return 'auto';
  }
  return null;
}

function mapPersonasDesdeSlugs(slugs: string[]): OpcionTipoPersonaIngreso[] {
  const vistos = new Set<TipoPersonaIngreso>();
  const opciones: OpcionTipoPersonaIngreso[] = [];

  for (const raw of slugs) {
    const value = parseTipoPersona(raw);
    if (!value || vistos.has(value)) {
      continue;
    }
    vistos.add(value);
    opciones.push({
      value,
      label: PERSONA_LABEL[value],
      apexNtipoPerfil: PERFIL_PEATONAL_POR_PERSONA[value],
    });
  }

  return opciones;
}

function mapVehiculosDesdeSlugs(slugs: string[]): OpcionTipoMedioIngreso[] {
  const vistos = new Set<TipoMedioVehiculo>();
  const opciones: OpcionTipoMedioIngreso[] = [];

  for (const raw of slugs) {
    const value = parseTipoVehiculo(raw);
    if (!value || vistos.has(value)) {
      continue;
    }
    vistos.add(value);
    opciones.push({ value, label: MEDIO_LABEL[value] });
  }

  return opciones;
}

export function mapTiposPersonaVehicular(
  sesion?: LoginEstacionamientoSesion | null
): OpcionTipoPersonaIngreso[] {
  const slugs = sesion?.ingresoManual?.personas;
  if (!slugs?.length) {
    return PERSONA_DEFAULT;
  }

  const opciones = mapPersonasDesdeSlugs(slugs);
  return opciones.length ? opciones : PERSONA_DEFAULT;
}

export function mapTiposPersonaPeatonal(
  sesion?: LoginEstacionamientoSesion | null
): OpcionTipoPersonaIngreso[] {
  const slugs = sesion?.ingresoManual?.peatonal;
  if (!slugs?.length) {
    return PERSONA_DEFAULT;
  }

  const opciones = mapPersonasDesdeSlugs(slugs);
  return opciones.length ? opciones : PERSONA_DEFAULT;
}

export function mapTiposMedioVehicular(
  sesion?: LoginEstacionamientoSesion | null
): OpcionTipoMedioIngreso[] {
  const slugs = sesion?.ingresoManual?.vehiculos;
  if (!slugs?.length) {
    return MEDIO_VEHICULAR_DEFAULT;
  }

  const opciones = mapVehiculosDesdeSlugs(slugs);
  return opciones.length ? opciones : MEDIO_VEHICULAR_DEFAULT;
}

export function mapTiposMedioIngresoManual(
  sesion?: LoginEstacionamientoSesion | null
): OpcionTipoMedioIngreso[] {
  const medios = mapTiposMedioVehicular(sesion);

  if (sesion?.ingresoManual?.peatonal?.length) {
    medios.push({ value: 'peatonal', label: 'Peatonal' });
  }

  return medios;
}

export function mapCatalogoIngresoManual(
  sesion?: LoginEstacionamientoSesion | null
): CatalogoIngresoManualSesion {
  const tiposPersonaVehicular = mapTiposPersonaVehicular(sesion);
  const tiposPersonaPeatonal = mapTiposPersonaPeatonal(sesion);
  const tiposMedioVehicular = mapTiposMedioVehicular(sesion);

  return {
    vehicular: {
      tiposPersona: tiposPersonaVehicular,
      tiposMedio: tiposMedioVehicular,
    },
    peatonal: { tiposPersona: tiposPersonaPeatonal },
    medios: mapTiposMedioIngresoManual(sesion),
  };
}

export function resolverApexNtipoPerfil(
  sesion: LoginEstacionamientoSesion | null | undefined,
  tipoPersona: TipoPersonaIngreso
): number | undefined {
  const enPeatonal = sesion?.ingresoManual?.peatonal?.some(
    s => parseTipoPersona(s) === tipoPersona
  );
  if (!enPeatonal) {
    return undefined;
  }
  return PERFIL_PEATONAL_POR_PERSONA[tipoPersona];
}
