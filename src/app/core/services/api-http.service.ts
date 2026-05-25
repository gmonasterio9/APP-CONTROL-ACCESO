import { Injectable, Injector } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Capacitor, CapacitorHttp, HttpResponse } from '@capacitor/core';
import { Observable, firstValueFrom, from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface ApiHttpError {
  status: number;
  error?: unknown;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ApiHttpService {
  private refreshInFlight = false;

  constructor(private injector: Injector) {}

  private get auth(): AuthService {
    return this.injector.get(AuthService);
  }

  postPublic<T>(path: string, body?: unknown): Observable<T> {
    return from(this.request<T>('POST', path, body, false));
  }

  getPublic<T>(path: string): Observable<T> {
    return from(this.request<T>('GET', path, undefined, false));
  }

  get<T>(path: string): Observable<T> {
    return this.requestWithAuth<T>('GET', path);
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.requestWithAuth<T>('POST', path, body);
  }

  private requestWithAuth<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    retried = false
  ): Observable<T> {
    return from(this.request<T>(method, path, body, true)).pipe(
      catchError((err: ApiHttpError) => {
        if (!retried && err.status === 401) {
          return this.retryAfterRefresh<T>(method, path, body);
        }
        return throwError(() => err);
      })
    );
  }

  private retryAfterRefresh<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown
  ): Observable<T> {
    if (this.refreshInFlight) {
      return throwError(() => new Error('Sesión expirada'));
    }

    this.refreshInFlight = true;

    return this.auth.refreshSession().pipe(
      switchMap(() => {
        this.refreshInFlight = false;
        return this.requestWithAuth<T>(method, path, body, true);
      }),
      catchError(err => {
        this.refreshInFlight = false;
        void this.auth.clearLocalSession();
        return throwError(() => err);
      })
    );
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    withAuth = false
  ): Promise<T> {
    if (Capacitor.getPlatform() === 'web') {
      return this.requestWeb<T>(method, path, body, withAuth);
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    };

    if (withAuth) {
      const token = await this.auth.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const url = this.buildAbsoluteUrl(path);
    const options = {
      url,
      headers,
      ...(body !== undefined ? { data: body } : {}),
    };

    const response: HttpResponse =
      method === 'GET'
        ? await CapacitorHttp.get(options)
        : await CapacitorHttp.post(options);

    const data = this.parseData<T>(response.data);

    if (response.status < 200 || response.status >= 300) {
      const err: ApiHttpError = {
        status: response.status,
        error: data,
        message:
          typeof data === 'object' &&
          data !== null &&
          'message' in data &&
          typeof (data as { message: unknown }).message === 'string'
            ? (data as { message: string }).message
            : undefined,
      };
      throw err;
    }

    return data;
  }

  private async requestWeb<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    withAuth = false
  ): Promise<T> {
    const http = this.injector.get(HttpClient);
    let headers = new HttpHeaders({ Accept: 'application/json' });

    if (method === 'POST') {
      headers = headers.set('Content-Type', 'application/json');
    }

    if (withAuth) {
      const token = await this.auth.getAccessToken();
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }

    const url = this.buildRequestPath(path);

    try {
      return await firstValueFrom(
        method === 'GET'
          ? http.get<T>(url, { headers })
          : http.post<T>(url, body ?? {}, { headers })
      );
    } catch (error) {
      throw this.toApiHttpError(error);
    }
  }

  private buildRequestPath(resource: string): string {
    const base = environment.apiUrl.replace(/\/$/, '');
    const suffix = resource.startsWith('/') ? resource : `/${resource}`;
    return `${base}${suffix}`;
  }

  private buildAbsoluteUrl(resource: string): string {
    const path = this.buildRequestPath(resource);

    if (path.startsWith('http')) {
      return path;
    }

    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}${path}`;
    }

    return path;
  }

  private toApiHttpError(error: unknown): ApiHttpError {
    if (error instanceof HttpErrorResponse) {
      return {
        status: error.status,
        error: error.error,
        message:
          typeof error.error === 'object' &&
          error.error !== null &&
          'message' in error.error &&
          typeof (error.error as { message: unknown }).message === 'string'
            ? (error.error as { message: string }).message
            : undefined,
      };
    }

    return {
      status: 0,
      message: error instanceof Error ? error.message : 'Error de red',
    };
  }

  private parseData<T>(data: unknown): T {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data) as T;
      } catch {
        return data as T;
      }
    }
    return data as T;
  }
}
