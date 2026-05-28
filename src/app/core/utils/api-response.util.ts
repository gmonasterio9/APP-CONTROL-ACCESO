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

export function isUnauthorizedApiResult(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const body = data as ApiResultBase;
  const code = body.code;

  if (code === 401 || code === '401') {
    return true;
  }

  const message = (body.message ?? '').toLowerCase();
  if (!message) {
    return false;
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
    message.includes('vencid');

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

export function assertApiSuccess<T extends ApiResultBase>(res: T): T {
  if (res.success !== false) {
    return res;
  }

  if (isUnauthorizedApiResult(res)) {
    throw toApiHttpError(res, 401);
  }

  throw new Error(res.message ?? 'Error en la solicitud.');
}
