export interface EstacionamientoTotales {
  cupos: number;
  ocupados: number;
  disponibles: number;
}

export interface EstacionamientoItem {
  acreNcorr?: number;
  acreTnombre?: string;
  acreTubicacion?: string | null;
  aeseNcorr?: number;
  aeseTnombre?: string;
  aeseHinicioVespertino?: string;
  direccion?: string | null;
  sedeCcod: number;
  sedeTdesc: string | null;
  totales: EstacionamientoTotales;
}

export interface EstacionamientoListResponse {
  success: boolean;
  sedeCcod: number;
  estacionamientos: EstacionamientoItem[];
}

export interface EstacionamientoCard {
  id: number;
  acreNcorr: number | null;
  aeseNcorr: number | null;
  nombre: string;
  ubicacion: string;
  cuposDisponibles: number;
  cuposTotales: number;
  hinicioVespertino: string;
}

function ncorrPositivo(value?: number | null): number | null {
  return typeof value === 'number' && value > 0 ? value : null;
}

export function mapEstacionamientoCard(item: EstacionamientoItem): EstacionamientoCard {
  const acreNcorr = ncorrPositivo(item.acreNcorr);
  const aeseNcorr = ncorrPositivo(item.aeseNcorr);
  const id = aeseNcorr ?? acreNcorr ?? 0;
  const nombre = item.acreTnombre ?? item.aeseTnombre ?? 'Estacionamiento';
  const ubicacion =
    item.acreTubicacion?.trim() ||
    item.direccion?.trim() ||
    item.sedeTdesc?.trim() ||
    'Sin ubicación';
  const hinicioVespertino = item.aeseHinicioVespertino ?? '';

  return {
    id,
    acreNcorr,
    aeseNcorr,
    nombre,
    ubicacion,
    cuposDisponibles: item.totales.disponibles,
    cuposTotales: item.totales.cupos,
    hinicioVespertino,
  };
}
