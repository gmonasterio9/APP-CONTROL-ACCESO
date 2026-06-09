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
import { OfflineService } from './offline.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly ACCESS_TOKEN_KEY = 'auth_access_token';
  private readonly REFRESH_TOKEN_KEY = 'auth_refresh_token';
  private readonly USER_KEY = 'auth_user';
  private readonly SEDE_KEY = 'auth_sede';
  private readonly ESTACIONAMIENTO_SESION_KEY = 'auth_estacionamiento_sesion';

  constructor(
    private router: Router,
    private storage: AppStorageService,
    private api: ApiHttpService,
    private offlineService: OfflineService
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
        return this.api.postPublic<RefreshApiResponse>('/refresh', { refresh });
      }),
      switchMap(res => {
        const refreshToken = this.extractRefreshToken(res);
        if (!res?.success || !res?.access_token || !refreshToken) {
          return throwError(() => new Error('Respuesta de refresh inválida'));
        }
        return from(this.persistTokens(res.access_token, refreshToken)).pipe(
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
      this.storage.remove(this.USER_KEY),
      this.storage.remove(this.SEDE_KEY),
      this.storage.remove(this.ESTACIONAMIENTO_SESION_KEY),
      this.offlineService.clearCatalogo(),
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

  async getUser(): Promise<AuthUser | null> {
    return this.storage.get<AuthUser>(this.USER_KEY);
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    return !!token;
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

    await this.persistTokens(response.access_token, refreshToken);
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
      await firstValueFrom(this.offlineService.sincronizarCatalogoAcceso());
    } catch {
      console.warn('No se pudo sincronizar el catálogo offline.');
    }

    return response;
  }

  private async persistTokens(
    accessToken: string,
    refreshToken: string
  ): Promise<void> {
    await this.storage.set(this.ACCESS_TOKEN_KEY, accessToken);
    await this.storage.set(this.REFRESH_TOKEN_KEY, refreshToken);
  }

  private extractRefreshToken(response: {
    refreshToken?: string;
    refresh?: string;
  }): string | null {
    return response.refreshToken ?? response.refresh ?? null;
  }
}
