export interface EstacionamientoTotales {
  cupos: number;
  ocupados: number;
  disponibles: number;
}

export interface EstacionamientoItem {
  aeseNcorr: number;
  aeseTnombre: string;
  sedeCcod: number;
  sedeTdesc: string;
  aeseHinicioVespertino: string;
  direccion: string | null;
  totales: EstacionamientoTotales;
}

export interface EstacionamientoListResponse {
  success: boolean;
  sedeCcod: number;
  estacionamientos: EstacionamientoItem[];
}

/** Vista para tarjetas en Home. */
export interface EstacionamientoCard {
  id: number;
  nombre: string;
  ubicacion: string;
  cuposDisponibles: number;
  cuposTotales: number;
  hinicioVespertino: string;
}

export function mapEstacionamientoCard(item: EstacionamientoItem): EstacionamientoCard {
  return {
    id: item.aeseNcorr,
    nombre: item.aeseTnombre,
    ubicacion: item.direccion?.trim() || item.sedeTdesc,
    cuposDisponibles: item.totales.disponibles,
    cuposTotales: item.totales.cupos,
    hinicioVespertino: item.aeseHinicioVespertino,
  };
}
