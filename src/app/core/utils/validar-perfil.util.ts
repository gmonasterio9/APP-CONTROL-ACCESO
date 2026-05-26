import { ValidarPerfilResponse } from '../models/validar-perfil.model';
import { ApiHttpError } from '../services/api-http.service';

export function requiereIngresoManual(res: ValidarPerfilResponse): boolean {
  const value = res.ingresarManual;
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function esCredencialExpirada(res: ValidarPerfilResponse): boolean {
  const value = res.credencialExpirada;
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function extraerTituloYMensaje(
  res: ValidarPerfilResponse
): { titulo?: string; mensaje?: string } {
  if (res.messages?.length) {
    return {
      titulo: res.messages[0],
      mensaje: res.messages.length > 1 ? res.messages[1] : undefined,
    };
  }

  return { mensaje: res.message };
}

export function extraerValidarPerfilResponse(source: unknown): ValidarPerfilResponse | null {
  const apiErr = source as ApiHttpError;
  const body = apiErr?.error ?? source;

  if (!body || typeof body !== 'object') {
    return null;
  }

  const res = body as ValidarPerfilResponse;
  if (
    'success' in res ||
    'ingresarManual' in res ||
    'credencialExpirada' in res ||
    'perfil' in res
  ) {
    return res;
  }

  return null;
}
