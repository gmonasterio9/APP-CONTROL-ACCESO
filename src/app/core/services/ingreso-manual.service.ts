import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  esIngresoManualPeatonal,
  INGRESO_MANUAL_ENDPOINT,
  IngresoManualRequest,
  IngresoManualResponse,
} from '../models/ingreso-manual.model';
import { ApiHttpService } from './api-http.service';

@Injectable({ providedIn: 'root' })
export class IngresoManualService {
  constructor(private api: ApiHttpService) {}

  registrar(body: IngresoManualRequest): Observable<IngresoManualResponse> {
    const path = esIngresoManualPeatonal(body)
      ? INGRESO_MANUAL_ENDPOINT.peatonal
      : INGRESO_MANUAL_ENDPOINT.vehiculos;
    return this.api.post<IngresoManualResponse>(path, body);
  }
}
