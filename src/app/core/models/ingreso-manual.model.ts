export type TipoPersonaIngreso =
  | 'estudiante'
  | 'docente'
  | 'colaborador'
  | 'visita';

export type TipoMedioIngreso = 'auto' | 'bicicleta' | 'moto' | 'peatonal';

export type TipoMedioVehiculo = Exclude<TipoMedioIngreso, 'peatonal'>;

export type TipoQrPeatonal = 'CEDULA' | 'APP' | 'CREDENCIAL_COLABORADOR';

export const INGRESO_MANUAL_ENDPOINT = {
  peatonal: '/ingreso-manual-peatonal',
  vehiculos: '/ingreso-manual-vehiculos',
} as const;

export const OBSERVACIONES_VACIAS = 'Sin observaciones';

export function normalizarObservaciones(value: string): string {
  const texto = value.trim();
  return texto || OBSERVACIONES_VACIAS;
}

function normalizarPerfilDesdeTexto(
  perfil?: string | number | null,
  perfilDescripcion?: string | null
): TipoPersonaIngreso | null {
  const textos = [perfil, perfilDescripcion]
    .map(v => String(v ?? '').trim().toLowerCase())
    .filter(Boolean);

  for (const texto of textos) {
    if (texto === '1' || texto === 'estudiante' || texto.includes('estud')) {
      return 'estudiante';
    }
    if (texto === '2' || texto === 'docente' || texto.includes('docent')) {
      return 'docente';
    }
    if (texto === '3' || texto === 'colaborador' || texto.includes('colabor')) {
      return 'colaborador';
    }
    if (texto === '4' || texto === 'visita' || texto.includes('visit')) {
      return 'visita';
    }
  }

  return null;
}

/** Perfil para ingreso manual tras escaneo rechazado o manual. */
export function resolverPerfilIngresoManual(params: {
  code?: string | null;
  estado?: string | null;
  perfil?: string | number | null;
  perfilDescripcion?: string | null;
  origen?: string | null;
  escaneoPorEmail?: boolean;
}): TipoPersonaIngreso | null {
  if (String(params.code ?? '').trim().toLowerCase() === 'visita') {
    return 'visita';
  }

  const desdeApi = normalizarPerfilDesdeTexto(
    params.perfil,
    params.perfilDescripcion
  );
  if (desdeApi) {
    return desdeApi;
  }

  if (params.escaneoPorEmail) {
    return 'colaborador';
  }

  const origen = String(params.origen ?? '').trim().toLowerCase();
  if (origen === 'credencial') {
    return 'estudiante';
  }

  const estado = String(params.estado ?? '').trim().toLowerCase();
  if (estado === 'no_autorizado' || estado === 'manual') {
    return 'visita';
  }

  return null;
}

export function resolverTipoQr(params: {
  origen?: string | null;
  tipoPersona?: TipoPersonaIngreso | null;
  perfil?: string | null;
  perfilDescripcion?: string | null;
}): TipoQrPeatonal {
  const origen = (params.origen ?? '').trim().toLowerCase();

  if (origen === 'cedula') {
    return 'CEDULA';
  }

  const perfilTxt = [
    params.perfil,
    params.perfilDescripcion,
    params.tipoPersona,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    params.tipoPersona === 'colaborador' ||
    perfilTxt.includes('colabor')
  ) {
    return 'CREDENCIAL_COLABORADOR';
  }

  if (origen === 'credencial') {
    return 'APP';
  }

  return 'CEDULA';
}

export interface IngresoManualPeatonalRequest {
  tipoPersona: TipoPersonaIngreso;
  rut: string;
  nombre: string;
  observaciones: string;
}

export interface IngresoManualVehiculosRequest {
  tipoPersona: TipoPersonaIngreso;
  tipoMedio: TipoMedioVehiculo;
  patente?: string;
  rut: string;
  nombre: string;
  observaciones: string;
}

export type IngresoManualRequest =
  | IngresoManualPeatonalRequest
  | IngresoManualVehiculosRequest;

export function esIngresoManualPeatonal(
  body: IngresoManualRequest
): body is IngresoManualPeatonalRequest {
  return !('tipoMedio' in body);
}

export interface IngresoManualResponse {
  success: boolean;
  registrado?: boolean;
  code?: number;
  message?: string;
  sedeSesionCcod?: number;
  patente?: string;
}

export function ingresoManualFueRegistrado(res: IngresoManualResponse): boolean {
  return res.success === true && res.registrado !== false;
}
