import { Sede } from '../models/sede.model';

/** Solo Copiapó: modal compacto, sin peatonal/estacionamiento y cierre automático de QR. */
const COPIAPO_ID = 19;
const COPIAPO_NOMBRE = 'copiapo';

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

  if (Number(sede.id) === COPIAPO_ID) {
    return true;
  }

  const nombre = normalizarNombreSede(sede.nombre);
  return nombre === COPIAPO_NOMBRE || nombre.includes(COPIAPO_NOMBRE);
}
