import { Injectable } from '@angular/core';
import { Observable, firstValueFrom, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { Sede, SedesApiResponse } from '../models/sede.model';
import { ApiHttpService } from './api-http.service';
import { AppStorageService } from './app-storage.service';

@Injectable({ providedIn: 'root' })
export class SedesService {
  private readonly CACHE_KEY = 'catalogo_sedes';
  private refreshInFlight: Promise<Sede[]> | null = null;

  constructor(
    private api: ApiHttpService,
    private storage: AppStorageService
  ) {}

  /** Precarga en segundo plano (app init / resume). */
  prefetch(): void {
    void this.refreshAndCache().catch(() => undefined);
  }

  async getCachedSedes(): Promise<Sede[]> {
    const cached = await this.storage.get<Sede[]>(this.CACHE_KEY);
    return Array.isArray(cached) ? cached : [];
  }

  refreshSedes(): Observable<Sede[]> {
    return from(this.refreshAndCache());
  }

  getSedes(): Observable<Sede[]> {
    return this.refreshSedes();
  }

  private async refreshAndCache(): Promise<Sede[]> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.fetchAndPersist().finally(() => {
        this.refreshInFlight = null;
      });
    }

    return this.refreshInFlight;
  }

  private async fetchAndPersist(): Promise<Sede[]> {
    const sedes = await firstValueFrom(this.fetchFromApi());
    await this.storage.set(this.CACHE_KEY, sedes);
    return sedes;
  }

  private fetchFromApi(): Observable<Sede[]> {
    return this.api.getPublic<SedesApiResponse>('/sedes').pipe(
      map(res =>
        (res.sedes ?? []).map(item => ({
          id: item.sedeCcod,
          nombre: item.sedeTdesc,
        }))
      )
    );
  }
}
