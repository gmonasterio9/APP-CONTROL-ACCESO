import { CONSTANTES_VISTA, ConstanteVista } from '../models/acceso-vista.model';

const RUTA_A_VISTA: Record<string, ConstanteVista> = {
  home: CONSTANTES_VISTA.HOME,
  scanner: CONSTANTES_VISTA.SCANNER,
  'ingreso-manual': CONSTANTES_VISTA.INGRESO_MANUAL,
  estacionamiento: CONSTANTES_VISTA.ESTACIONAMIENTO,
  'estacionamiento-detalle': CONSTANTES_VISTA.ESTACIONAMIENTO_DETALLE,
  confirmacion: CONSTANTES_VISTA.CONFIRMACION,
  'acceso-peatonal-detalle': CONSTANTES_VISTA.ACCESO_PEATONAL_DETALLE,
  'acceso-peatonal-registro': CONSTANTES_VISTA.ACCESO_PEATONAL_REGISTRO,
};

export function resolverConstanteVistaDesdeUrl(url: string): ConstanteVista | null {
  const sinQuery = url.split('?')[0];
  const sinHash = sinQuery.includes('#') ? sinQuery.split('#').pop() ?? '' : sinQuery;
  const segmento = sinHash.replace(/^\/+/, '').split('/')[0];
  return RUTA_A_VISTA[segmento] ?? null;
}
