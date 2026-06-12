export interface OfflineColaItem {
  id: string;
  path: string;
  body: unknown;
  creadoEn: string;
  intentos: number;
}

export const OFFLINE_COLA_STORAGE_KEY = 'offline_cola_sync';

export const MENSAJE_POST_ENCOLADO =
  'Operación guardada localmente. Se sincronizará al recuperar conexión.';

export const POST_SIN_COLA_OFFLINE = new Set([
  '/login',
  '/refresh',
  '/logout',
  '/validar-patente',
  '/validar-perfil',
]);

export function normalizarPathCola(path: string): string {
  const sinQuery = path.split('?')[0].trim();
  return sinQuery.startsWith('/') ? sinQuery : `/${sinQuery}`;
}

export function debeEncolarPostOffline(path: string): boolean {
  return !POST_SIN_COLA_OFFLINE.has(normalizarPathCola(path));
}

export function esPostEncoladoOffline(res: unknown): res is { offlineQueued: true } {
  return (
    typeof res === 'object' &&
    res !== null &&
    (res as { offlineQueued?: boolean }).offlineQueued === true
  );
}

export function crearIdColaOffline(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function respuestaOptimistaPost(
  path: string,
  body: unknown
): Record<string, unknown> {
  const base = {
    success: true,
    offlineQueued: true,
    message: MENSAJE_POST_ENCOLADO,
  };

  const ruta = normalizarPathCola(path);

  if (ruta === '/estacionamiento/salida') {
    const patente = String((body as { patente?: string })?.patente ?? '').trim();
    return { ...base, registrado: true, patente };
  }

  if (
    ruta === '/peatonal/control-ingreso' ||
    ruta === '/estacionamiento/ingreso' ||
    ruta === '/ingreso-manual-peatonal' ||
    ruta === '/ingreso-manual-vehiculos'
  ) {
    return { ...base, registrado: true };
  }

  return base;
}
