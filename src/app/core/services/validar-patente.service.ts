import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ValidarPatenteRequest,
  ValidarPatenteResponse,
} from '../models/validar-patente.model';
import { ApiHttpService } from './api-http.service';

@Injectable({ providedIn: 'root' })
export class ValidarPatenteService {
  constructor(private api: ApiHttpService) {}

  validar(
    patente: string,
    acreNcorr?: number,
    extras?: { confirmarIngreso?: boolean }
  ): Observable<ValidarPatenteResponse> {
    const body: ValidarPatenteRequest = {
      patente: patente.trim().toUpperCase(),
      ...(acreNcorr != null ? { acreNcorr } : {}),
      ...(extras?.confirmarIngreso ? { confirmarIngreso: true } : {}),
    };
    return this.api.post<ValidarPatenteResponse>('/validar-patente', body);
  }
}
