import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Sede, SedesApiResponse } from '../models/sede.model';
import { apiEndpoint } from '../utils/api-endpoint.util';

@Injectable({ providedIn: 'root' })
export class SedesService {
  constructor(private http: HttpClient) {}

  getSedes(): Observable<Sede[]> {
    return this.http
      .get<SedesApiResponse>(apiEndpoint('/api/sedes'))
      .pipe(
        map(res =>
          (res.sedes ?? []).map(item => ({
            id: item.sedeCcod,
            nombre: item.sedeTdesc,
          }))
        )
      );
  }
}
