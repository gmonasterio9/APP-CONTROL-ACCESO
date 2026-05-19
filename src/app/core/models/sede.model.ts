export interface Sede {
  id: number;
  nombre: string;
}

export interface SedeApiItem {
  sedeCcod: number;
  sedeTdesc: string;
}

export interface SedesApiResponse {
  success: boolean;
  code: number;
  sedes: SedeApiItem[];
}
