import { Sede } from '../models/sede.model';

const SEDES_DESATENDIDAS_IDS = new Set([19]);
const SEDES_DESATENDIDAS_NOMBRES = ['copiapo'];

export function normalizarNombreSede(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function esSedeDesatendida(sede: Sede | null | undefined): sede is Sede {
  if (!sede) {
    return false;
  }

  if (SEDES_DESATENDIDAS_IDS.has(sede.id)) {
    return true;
  }

  const nombre = normalizarNombreSede(sede.nombre);
  return SEDES_DESATENDIDAS_NOMBRES.some(
    clave => nombre === clave || nombre.includes(clave)
  );
}
