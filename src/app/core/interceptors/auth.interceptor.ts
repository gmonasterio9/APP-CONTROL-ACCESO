import { Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private refreshInFlight = false;

  constructor(private auth: AuthService) {}

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    if (this.isAuthRequest(req)) {
      return next.handle(req);
    }

    return from(this.auth.getAccessToken()).pipe(
      switchMap(token => next.handle(this.withBearer(req, token))),
      catchError(err => this.handleError(err, req, next))
    );
  }

  private handleError(
    error: unknown,
    req: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
      return throwError(() => error);
    }

    if (this.isAuthRequest(req)) {
      return throwError(() => error);
    }

    if (this.refreshInFlight) {
      return throwError(() => error);
    }

    this.refreshInFlight = true;

    return this.auth.refreshSession().pipe(
      switchMap(() => from(this.auth.getAccessToken())),
      filter((token): token is string => !!token),
      take(1),
      switchMap(token => {
        this.refreshInFlight = false;
        return next.handle(this.withBearer(req, token));
      }),
      catchError(refreshError => {
        this.refreshInFlight = false;
        void this.auth.logout();
        return throwError(() => refreshError);
      })
    );
  }

  private isAuthRequest(req: HttpRequest<unknown>): boolean {
    return (
      req.url.includes('/api/login') || req.url.includes('/api/refresh')
    );
  }

  private withBearer(
    req: HttpRequest<unknown>,
    token: string | null
  ): HttpRequest<unknown> {
    if (!token) {
      return req;
    }
    return req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }
}
