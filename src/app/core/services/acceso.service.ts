import { Injectable } from '@angular/core';
import { firstValueFrom, from, Observable, switchMap } from 'rxjs';
import {
  AccesoVistaRequest,
  AccesoVistaResponse,
  ConstanteVista,
} from '../models/acceso-vista.model';
import { obtenerDeviceId } from '../utils/device-id.util';
import { ApiHttpService } from './api-http.service';
import { AppStorageService } from './app-storage.service';
import { NetworkService } from './network.service';

@Injectable({ providedIn: 'root' })
export class AccesoService {
  constructor(
    private api: ApiHttpService,
    private storage: AppStorageService,
    private network: NetworkService
  ) {}

  registrarVista(constanteVista: ConstanteVista): Observable<AccesoVistaResponse> {
    return from(this.buildRequest(constanteVista)).pipe(
      switchMap(body => this.api.post<AccesoVistaResponse>('/acceso/vista', body))
    );
  }

  async registrarVistaSilenciosa(constanteVista: ConstanteVista): Promise<void> {
    if (!(await this.network.hayInternet())) {
      return;
    }

    try {
      await firstValueFrom(this.registrarVista(constanteVista));
    } catch {
      console.warn(`No se pudo registrar la vista ${constanteVista}.`);
    }
  }

  private async buildRequest(constanteVista: ConstanteVista): Promise<AccesoVistaRequest> {
    return {
      constanteVista,
      deviceId: await obtenerDeviceId(this.storage),
    };
  }
}
