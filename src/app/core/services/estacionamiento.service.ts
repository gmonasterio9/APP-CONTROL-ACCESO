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
    acreNcorr?: number,
    nombreFallback = 'Estacionamiento'
  ): Observable<EstacionamientoDisponibilidadView> {
    const query =
      acreNcorr != null && acreNcorr > 0 ? `?acreNcorr=${acreNcorr}` : '';

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
    acreNcorr?: number | null
  ): Observable<EstacionamientoSalidaResponse> {
    const body: EstacionamientoSalidaRequest = {
      patente: patente.trim().toUpperCase(),
      ...(acreNcorrValidoParaRequest(acreNcorr) ? { acreNcorr } : {}),
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
