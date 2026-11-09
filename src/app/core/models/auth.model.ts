import { LoginEstacionamientoSesion } from './login-sesion.model';

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
  recintos?: LoginRecintoApi[];
  recintoDefaultAcreNcorr?: number | null;
  estacionamiento?: LoginEstacionamientoSesion;
  message?: string;
}

export interface LoginRecintoApi {
  acreNcorr: number;
  sedeCcod: number;
  acreTnombre: string;
  acreTubicacion: string | null;
  acreNvigencia: number;
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

export interface AuthRecinto {
  id: number;
  sedeId: number;
  nombre: string;
  ubicacion: string | null;
  vigente: boolean;
}
