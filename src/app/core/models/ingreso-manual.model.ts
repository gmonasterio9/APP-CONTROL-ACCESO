export type TipoPersonaIngreso =
  | 'estudiante'
  | 'docente'
  | 'colaborador'
  | 'visita';

export type TipoMedioIngreso = 'auto' | 'bicicleta' | 'moto' | 'peatonal';

export interface IngresoManualRequest {
  tipoPersona: TipoPersonaIngreso;
  tipoMedio: TipoMedioIngreso;
  patente?: string;
  rut: string;
  nombre: string;
  observaciones?: string;
  aepeNcorr?: number;
  aeveNcorr?: number;
}

export interface IngresoManualResponse {
  success: boolean;
  code?: number;
  message?: string;
}
