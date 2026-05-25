import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  IngresoManualRequest,
  IngresoManualResponse,
} from '../models/ingreso-manual.model';
import { ApiHttpService } from './api-http.service';

@Injectable({ providedIn: 'root' })
export class IngresoManualService {
  constructor(private api: ApiHttpService) {}

  registrar(body: IngresoManualRequest): Observable<IngresoManualResponse> {
    return this.api.post<IngresoManualResponse>('/ingreso-manual', body);
  }
}
