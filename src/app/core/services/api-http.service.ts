import { Injectable, Injector } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Capacitor, CapacitorHttp, HttpResponse } from '@capacitor/core';
import { Observable, firstValueFrom, from, of, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  debeEncolarPostOffline,
  respuestaOptimistaPost,
} from '../models/offline-cola.model';
import {
  ApiHttpError,
  isUnauthorizedApiResult,
  MENSAJE_ERROR_SIN_CONEXION,
  mensajePorEstadoHttp,
  toApiHttpError,
} from '../utils/api-response.util';
import { AuthService } from './auth.service';
import { NetworkService } from './network.service';
import { OfflineColaService } from './offline-cola.service';

export type { ApiHttpError } from '../utils/api-response.util';

export interface ApiRequestOptions {
  noCache?: boolean;
  skipOfflineQueue?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ApiHttpService {
  private refreshInFlight$: Observable<void> | null = null;

  constructor(private injector: Injector) {}

  private get auth(): AuthService {
    return this.injector.get(AuthService);
  }

  private get network(): NetworkService {
    return this.injector.get(NetworkService);
  }

  private get offlineCola(): OfflineColaService {
    return this.injector.get(OfflineColaService);
  }

  postPublic<T>(path: string, body?: unknown): Observable<T> {
    return from(this.request<T>('POST', path, body, false));
  }

  getPublic<T>(path: string): Observable<T> {
    return from(this.request<T>('GET', path, undefined, false));
  }

  get<T>(path: string, options?: ApiRequestOptions): Observable<T> {
    return this.requestWithAuth<T>('GET', path, undefined, false, options);
  }

  post<T>(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions
  ): Observable<T> {
    return from(this.resolverPost<T>(path, body, options)).pipe(
      switchMap(resolved => {
        if (resolved.encolado) {
          return of(resolved.respuesta as T);
        }
        return this.requestWithAuth<T>('POST', path, body, false, options);
      })
    );
  }

  private async resolverPost<T>(
    path: string,
    body: unknown,
    options?: ApiRequestOptions
  ): Promise<{ encolado: boolean; respuesta?: T }> {
    if (options?.skipOfflineQueue || !debeEncolarPostOffline(path)) {
      return { encolado: false };
    }

    const hayInternet = await this.network.hayInternet();
    if (hayInternet) {
      return { encolado: false };
    }

    await this.offlineCola.encolar(path, body ?? {});
    return {
      encolado: true,
      respuesta: respuestaOptimistaPost(path, body) as T,
    };
  }

  private requestWithAuth<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    retried = false,
    options?: ApiRequestOptions
  ): Observable<T> {
    return from(this.request<T>(method, path, body, true, options)).pipe(
      map(data => this.guardUnauthorizedResponse(data)),
      catchError((err: unknown) => {
        const apiErr = this.normalizeToApiError(err);
        if (!retried && apiErr.status === 401) {
          return this.retryAfterRefresh<T>(method, path, body, options);
        }
        return throwError(() => apiErr);
      })
    );
  }

  private retryAfterRefresh<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    options?: ApiRequestOptions
  ): Observable<T> {
    return this.ensureRefreshed$().pipe(
      switchMap(() => this.requestWithAuth<T>(method, path, body, true, options))
    );
  }

  private ensureRefreshed$(): Observable<void> {
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.auth.refreshSession().pipe(
        map(() => undefined),
        catchError(err => {
          void this.auth.clearLocalSession();
          return throwError(() => err);
        }),
        finalize(() => {
          this.refreshInFlight$ = null;
        }),
        shareReplay(1)
      );
    }

    return this.refreshInFlight$;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    withAuth = false,
    options?: ApiRequestOptions
  ): Promise<T> {
    if (Capacitor.getPlatform() === 'web') {
      return this.requestWeb<T>(method, path, body, withAuth, options);
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      ...this.noCacheHeaders(method, options),
    };

    if (withAuth) {
      const token = await this.auth.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const url = this.buildAbsoluteUrl(path);
    const httpOptions = {
      url,
      headers,
      ...(body !== undefined ? { data: body } : {}),
    };

    const response: HttpResponse =
      method === 'GET'
        ? await CapacitorHttp.get(httpOptions)
        : await CapacitorHttp.post(httpOptions);
    
    const data = this.parseData<T>(response.data);

    if (response.status < 200 || response.status >= 300) {
      throw this.buildApiHttpError(response.status, data);
    }

    this.guardUnauthorizedResponse(data, withAuth);

    return data;
  }

  private async requestWeb<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    withAuth = false,
    options?: ApiRequestOptions
  ): Promise<T> {
    const http = this.injector.get(HttpClient);
    let headers = new HttpHeaders({
      Accept: 'application/json',
      ...this.noCacheHeaders(method, options),
    });

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
      const data = await firstValueFrom(
        method === 'GET'
          ? http.get<T>(url, { headers })
          : http.post<T>(url, body ?? {}, { headers })
      );

      this.guardUnauthorizedResponse(data, withAuth);

      return data;
    } catch (error) {
      throw this.normalizeToApiError(error);
    }
  }

  private noCacheHeaders(
    method: 'GET' | 'POST',
    options?: ApiRequestOptions
  ): Record<string, string> {
    if (method !== 'GET' || !options?.noCache) {
      return {};
    }

    return {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    };
  }

  private getApiBase(): string {
    const env = environment as { apiUrl: string; nativeApiUrl?: string };
    if (Capacitor.isNativePlatform() && env.nativeApiUrl) {
      return env.nativeApiUrl;
    }
    return env.apiUrl;
  }

  private buildRequestPath(resource: string): string {
    const base = this.getApiBase().replace(/\/$/, '');
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

  private guardUnauthorizedResponse<T>(data: T, withAuth = true): T {
    if (withAuth && isUnauthorizedApiResult(data)) {
      throw toApiHttpError(data, 401);
    }
    return data;
  }

  private normalizeToApiError(error: unknown): ApiHttpError {
    if (this.isApiHttpError(error)) {
      return error;
    }

    if (error instanceof HttpErrorResponse) {
      const payload = error.error;
      const status =
        error.status === 401 || isUnauthorizedApiResult(payload)
          ? 401
          : error.status;

      return this.buildApiHttpError(status, payload);
    }

    if (error instanceof Error && isUnauthorizedApiResult({ message: error.message })) {
      return toApiHttpError({ message: error.message }, 401);
    }

    return {
      status: 0,
      message: mensajePorEstadoHttp(
        0,
        MENSAJE_ERROR_SIN_CONEXION
      ),
    };
  }

  private isApiHttpError(error: unknown): error is ApiHttpError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof (error as ApiHttpError).status === 'number'
    );
  }

  private buildApiHttpError(status: number, data: unknown): ApiHttpError {
    let message: string | undefined;

    if (
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof (data as { message: unknown }).message === 'string'
    ) {
      message = (data as { message: string }).message;
    }

    return {
      status,
      error: data,
      message: mensajePorEstadoHttp(
        status,
        message?.trim() || 'No se pudo completar la operación.'
      ),
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
