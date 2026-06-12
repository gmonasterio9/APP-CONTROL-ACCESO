import { assertApiSuccess } from '../utils/api-response.util';
import {
  EstacionamientoDisponibilidadResponse,
  EstacionamientoDisponibilidadView,
  mapEstacionamientoDisponibilidad,
} from './estacionamiento-disponibilidad.model';
import {
  EstacionamientoCard,
  EstacionamientoListResponse,
  mapEstacionamientoCard,
} from './estacionamiento.model';
import {
  buildVehiculosActivosQuery,
  mapVehiculosActivos,
  VehiculosActivosResponse,
  VehiculosActivosView,
} from './estacionamiento-vehiculos.model';
import {
  LoginEstacionamientoSesion,
  LoginIngresoManualApi,
} from './login-sesion.model';
import {
  buildPeatonalDetalleQuery,
  mapPeatonalDetalle,
  PeatonalDetalleResponse,
  PeatonalDetalleView,
} from './peatonal-detalle.model';
import { ValidarPerfilBloqueo } from './validar-perfil.model';
import {
  mapPeatonalResumen,
  PeatonalResumenResponse,
  PeatonalResumenView,
} from './peatonal-resumen.model';

export interface OfflineCatalogoTotales {
  personas?: number;
  patentes?: number;
}

export interface OfflinePersonaCatalogo {
  persNcorr: number;
  rut: string;
  emailInacap?: string;
  nombreCompleto: string;
  perfil: number;
  perfilDescripcion: string;
  accesoPeatonal: boolean;
  accesoVehicular: boolean;
  bloqueado?: boolean;
  bloqueo?: ValidarPerfilBloqueo | null;
}

export interface OfflinePatenteCatalogo {
  aepoNcorr: number;
  patente: string;
  persNcorr: number;
  rut: string;
  nombreCompleto: string;
  aepeNcorr?: number;
  aeveNcorr?: number;
  tipoPersona?: string;
  tipoVehiculo?: string;
}

export interface OfflineCatalogoAccesoResponse {
  success: boolean;
  code?: number;
  message?: string;
  sedeCcod?: number;
  periodoCcod?: number;
  generadoEn?: string;
  totales?: OfflineCatalogoTotales;
  personas?: OfflinePersonaCatalogo[];
  patentes?: OfflinePatenteCatalogo[];
  estacionamiento?: LoginEstacionamientoSesion;
  ingresoManual?: LoginIngresoManualApi;
}

export interface OfflineEstacionamientoDetalleCache {
  aeseNcorr: number;
  nombre: string;
  ubicacion: string;
  disponibilidad?: EstacionamientoDisponibilidadView;
  vehiculosActivos?: VehiculosActivosView;
}

export interface OfflineCatalogoAccesoView {
  sedeCcod?: number;
  periodoCcod?: number;
  generadoEn?: string;
  totales?: OfflineCatalogoTotales;
  personas?: OfflinePersonaCatalogo[];
  patentes?: OfflinePatenteCatalogo[];
  estacionamiento?: LoginEstacionamientoSesion;
  sincronizadoEn: string;
  resumenPeatonal?: PeatonalResumenView;
  detallePeatonal?: PeatonalDetalleView;
  estacionamientos?: EstacionamientoCard[];
  estacionamientosDetalle?: Record<number, OfflineEstacionamientoDetalleCache>;
}

const STORAGE_KEY = 'offline_catalogo_acceso';

export const OFFLINE_CATALOGO_STORAGE_KEY = STORAGE_KEY;

export function mapOfflineCatalogo(
  res: OfflineCatalogoAccesoResponse
): OfflineCatalogoAccesoView {
  assertApiSuccess(res);

  const estacionamiento =
    res.estacionamiento ??
    (res.ingresoManual
      ? ({
          activo: true,
          jornada: '',
          ingresoManual: res.ingresoManual,
        } satisfies LoginEstacionamientoSesion)
      : undefined);

  return {
    sedeCcod: res.sedeCcod,
    periodoCcod: res.periodoCcod,
    generadoEn: res.generadoEn,
    totales: res.totales,
    personas: res.personas ?? [],
    patentes: res.patentes ?? [],
    estacionamiento,
    sincronizadoEn: new Date().toISOString(),
  };
}

export function resolverEstacionamientoDesdeCatalogo(
  catalogo: OfflineCatalogoAccesoView | null | undefined
): LoginEstacionamientoSesion | null {
  return catalogo?.estacionamiento ?? null;
}

export function buildPeatonalResumenCacheUrl(): string {
  return '/peatonal/resumen';
}

export function buildPeatonalDetalleCacheUrl(): string {
  return `/peatonal/detalle?${buildPeatonalDetalleQuery({ page: 1, pageSize: 10 })}`;
}

export function buildEstacionamientosCacheUrl(): string {
  return '/estacionamiento';
}

export function buildEstacionamientoDisponibilidadCacheUrl(aeseNcorr: number): string {
  return `/estacionamiento/disponibilidad?aeseNcorr=${aeseNcorr}`;
}

export function buildEstacionamientoVehiculosCacheUrl(): string {
  return `/estacionamiento/vehiculos-activos?${buildVehiculosActivosQuery({
    page: 1,
    pageSize: 10,
  })}`;
}

export function mapDisponibilidadEstacionamientoDesdeApi(
  res: EstacionamientoDisponibilidadResponse,
  nombreFallback: string
): EstacionamientoDisponibilidadView {
  return mapEstacionamientoDisponibilidad(res, nombreFallback);
}

export function mapVehiculosActivosEstacionamientoDesdeApi(
  res: VehiculosActivosResponse
): VehiculosActivosView {
  return mapVehiculosActivos(res);
}

export function mapEstacionamientosDesdeApi(
  res: EstacionamientoListResponse
): EstacionamientoCard[] {
  assertApiSuccess(res);
  return (res.estacionamientos ?? []).map(mapEstacionamientoCard);
}

export function mapResumenPeatonalDesdeApi(
  res: PeatonalResumenResponse
): PeatonalResumenView {
  return mapPeatonalResumen(res);
}

export function mapDetallePeatonalDesdeApi(
  res: PeatonalDetalleResponse
): PeatonalDetalleView {
  return mapPeatonalDetalle(res);
}
