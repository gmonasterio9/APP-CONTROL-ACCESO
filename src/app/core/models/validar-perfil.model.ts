export type ValidarPerfilRequest =
  | { qr: string }
  | { rut: string }
  | { email: string };

export interface ValidarPerfilResponse {
  success: boolean;
  perfil?: string;
  perfilDescripcion?: string;
  rut?: string;
  message?: string;
  ingresarManual?: boolean;
}
