import { Injectable } from '@angular/core';
import { Observable, firstValueFrom, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { Sede, SedesApiResponse } from '../models/sede.model';
import { SEDES_DEFAULT, mergeSedes } from '../models/sedes.default';
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

  /** Listado local inmediato, sin esperar red ni storage. */
  getSedesInmediatas(): Sede[] {
    return [...SEDES_DEFAULT];
  }

  async getCachedSedes(): Promise<Sede[]> {
    const cached = await this.storage.get<Sede[]>(this.CACHE_KEY);
    if (Array.isArray(cached) && cached.length) {
      return mergeSedes(SEDES_DEFAULT, cached);
    }

    const locales = this.getSedesInmediatas();
    await this.storage.set(this.CACHE_KEY, locales);
    return locales;
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
    const actuales = await this.getCachedSedes();

    try {
      const remotas = await firstValueFrom(this.fetchFromApi());
      const sedes = mergeSedes(actuales, remotas);
      await this.storage.set(this.CACHE_KEY, sedes);
      return sedes;
    } catch (err) {
      await this.storage.set(this.CACHE_KEY, actuales);
      throw err;
    }
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
