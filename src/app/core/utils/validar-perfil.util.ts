import { ValidarPerfilResponse } from '../models/validar-perfil.model';
import { ApiHttpError } from '../services/api-http.service';
import { RutUtil } from './rut.util';

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
    if (String(res.code ?? '').toLowerCase() === 'expirado') {
      return true;
    }

    const value = res.credencialExpirada;
    return value === true || value === 'true' || value === 1 || value === '1';
  }

  static normalizarPersNcorr(value: unknown): number | undefined {
    const n =
      typeof value === 'string'
        ? Number(value.trim())
        : typeof value === 'number'
          ? value
          : NaN;

    if (!Number.isFinite(n) || n <= 0) {
      return undefined;
    }

    return Math.trunc(n);
  }

  static normalizarEmail(value: unknown): string | undefined {
    const email = String(value ?? '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return undefined;
    }
    return email;
  }

  static normalizarRut(value: unknown): string | undefined {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return undefined;
    }

    const normalizado = RutUtil.normalizeFromRun(raw);
    if (normalizado.includes('-') && RutUtil.isFormatValid(normalizado)) {
      return normalizado;
    }

    const manual = RutUtil.normalizeManual(raw);
    return RutUtil.isFormatValid(manual) ? manual : undefined;
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
