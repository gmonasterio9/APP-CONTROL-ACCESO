import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import {
  ValidarPerfilRequest,
  ValidarPerfilResponse,
} from '../models/validar-perfil.model';
import { ScanPerfilUtil } from '../utils/scan-perfil.util';
import { RutUtil } from '../utils/rut.util';
import { ApiHttpService } from './api-http.service';

@Injectable({ providedIn: 'root' })
export class ValidarPerfilService {
  constructor(private api: ApiHttpService) {}

  validar(body: ValidarPerfilRequest): Observable<ValidarPerfilResponse> {
    return this.api.post<ValidarPerfilResponse>('/validar-perfil', body);
  }

  validarEscaneo(rawQr: string): Observable<ValidarPerfilResponse> {
    const body = ScanPerfilUtil.buildValidarPerfilBody(rawQr);
    return this.validar(body);
  }

  validarPorRut(rut: string): Observable<ValidarPerfilResponse> {
    const trimmed = rut.trim();
    if (!trimmed) {
      return throwError(() => new Error('Ingrese un RUT válido.'));
    }
    return this.validar({ rut: RutUtil.normalizeManual(trimmed) });
  }
}
