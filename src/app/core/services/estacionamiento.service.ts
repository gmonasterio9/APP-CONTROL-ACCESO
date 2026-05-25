import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  EstacionamientoCard,
  EstacionamientoListResponse,
  mapEstacionamientoCard,
} from '../models/estacionamiento.model';
import { ApiHttpService } from './api-http.service';

@Injectable({ providedIn: 'root' })
export class EstacionamientoService {
  constructor(private api: ApiHttpService) {}

  listar(): Observable<EstacionamientoCard[]> {
    return this.api.get<EstacionamientoListResponse>('/estacionamiento').pipe(
      map(res => (res.estacionamientos ?? []).map(mapEstacionamientoCard))
    );
  }
}
