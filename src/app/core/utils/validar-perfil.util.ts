import { ValidarPerfilResponse } from '../models/validar-perfil.model';
import { ApiHttpError } from '../services/api-http.service';

const TITULOS_ACCESO = new Set(['Acceso Autorizado', 'Acceso No Autorizado']);

export class ValidarPerfilUtil {
  private constructor() {}

  static requiereIngresoManual(res: ValidarPerfilResponse): boolean {
    const value = res.ingresarManual;
    return value === true || value === 'true' || value === 1 || value === '1';
  }

  static esFlujoVisita(res: ValidarPerfilResponse): boolean {
    if (String(res.code ?? '').toLowerCase() === 'visita') {
      return true;
    }

    const texto = [
      res.message,
      ...(res.messages ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return texto.includes('visita');
  }

  static esCredencialExpirada(res: ValidarPerfilResponse): boolean {
    const value = res.credencialExpirada;
    return value === true || value === 'true' || value === 1 || value === '1';
  }

  static extraerTituloYMensajeDesdeMessages(
    messages: string[]
  ): { titulo?: string; mensaje?: string } {
    const [first, second] = messages;
    if (TITULOS_ACCESO.has(first)) {
      return { titulo: first, mensaje: second };
    }
    if (messages.length > 1) {
      return { titulo: first, mensaje: second };
    }
    return { mensaje: first };
  }

  static extraerTituloYMensaje(
    res: ValidarPerfilResponse
  ): { titulo?: string; mensaje?: string } {
    if (res.messages?.length) {
      return ValidarPerfilUtil.extraerTituloYMensajeDesdeMessages(res.messages);
    }

    return { mensaje: res.message };
  }

  static extraerResponse(source: unknown): ValidarPerfilResponse | null {
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
}
