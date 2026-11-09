import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  OFFLINE_COLA_STORAGE_KEY,
  OfflineColaItem,
  crearIdColaOffline,
} from '../models/offline-cola.model';
import {
  OFFLINE_SINCRONIZAR_INGRESOS_VEHICULOS_PATH,
  OfflineSincronizarIngresosVehiculosResponse,
  agruparIngresosVehicularesConsecutivos,
  construirSincronizarIngresosVehiculosRequest,
  IngresoVehicularCola,
} from '../models/offline-sincronizar-ingresos.model';
import { AuthRecinto } from '../models/auth.model';
import { resolverAcreNcorrDesdeRecintos } from '../utils/acre-ncorr.util';
import { AppStorageService } from './app-storage.service';
import { ApiHttpService } from './api-http.service';
import { NetworkService } from './network.service';

const MAX_INTENTOS_COLA = 5;
const RECINTO_STORAGE_KEY = 'auth_recinto';
const RECINTOS_STORAGE_KEY = 'auth_recintos';

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
    const ingresosVehicularesPendientes: OfflineColaItem[] = [];

    try {
      const acreNcorrFallback = await this.obtenerAcreNcorrFallback();

      const flushIngresosVehiculares = async (): Promise<void> => {
        if (!ingresosVehicularesPendientes.length) {
          return;
        }

        const grupos = agruparIngresosVehicularesConsecutivos(
          ingresosVehicularesPendientes,
          acreNcorrFallback
        );
        ingresosVehicularesPendientes.length = 0;

        for (const grupo of grupos) {
          const sincronizado = await this.enviarIngresosVehiculares(
            grupo,
            acreNcorrFallback
          );

          if (!sincronizado) {
            for (const item of grupo) {
              const intentos = item.intentos + 1;
              if (intentos < MAX_INTENTOS_COLA) {
                pendientes.push({ ...item, intentos });
              }
            }
          }
        }
      };

      for (const item of cola) {
        if (IngresoVehicularCola(item.path)) {
          ingresosVehicularesPendientes.push(item);
          continue;
        }

        await flushIngresosVehiculares();

        const sincronizado = await this.enviarItem(item);
        if (!sincronizado) {
          const intentos = item.intentos + 1;
          if (intentos < MAX_INTENTOS_COLA) {
            pendientes.push({ ...item, intentos });
          }
        }
      }

      await flushIngresosVehiculares();
      await this.storage.set(OFFLINE_COLA_STORAGE_KEY, pendientes);
    } finally {
      this.sincronizando = false;
    }
  }

  async clearCola(): Promise<void> {
    await this.storage.remove(OFFLINE_COLA_STORAGE_KEY);
  }

  private async obtenerAcreNcorrFallback(): Promise<number | null | undefined> {
    const [recintos, recintoSeleccionado] = await Promise.all([
      this.storage.get<AuthRecinto[]>(RECINTOS_STORAGE_KEY),
      this.storage.get<AuthRecinto>(RECINTO_STORAGE_KEY),
    ]);

    return resolverAcreNcorrDesdeRecintos(
      (recintos ?? []).filter(recinto => recinto.vigente),
      recintoSeleccionado ?? null
    );
  }

  private async enviarIngresosVehiculares(
    items: OfflineColaItem[],
    acreNcorrFallback: number | null | undefined
  ): Promise<boolean> {
    const payload = construirSincronizarIngresosVehiculosRequest(
      items,
      acreNcorrFallback
    );

    if (!payload) {
      return false;
    }

    try {
      const res = await firstValueFrom(
        this.api.post<OfflineSincronizarIngresosVehiculosResponse>(
          OFFLINE_SINCRONIZAR_INGRESOS_VEHICULOS_PATH,
          payload,
          { skipOfflineQueue: true }
        )
      );

      return res?.success !== false;
    } catch {
      return false;
    }
  }

  private async enviarItem(item: OfflineColaItem): Promise<boolean> {
    if (IngresoVehicularCola(item.path)) {
      return this.enviarIngresosVehiculares(
        [item],
        await this.obtenerAcreNcorrFallback()
      );
    }

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
