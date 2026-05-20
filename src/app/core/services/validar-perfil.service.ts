import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import {
  ValidarPerfilRequest,
  ValidarPerfilResponse,
} from '../models/validar-perfil.model';
import { apiEndpoint } from '../utils/api-endpoint.util';
import {
  buildValidarPerfilBodyFromScan,
  normalizeRutManual,
} from '../utils/qr-perfil.util';

@Injectable({ providedIn: 'root' })
export class ValidarPerfilService {
  constructor(private http: HttpClient) {}

  validar(body: ValidarPerfilRequest): Observable<ValidarPerfilResponse> {
    return this.http.post<ValidarPerfilResponse>(
      apiEndpoint('/api/validar-perfil'),
      body
    );
  }

  validarEscaneo(rawQr: string): Observable<ValidarPerfilResponse> {
    const body = buildValidarPerfilBodyFromScan(rawQr);
    if (!body) {
      return throwError(() => new Error('Código QR no reconocido.'));
    }
    return this.validar(body);
  }

  validarPorRut(rut: string): Observable<ValidarPerfilResponse> {
    const trimmed = rut.trim();
    if (!trimmed) {
      return throwError(() => new Error('Ingrese un RUT válido.'));
    }
    return this.validar({ rut: normalizeRutManual(trimmed) });
  }
}
