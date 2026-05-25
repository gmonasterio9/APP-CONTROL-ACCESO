import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Sede, SedesApiResponse } from '../models/sede.model';
import { ApiHttpService } from './api-http.service';

@Injectable({ providedIn: 'root' })
export class SedesService {
  constructor(private api: ApiHttpService) {}

  getSedes(): Observable<Sede[]> {
    return this.api
      .getPublic<SedesApiResponse>('/sedes')
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
