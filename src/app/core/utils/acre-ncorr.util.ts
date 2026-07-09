import { AuthRecinto } from '../models/auth.model';

export function resolverAcreNcorrDesdeRecintos(
  recintosVigentes: AuthRecinto[],
  recintoSeleccionado: AuthRecinto | null
): number | null | undefined {
  if (!recintosVigentes.length) {
    return undefined;
  }

  if (recintosVigentes.length === 1) {
    return recintosVigentes[0].id;
  }

  if (
    recintoSeleccionado &&
    recintosVigentes.some(recinto => recinto.id === recintoSeleccionado.id)
  ) {
    return recintoSeleccionado.id;
  }

  return null;
}

export function acreNcorrValidoParaRequest(
  acreNcorr?: number | null
): acreNcorr is number {
  return typeof acreNcorr === 'number' && acreNcorr > 0;
}
