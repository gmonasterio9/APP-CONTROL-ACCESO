export const CONSTANTES_VISTA = {
  HOME: 'HOME',
  SCANNER: 'SCANNER',
  INGRESO_MANUAL: 'INGRESO_MANUAL',
  ESTACIONAMIENTO: 'ESTACIONAMIENTO',
  ESTACIONAMIENTO_DETALLE: 'ESTACIONAMIENTO_DETALLE',
  CONFIRMACION: 'CONFIRMACION',
  ACCESO_PEATONAL_DETALLE: 'ACCESO_PEATONAL_DETALLE',
  ACCESO_PEATONAL_REGISTRO: 'ACCESO_PEATONAL_REGISTRO',
} as const;

export type ConstanteVista = (typeof CONSTANTES_VISTA)[keyof typeof CONSTANTES_VISTA];

export interface AccesoVistaRequest {
  constanteVista: ConstanteVista;
  deviceId: string;
}

export interface AccesoVistaResponse {
  success?: boolean;
  code?: number;
  message?: string;
}
