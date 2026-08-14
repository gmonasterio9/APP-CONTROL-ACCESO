import { Injectable } from '@angular/core';
import { Observable, map, of, switchMap, throwError } from 'rxjs';
import {
  EstacionamientoDisponibilidadResponse,
  EstacionamientoDisponibilidadView,
  mapEstacionamientoDisponibilidad,
} from '../models/estacionamiento-disponibilidad.model';
import {
  EstacionamientoCard,
  EstacionamientoListResponse,
  mapEstacionamientoCard,
} from '../models/estacionamiento.model';
import {
  assertEstacionamientoIngresoOk,
  EstacionamientoIngresoRequest,
  EstacionamientoIngresoResponse,
} from '../models/estacionamiento-ingreso.model';
import { EstacionamientoSalidaRequest, EstacionamientoSalidaResponse } from '../models/estacionamiento-salida.model';
import { assertApiSuccess } from '../utils/api-response.util';
import { acreNcorrValidoParaRequest } from '../utils/acre-ncorr.util';
import {
  VehiculosActivosQuery,
  VehiculosActivosResponse,
  VehiculosActivosView,
  buildVehiculosActivosQuery,
  mapVehiculosActivos,
} from '../models/estacionamiento-vehiculos.model';
import { ApiHttpService } from './api-http.service';

@Injectable({ providedIn: 'root' })
export class EstacionamientoService {
  constructor(private api: ApiHttpService) {}

  listar(
    acreNcorr?: number,
    opciones?: { evitarCache?: boolean }
  ): Observable<EstacionamientoCard[]> {
    const query =
      acreNcorr != null && acreNcorr > 0 ? `?acreNcorr=${acreNcorr}` : '';

    return this.api
      .get<EstacionamientoListResponse>(`/estacionamiento${query}`, {
        noCache: opciones?.evitarCache,
      })
      .pipe(
        switchMap(res => {
          assertApiSuccess(res);
          return of((res.estacionamientos ?? []).map(mapEstacionamientoCard));
        })
      );
  }

  obtenerDisponibilidad(
    opts?: { acreNcorr?: number | null; aeseNcorr?: number | null },
    nombreFallback = 'Estacionamiento'
  ): Observable<EstacionamientoDisponibilidadView> {
    const q = new URLSearchParams();
    if (opts?.acreNcorr != null && opts.acreNcorr > 0) {
      q.set('acreNcorr', String(opts.acreNcorr));
    }
    if (opts?.aeseNcorr != null && opts.aeseNcorr > 0) {
      q.set('aeseNcorr', String(opts.aeseNcorr));
    }
    const query = q.toString() ? `?${q}` : '';

    return this.api
      .get<EstacionamientoDisponibilidadResponse>(
        `/estacionamiento/disponibilidad${query}`
      )
      .pipe(
        switchMap(res => {
          assertApiSuccess(res);
          return of(mapEstacionamientoDisponibilidad(res, nombreFallback));
        })
      );
  }

  listarVehiculosActivos(
    params: VehiculosActivosQuery = {}
  ): Observable<VehiculosActivosView> {
    const query = buildVehiculosActivosQuery(params);

    return this.api
      .get<VehiculosActivosResponse>(`/estacionamiento/vehiculos-activos?${query}`)
      .pipe(
        switchMap(res => {
          assertApiSuccess(res);
          return of(mapVehiculosActivos(res));
        })
      );
  }

  registrarIngreso(
    body: EstacionamientoIngresoRequest
  ): Observable<EstacionamientoIngresoResponse> {
    return this.api
      .post<EstacionamientoIngresoResponse>('/estacionamiento/ingreso', body)
      .pipe(map(assertEstacionamientoIngresoOk));
  }

  registrarSalida(
    patente: string,
    opts?: { acreNcorr?: number | null; aeseNcorr?: number | null }
  ): Observable<EstacionamientoSalidaResponse> {
    const body: EstacionamientoSalidaRequest = {
      patente: patente.trim().toUpperCase(),
      ...(acreNcorrValidoParaRequest(opts?.acreNcorr) ? { acreNcorr: opts!.acreNcorr! } : {}),
      ...(opts?.aeseNcorr != null && opts.aeseNcorr > 0
        ? { aeseNcorr: opts.aeseNcorr }
        : {}),
    };

    return this.api
      .post<EstacionamientoSalidaResponse>('/estacionamiento/salida', body)
      .pipe(
        switchMap(res => {
          assertApiSuccess(res);
          if (!res.registrado) {
            return throwError(
              () =>
                new Error(res.message ?? 'No se pudo registrar la salida.')
            );
          }
          return of(res);
        })
      );
  }
}
