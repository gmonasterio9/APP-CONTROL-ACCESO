export interface LoginApiResponse {
  success: boolean;
  code: number;
  access_token: string;
  refreshToken: string;
  refresh?: string;
  expires_in: number;
  refresh_expires_in: number;
  sedeCcod: number;
  sedeTdesc: string;
  apeuTnombre: string;
  message?: string;
}

export interface RefreshApiResponse {
  success: boolean;
  code: number;
  access_token: string;
  refreshToken: string;
  refresh?: string;
  expires_in: number;
  refresh_expires_in: number;
  sedeCcod: number;
  message?: string;
}

export interface LogoutApiResponse {
  success: boolean;
  code: number;
  message: string;
}

export interface AuthUser {
  nombre: string;
  sedeId: number;
  sedeNombre: string;
}
