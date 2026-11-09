import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ControlIngresoRequest,
  ControlIngresoResponse,
} from '../models/control-ingreso.model';
import { ApiHttpService } from './api-http.service';

@Injectable({ providedIn: 'root' })
export class ControlIngresoService {
  constructor(private api: ApiHttpService) {}

  registrar(body: ControlIngresoRequest): Observable<ControlIngresoResponse> {
    return this.api.post<ControlIngresoResponse>('/control-ingreso', body);
  }
}
