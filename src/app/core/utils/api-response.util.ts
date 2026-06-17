export interface ApiHttpError {
  status: number;
  error?: unknown;
  message?: string;
}

export interface ApiResultBase {
  success?: boolean;
  code?: number | string;
  message?: string;
}

export function parseApiPayload(data: unknown): unknown {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as unknown;
    } catch {
      return data;
    }
  }

  return data;
}

export function isUnauthorizedApiResult(data: unknown): boolean {
  const parsed = parseApiPayload(data);

  if (!parsed || typeof parsed !== 'object') {
    return false;
  }

  const body = parsed as ApiResultBase;
  const code = body.code;

  if (code === 401 || code === '401') {
    return true;
  }

  const message = (body.message ?? '').toLowerCase();
  if (!message) {
    return false;
  }

  if (
    message.includes('token de acceso requerido') ||
    message.includes('token requerido') ||
    message.includes('sin token')
  ) {
    return true;
  }

  const mencionaCredencial =
    message.includes('token') ||
    message.includes('acceso') ||
    message.includes('autoriz') ||
    message.includes('auth');

  const mencionaInvalido =
    message.includes('expirado') ||
    message.includes('no válido') ||
    message.includes('no valido') ||
    message.includes('invalid') ||
    message.includes('vencid') ||
    message.includes('requerido');

  return mencionaCredencial && mencionaInvalido;
}

export function toApiHttpError(
  data: unknown,
  status = 401
): ApiHttpError {
  if (
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof (data as ApiResultBase).message === 'string'
  ) {
    return {
      status,
      error: data,
      message: (data as ApiResultBase).message,
    };
  }

  return {
    status,
    error: data,
    message: 'Token de acceso no válido o expirado.',
  };
}

function esMensajeTecnico(mensaje: string): boolean {
  const m = mensaje.trim();
  if (!m) {
    return true;
  }

  return (
    /^Http failure response/i.test(m) ||
    /Unknown Error/i.test(m) ||
    /^Network Error/i.test(m) ||
    /^Error de red$/i.test(m) ||
    (m.includes('/api/v1/') && m.includes('Http failure')) ||
    m.includes('Sin conexión con el servidor')
  );
}

function extraerMensajeCrudo(err: unknown): string | null {
  const apiErr = err as ApiHttpError;

  if (typeof apiErr?.message === 'string' && apiErr.message.trim()) {
    return apiErr.message.trim();
  }

  const body = apiErr?.error;
  if (
    body &&
    typeof body === 'object' &&
    'message' in body &&
    typeof (body as ApiResultBase).message === 'string'
  ) {
    const msg = (body as ApiResultBase).message?.trim();
    if (msg) {
      return msg;
    }
  }

  if (err instanceof Error && err.message.trim()) {
    return err.message.trim();
  }

  return null;
}

export const MENSAJE_ERROR_SIN_CONEXION =
  'Revise su internet o intente más tarde.';

export function mensajePorEstadoHttp(
  status: number,
  fallback: string
): string {
  if (status === 0) {
    return MENSAJE_ERROR_SIN_CONEXION;
  }

  if (status === 401 || status === 403) {
    return 'Sesión expirada o sin permisos. Vuelva a iniciar sesión.';
  }

  if (status >= 500) {
    return 'El servidor no está disponible. Intente más tarde.';
  }

  if (status === 404) {
    return 'No se encontró la información solicitada.';
  }

  return fallback;
}

/** Mensaje legible para pantallas; oculta errores técnicos de HttpClient/Capacitor. */
export function mensajeErrorUsuario(err: unknown, fallback: string): string {
  const apiErr = err as ApiHttpError;
  const status = typeof apiErr?.status === 'number' ? apiErr.status : 0;
  const crudo = extraerMensajeCrudo(err);

  if (status === 0 || (crudo && esMensajeTecnico(crudo))) {
    return MENSAJE_ERROR_SIN_CONEXION;
  }

  if (crudo) {
    return crudo;
  }

  return mensajePorEstadoHttp(status, fallback);
}

export function assertApiSuccess<T extends ApiResultBase>(res: T): T {
  if (res.success !== false) {
    return res;
  }

  if (isUnauthorizedApiResult(res)) {
    throw toApiHttpError(res, 401);
  }

  throw new Error(res.message ?? 'Error en la solicitud.');
}
