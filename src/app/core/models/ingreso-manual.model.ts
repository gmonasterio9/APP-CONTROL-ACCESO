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
  tipoQr: TipoQrPeatonal;
  estado: 'EXITOSO';
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
  return 'tipoQr' in body;
}

export interface IngresoManualResponse {
  success: boolean;
  code?: number;
  message?: string;
}
