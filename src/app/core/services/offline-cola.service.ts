import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  OFFLINE_COLA_STORAGE_KEY,
  OfflineColaItem,
  crearIdColaOffline,
} from '../models/offline-cola.model';
import { AppStorageService } from './app-storage.service';
import { ApiHttpService } from './api-http.service';
import { NetworkService } from './network.service';

const MAX_INTENTOS_COLA = 5;

@Injectable({ providedIn: 'root' })
export class OfflineColaService {
  private sincronizando = false;

  constructor(
    private storage: AppStorageService,
    private network: NetworkService,
    private api: ApiHttpService
  ) {
    this.network.enLinea$.subscribe(enLinea => {
      if (enLinea) {
        void this.sincronizar();
      }
    });
  }

  async encolar(path: string, body: unknown): Promise<void> {
    const cola = await this.obtenerPendientes();
    cola.push({
      id: crearIdColaOffline(),
      path,
      body,
      creadoEn: new Date().toISOString(),
      intentos: 0,
    });
    await this.storage.set(OFFLINE_COLA_STORAGE_KEY, cola);
  }

  async obtenerPendientes(): Promise<OfflineColaItem[]> {
    const cola = await this.storage.get<OfflineColaItem[]>(OFFLINE_COLA_STORAGE_KEY);
    return cola ?? [];
  }

  async sincronizar(): Promise<void> {
    if (this.sincronizando) {
      return;
    }

    const hayInternet = await this.network.hayInternet();
    if (!hayInternet) {
      return;
    }

    const cola = await this.obtenerPendientes();
    if (!cola.length) {
      return;
    }

    this.sincronizando = true;
    const pendientes: OfflineColaItem[] = [];

    try {
      for (const item of cola) {
        const sincronizado = await this.enviarItem(item);
        if (!sincronizado) {
          const intentos = item.intentos + 1;
          if (intentos < MAX_INTENTOS_COLA) {
            pendientes.push({ ...item, intentos });
          }
        }
      }

      await this.storage.set(OFFLINE_COLA_STORAGE_KEY, pendientes);
    } finally {
      this.sincronizando = false;
    }
  }

  async clearCola(): Promise<void> {
    await this.storage.remove(OFFLINE_COLA_STORAGE_KEY);
  }

  private async enviarItem(item: OfflineColaItem): Promise<boolean> {
    try {
      await firstValueFrom(
        this.api.post(item.path, item.body, { skipOfflineQueue: true })
      );
      return true;
    } catch {
      return false;
    }
  }
}
