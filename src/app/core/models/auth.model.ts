export interface LoginApiResponse {
  access_token: string;
  refresh: string;
  apeuTnombre: string;
  sedeCcod: number;
  sedeTdesc: string;
}

export interface RefreshApiResponse {
  access_token: string;
  refresh: string;
}

export interface AuthUser {
  nombre: string;
  sedeId: number;
  sedeNombre: string;
}
