export type ValidarPerfilRequest =
  | { qr: string }
  | { rut: string }
  | { email: string };

export interface ValidarPerfilResponse {
  success: boolean;
  code?: string;
  perfil?: string | number;
  perfilDescripcion?: string;
  rut?: string | null;
  email?: string | null;
  nombreCompleto?: string | null;
  persNcorr?: number;
  codigoCredencial?: string | null;
  message?: string;
  messages?: string[];
  ingresarManual?: boolean | string | number;
  credencialExpirada?: boolean | string | number;
}
