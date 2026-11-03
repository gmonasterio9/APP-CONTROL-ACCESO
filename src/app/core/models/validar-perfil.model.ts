export type ValidarPerfilRequest =
  | { qr: string }
  | { rut: string }
  | { email: string };

export interface ValidarPerfilBloqueo {
  bloqNcorr?: number;
  tipoBloqueo?: number;
  tipoBloqueoDescripcion?: string;
  observacion?: string;
  fechaBloqueo?: string;
  fechaDesbloqueo?: string | null;
  periodoCcod?: number;
}

export interface ValidarPerfilResponse {
  success: boolean;
  code?: string;
  sedeSesionCcod?: number;
  perfil?: string | number;
  perfilDescripcion?: string;
  rut?: string | null;
  email?: string | null;
  nombreCompleto?: string | null;
  persNcorr?: number;
  /** Patente asociada al perfil (si la persona tiene vehículo registrado). */
  patente?: string | null;
  aeveNcorr?: number | null;
  aeveTnombre?: string | null;
  codigoCredencial?: string | null;
  message?: string;
  messages?: string[];
  observacion?: string;
  bloqueo?: ValidarPerfilBloqueo;
  ingresarManual?: boolean | string | number;
  credencialExpirada?: boolean | string | number;
  jornada?: string | null;
  registrado?: boolean;
  apesNcorr?: number | null;
  tipoQr?: string | null;
  estado?: string | null;
  estadoAcceso?: string | null;
}
