import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    nombre: string;
    email: string;
    rol: string;
  };
}

const MOCK_RESPONSE: LoginResponse = {
  token: 'mock-token-local',
  user: { id: 1, nombre: 'Usuario Local', email: 'local@inacap.cl', rol: 'admin' }
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';

  constructor(private http: HttpClient, private router: Router) {}

  loginWithPin(pin: string): Observable<LoginResponse> {
    if (environment.name === 'local') {
      localStorage.setItem(this.TOKEN_KEY, MOCK_RESPONSE.token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(MOCK_RESPONSE.user));
      return of(MOCK_RESPONSE);
    }

    return this.http.post<LoginResponse>(`${environment.apiUrl}/api/auth/login`, { pin }).pipe(
      tap(res => {
        localStorage.setItem(this.TOKEN_KEY, res.token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getUser(): LoginResponse['user'] | null {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}
