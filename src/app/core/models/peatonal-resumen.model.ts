import { assertApiSuccess } from '../utils/api-response.util';

export interface PeatonalResumenTotalesApi {
  autorizados?: number;
  rechazados?: number;
  expirados?: number;
  visitas?: number;
  ingresoManual?: number;
}

export interface PeatonalResumenResponse {
  success: boolean;
  code?: number;
  message?: string;
  sedeCcod?: number;
  fecha?: string;
  totales?: PeatonalResumenTotalesApi;
}

export interface PeatonalStatCard {
  valor: number;
  label: string;
  color: string;
}

export interface PeatonalResumenView {
  sedeCcod?: number;
  fecha?: string;
  stats: PeatonalStatCard[];
}

export function mapPeatonalTotalesToStats(
  t: PeatonalResumenTotalesApi = {}
): PeatonalStatCard[] {
  return [
    { valor: t.autorizados ?? 0, label: 'Autorizados', color: '#2ECC71' },
    { valor: t.rechazados ?? 0, label: 'Rechazados', color: '#CC0000' },
    { valor: t.expirados ?? 0, label: 'Expirados', color: '#8C5E12' },
    { valor: t.visitas ?? 0, label: 'Visitas', color: '#2563EB' },
    {
      valor: t.ingresoManual ?? 0,
      label: 'Ingreso Manual',
      color: '#F39C12',
    },
  ];
}

export function mapPeatonalResumen(res: PeatonalResumenResponse): PeatonalResumenView {
  assertApiSuccess(res);

  return {
    sedeCcod: res.sedeCcod,
    fecha: res.fecha,
    stats: mapPeatonalTotalesToStats(res.totales),
  };
}
