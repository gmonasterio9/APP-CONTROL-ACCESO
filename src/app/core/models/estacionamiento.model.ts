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
  nombre: string;
  ubicacion: string;
  cuposDisponibles: number;
  cuposTotales: number;
  hinicioVespertino: string;
}

export function mapEstacionamientoCard(item: EstacionamientoItem): EstacionamientoCard {
  const id = item.acreNcorr ?? item.aeseNcorr ?? 0;
  const nombre = item.acreTnombre ?? item.aeseTnombre ?? 'Estacionamiento';
  const ubicacion =
    item.acreTubicacion?.trim() ||
    item.direccion?.trim() ||
    item.sedeTdesc?.trim() ||
    'Sin ubicación';
  const hinicioVespertino = item.aeseHinicioVespertino ?? '';

  return {
    id,
    nombre,
    ubicacion,
    cuposDisponibles: item.totales.disponibles,
    cuposTotales: item.totales.cupos,
    hinicioVespertino,
  };
}
