import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PatenteUtil } from '../utils/patente.util';

export interface PlateResult {
  plate: string;
  score: number;
  region: string;
  vehicleType: string;
}

interface PlateRecognizerResponse {
  results: Array<{
    plate: string;
    score: number;
    region: { code: string; score: number };
    vehicle: { type: string; score: number };
    candidates?: Array<{ plate: string; score: number }>;
  }>;
}

@Injectable({ providedIn: 'root' })
export class PlateRecognizerService {

  private readonly API_URL = 'https://api.platerecognizer.com/v1/plate-reader/';
  private readonly API_TOKEN = 'd9b5d9d4230d16170f6b15eac7244e124bbf33a0';

  constructor(private http: HttpClient) {}

  async readPlate(base64Image: string): Promise<PlateResult | null> {
    const blob = this.base64ToBlob(base64Image);
    const formData = new FormData();
    formData.append('upload', blob, 'plate.jpg');
    formData.append('regions', 'cl'); // Chile

    const headers = new HttpHeaders({
      Authorization: `Token ${this.API_TOKEN}`,
    });

    const response = await firstValueFrom(
      this.http.post<PlateRecognizerResponse>(this.API_URL, formData, { headers })
    );

    if (!response.results?.length) {
      return null;
    }

    for (const item of response.results) {
      const opciones = [
        item.plate,
        ...(item.candidates?.map(c => c.plate) ?? []),
      ];

      for (const raw of opciones) {
        const plate = PatenteUtil.limpiar(raw);
        if (!PatenteUtil.isFormatValidAutoOMoto(plate)) {
          continue;
        }

        return {
          plate,
          score: item.score,
          region: item.region?.code ?? '',
          vehicleType: PatenteUtil.inferirMedio(plate) ?? '',
        };
      }
    }

    return null;
  }

  private base64ToBlob(base64: string): Blob {
    const byteString = atob(base64.split(',').pop() ?? base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: 'image/jpeg' });
  }
}
