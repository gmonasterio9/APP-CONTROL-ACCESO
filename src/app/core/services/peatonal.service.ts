import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  buildPeatonalDetalleQuery,
  mapPeatonalDetalle,
  PeatonalDetalleQuery,
  PeatonalDetalleResponse,
  PeatonalDetalleView,
} from '../models/peatonal-detalle.model';
import {
  mapPeatonalResumen,
  PeatonalResumenResponse,
  PeatonalResumenView,
} from '../models/peatonal-resumen.model';
import {
  assertPeatonalControlIngresoOk,
  PeatonalControlIngresoRequest,
  PeatonalControlIngresoResponse,
} from '../models/peatonal-control-ingreso.model';
import { ApiHttpService } from './api-http.service';

@Injectable({ providedIn: 'root' })
export class PeatonalService {
  constructor(private api: ApiHttpService) {}

  registrarControlIngreso(
    body: PeatonalControlIngresoRequest
  ): Observable<PeatonalControlIngresoResponse> {
    return this.api
      .post<PeatonalControlIngresoResponse>('/peatonal/control-ingreso', body)
      .pipe(map(assertPeatonalControlIngresoOk));
  }

  obtenerResumen(): Observable<PeatonalResumenView> {
    return this.api
      .get<PeatonalResumenResponse>('/peatonal/resumen')
      .pipe(map(mapPeatonalResumen));
  }

  obtenerDetalle(params: PeatonalDetalleQuery = {}): Observable<PeatonalDetalleView> {
    const query = buildPeatonalDetalleQuery(params);
    return this.api
      .get<PeatonalDetalleResponse>(`/peatonal/detalle?${query}`)
      .pipe(map(mapPeatonalDetalle));
  }
}
