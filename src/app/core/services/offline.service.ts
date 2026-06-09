import { Injectable } from '@angular/core';
import { Observable, from, map, switchMap } from 'rxjs';
import {
  OFFLINE_CATALOGO_STORAGE_KEY,
  OfflineCatalogoAccesoResponse,
  OfflineCatalogoAccesoView,
  mapOfflineCatalogo,
  resolverEstacionamientoDesdeCatalogo,
} from '../models/offline-catalogo.model';
import { LoginEstacionamientoSesion } from '../models/login-sesion.model';
import { ApiHttpService } from './api-http.service';
import { AppStorageService } from './app-storage.service';
import { NetworkService } from './network.service';

@Injectable({ providedIn: 'root' })
export class OfflineService {
  constructor(
    private api: ApiHttpService,
    private storage: AppStorageService,
    private network: NetworkService
  ) {}

  sincronizarCatalogoAcceso(): Observable<OfflineCatalogoAccesoView> {
    return this.api
      .get<OfflineCatalogoAccesoResponse>('/offline/catalogo-acceso')
      .pipe(
        map(mapOfflineCatalogo),
        switchMap(catalogo =>
          from(this.persistirCatalogo(catalogo)).pipe(map(() => catalogo))
        )
      );
  }

  async getCatalogo(): Promise<OfflineCatalogoAccesoView | null> {
    return this.storage.get<OfflineCatalogoAccesoView>(
      OFFLINE_CATALOGO_STORAGE_KEY
    );
  }

  async getEstacionamientoOffline(): Promise<LoginEstacionamientoSesion | null> {
    const catalogo = await this.getCatalogo();
    return resolverEstacionamientoDesdeCatalogo(catalogo);
  }

  /** Sin internet y con catálogo local sincronizado en el último login. */
  async debeUsarModoOffline(): Promise<boolean> {
    const hayInternet = await this.network.hayInternet();
    if (hayInternet) {
      return false;
    }
    const catalogo = await this.getCatalogo();
    return !!catalogo?.estacionamiento?.ingresoManual;
  }

  async clearCatalogo(): Promise<void> {
    await this.storage.remove(OFFLINE_CATALOGO_STORAGE_KEY);
  }

  private async persistirCatalogo(
    catalogo: OfflineCatalogoAccesoView
  ): Promise<void> {
    await this.storage.set(OFFLINE_CATALOGO_STORAGE_KEY, catalogo);
  }
}
