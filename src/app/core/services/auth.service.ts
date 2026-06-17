import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, Observable, from, throwError } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Sede } from '../models/sede.model';
import {
  AuthUser,
  LoginApiResponse,
  LogoutApiResponse,
  RefreshApiResponse,
} from '../models/auth.model';
import { LoginEstacionamientoSesion } from '../models/login-sesion.model';
import { AppStorageService } from './app-storage.service';
import { ApiHttpService } from './api-http.service';
import { NetworkService } from './network.service';
import { OfflineColaService } from './offline-cola.service';
import { OfflineService } from './offline.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly ACCESS_TOKEN_KEY = 'auth_access_token';
  private readonly REFRESH_TOKEN_KEY = 'auth_refresh_token';
  private readonly ACCESS_EXPIRES_KEY = 'auth_access_expires_at';
  private readonly REFRESH_EXPIRES_KEY = 'auth_refresh_expires_at';
  private readonly USER_KEY = 'auth_user';
  private readonly SEDE_KEY = 'auth_sede';
  private readonly ESTACIONAMIENTO_SESION_KEY = 'auth_estacionamiento_sesion';
  private readonly TOKEN_REFRESH_BUFFER_MS = 60_000;

  private restoreInFlight: Promise<boolean> | null = null;

  constructor(
    private router: Router,
    private storage: AppStorageService,
    private api: ApiHttpService,
    private network: NetworkService,
    private offlineService: OfflineService,
    private offlineColaService: OfflineColaService
  ) {}

  loginWithPin(pin: string, sedeId: number): Observable<LoginApiResponse> {
    return this.api
      .postPublic<LoginApiResponse>('/login', {
        sede: sedeId,
        pin: Number(pin),
      })
      .pipe(
        switchMap(res => {
          const refreshToken = this.extractRefreshToken(res);
          if (!res?.success || !res?.access_token || !refreshToken) {
            return throwError(
              () => new Error(res?.message ?? 'Respuesta de login inválida')
            );
          }
          return from(this.persistSession(res));
        })
      );
  }

  refreshSession(): Observable<RefreshApiResponse> {
    return from(this.getRefreshToken()).pipe(
      switchMap(refresh => {
        if (!refresh) {
          return throwError(() => new Error('Sin refresh token'));
        }
        return this.api.postPublic<RefreshApiResponse>('/refresh', {
          refresh,
          refreshToken: refresh,
        });
      }),
      switchMap(res => {
        const refreshToken = this.extractRefreshToken(res);
        if (!res?.success || !res?.access_token || !refreshToken) {
          return throwError(() => new Error('Respuesta de refresh inválida'));
        }
        return from(
          this.persistTokens(
            res.access_token,
            refreshToken,
            res.expires_in,
            res.refresh_expires_in
          )
        ).pipe(
          switchMap(() => from([res]))
        );
      })
    );
  }

  async setSede(sede: Sede): Promise<void> {
    await this.storage.set(this.SEDE_KEY, sede);
  }

  async getSede(): Promise<Sede | null> {
    return this.storage.get<Sede>(this.SEDE_KEY);
  }

  async getEstacionamientoSesion(): Promise<LoginEstacionamientoSesion | null> {
    return this.storage.get<LoginEstacionamientoSesion>(
      this.ESTACIONAMIENTO_SESION_KEY
    );
  }

  async logout(): Promise<void> {
    const token = await this.getAccessToken();
    if (token) {
      try {
        await firstValueFrom(
          this.api.post<LogoutApiResponse>('/logout', {})
        );
      } catch {
        console.error('Error al cerrar sesión');
      }
    }
    await this.clearLocalSession();
  }

  async clearLocalSession(): Promise<void> {
    await Promise.all([
      this.storage.remove(this.ACCESS_TOKEN_KEY),
      this.storage.remove(this.REFRESH_TOKEN_KEY),
      this.storage.remove(this.ACCESS_EXPIRES_KEY),
      this.storage.remove(this.REFRESH_EXPIRES_KEY),
      this.storage.remove(this.USER_KEY),
      this.storage.remove(this.SEDE_KEY),
      this.storage.remove(this.ESTACIONAMIENTO_SESION_KEY),
      this.offlineService.clearCatalogo(),
      this.offlineColaService.clearCola(),
    ]);
    await this.router.navigate(['/auth/inicio-sesion']);
  }

  async getAccessToken(): Promise<string | null> {
    return this.storage.get<string>(this.ACCESS_TOKEN_KEY);
  }

  async getToken(): Promise<string | null> {
    return this.getAccessToken();
  }

  async getRefreshToken(): Promise<string | null> {
    return this.storage.get<string>(this.REFRESH_TOKEN_KEY);
  }

  /** Renueva el access token si expiró y hay refresh válido. */
  async ensureAccessToken(): Promise<string | null> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) {
      return this.getAccessToken();
    }

    if (await this.isRefreshExpired()) {
      return null;
    }

    if (await this.isAccessTokenValid()) {
      return this.getAccessToken();
    }

    const hayInternet = await this.network.hayInternet();
    if (!hayInternet) {
      return this.getAccessToken();
    }

    try {
      await firstValueFrom(this.refreshSession());
    } catch {
      return this.getAccessToken();
    }

    return this.getAccessToken();
  }

  async getUser(): Promise<AuthUser | null> {
    return this.storage.get<AuthUser>(this.USER_KEY);
  }

  async isAuthenticated(): Promise<boolean> {
    return this.restoreSession();
  }

  async restoreSession(): Promise<boolean> {
    if (!this.restoreInFlight) {
      this.restoreInFlight = this.doRestoreSession().finally(() => {
        this.restoreInFlight = null;
      });
    }

    return this.restoreInFlight;
  }

  private async doRestoreSession(): Promise<boolean> {
    const refreshToken = await this.getRefreshToken();
    const user = await this.getUser();

    if (!refreshToken || !user) {
      return false;
    }

    if (await this.isRefreshExpired()) {
      await this.clearLocalSession();
      return false;
    }

    if (await this.isAccessTokenValid()) {
      return true;
    }

    const hayInternet = await this.network.hayInternet();
    if (!hayInternet) {
      return true;
    }

    try {
      await firstValueFrom(this.refreshSession());
      return true;
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) {
        await this.clearLocalSession();
        return false;
      }

      return true;
    }
  }

  private async persistSession(response: LoginApiResponse): Promise<LoginApiResponse> {
    const refreshToken = this.extractRefreshToken(response);
    if (!refreshToken) {
      throw new Error('Respuesta de login inválida');
    }

    const user: AuthUser = {
      nombre: response.apeuTnombre,
      sedeId: response.sedeCcod,
      sedeNombre: response.sedeTdesc,
    };
    const sede: Sede = { id: response.sedeCcod, nombre: response.sedeTdesc };

    await this.persistTokens(
      response.access_token,
      refreshToken,
      response.expires_in,
      response.refresh_expires_in
    );
    await this.storage.set(this.USER_KEY, user);
    await this.storage.set(this.SEDE_KEY, sede);

    if (response.estacionamiento) {
      await this.storage.set(
        this.ESTACIONAMIENTO_SESION_KEY,
        response.estacionamiento
      );
    } else {
      await this.storage.remove(this.ESTACIONAMIENTO_SESION_KEY);
    }

    try {
      await firstValueFrom(
        this.offlineService.sincronizarCatalogoAcceso(response.estacionamiento)
      );
    } catch {
      console.warn('No se pudo sincronizar el catálogo offline.');
    }

    await this.offlineColaService.sincronizar();

    return response;
  }

  private async persistTokens(
    accessToken: string,
    refreshToken: string,
    expiresIn?: number,
    refreshExpiresIn?: number
  ): Promise<void> {
    await this.storage.set(this.ACCESS_TOKEN_KEY, accessToken);
    await this.storage.set(this.REFRESH_TOKEN_KEY, refreshToken);

    if (expiresIn && expiresIn > 0) {
      await this.storage.set(
        this.ACCESS_EXPIRES_KEY,
        Date.now() + expiresIn * 1000
      );
    }

    if (refreshExpiresIn && refreshExpiresIn > 0) {
      await this.storage.set(
        this.REFRESH_EXPIRES_KEY,
        Date.now() + refreshExpiresIn * 1000
      );
    }
  }

  private async isAccessTokenValid(): Promise<boolean> {
    const token = await this.getAccessToken();
    if (!token) {
      return false;
    }

    const expiresAt = await this.storage.get<number>(this.ACCESS_EXPIRES_KEY);
    if (!expiresAt) {
      return true;
    }

    return Date.now() < expiresAt - this.TOKEN_REFRESH_BUFFER_MS;
  }

  private async isRefreshExpired(): Promise<boolean> {
    const expiresAt = await this.storage.get<number>(this.REFRESH_EXPIRES_KEY);
    if (!expiresAt) {
      return false;
    }

    return Date.now() >= expiresAt - this.TOKEN_REFRESH_BUFFER_MS;
  }

  private extractRefreshToken(response: {
    refreshToken?: string;
    refresh?: string;
  }): string | null {
    return response.refreshToken ?? response.refresh ?? null;
  }
}
