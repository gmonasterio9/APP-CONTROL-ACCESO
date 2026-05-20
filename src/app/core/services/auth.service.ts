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
import { AppStorageService } from './app-storage.service';
import { ApiHttpService } from './api-http.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly ACCESS_TOKEN_KEY = 'auth_access_token';
  private readonly REFRESH_TOKEN_KEY = 'auth_refresh_token';
  private readonly USER_KEY = 'auth_user';
  private readonly SEDE_KEY = 'auth_sede';

  constructor(
    private router: Router,
    private storage: AppStorageService,
    private api: ApiHttpService
  ) {}

  loginWithPin(pin: string, sedeId: number): Observable<LoginApiResponse> {
    return this.api
      .postPublic<LoginApiResponse>('/login', {
        sede: sedeId,
        pin: Number(pin),
      })
      .pipe(switchMap(res => from(this.persistSession(res))));
  }

  refreshSession(): Observable<RefreshApiResponse> {
    return from(this.getRefreshToken()).pipe(
      switchMap(refresh => {
        if (!refresh) {
          return throwError(() => new Error('Sin refresh token'));
        }
        return this.api.postPublic<RefreshApiResponse>('/refresh', { refresh });
      }),
      switchMap(res => from(this.persistTokens(res.access_token, res.refresh)).pipe(
        switchMap(() => from([res]))
      ))
    );
  }

  async setSede(sede: Sede): Promise<void> {
    await this.storage.set(this.SEDE_KEY, sede);
  }

  async getSede(): Promise<Sede | null> {
    return this.storage.get<Sede>(this.SEDE_KEY);
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
    ]);
    await this.router.navigate(['/auth/login']);
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
    const user: AuthUser = {
      nombre: response.apeuTnombre,
      sedeId: response.sedeCcod,
      sedeNombre: response.sedeTdesc,
    };
    const sede: Sede = { id: response.sedeCcod, nombre: response.sedeTdesc };

    await this.persistTokens(response.access_token, response.refresh);
    await this.storage.set(this.USER_KEY, user);
    await this.storage.set(this.SEDE_KEY, sede);
    return response;
  }

  private async persistTokens(
    accessToken: string,
    refreshToken: string
  ): Promise<void> {
    await this.storage.set(this.ACCESS_TOKEN_KEY, accessToken);
    await this.storage.set(this.REFRESH_TOKEN_KEY, refreshToken);
  }
}
