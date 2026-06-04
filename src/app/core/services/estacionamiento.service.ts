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
import { EstacionamientoSalidaResponse } from '../models/estacionamiento-salida.model';
import { assertApiSuccess } from '../utils/api-response.util';
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

  listar(opciones?: { evitarCache?: boolean }): Observable<EstacionamientoCard[]> {
    return this.api
      .get<EstacionamientoListResponse>('/estacionamiento', {
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
    aeseNcorr: number,
    nombreFallback = 'Estacionamiento'
  ): Observable<EstacionamientoDisponibilidadView> {
    return this.api
      .get<EstacionamientoDisponibilidadResponse>(
        `/estacionamiento/disponibilidad?aeseNcorr=${aeseNcorr}`
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

  registrarSalida(patente: string): Observable<EstacionamientoSalidaResponse> {
    return this.api
      .post<EstacionamientoSalidaResponse>('/estacionamiento/salida', {
        patente: patente.trim().toUpperCase(),
      })
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
