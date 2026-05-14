import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

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
  }>;
}

@Injectable({ providedIn: 'root' })
export class PlateRecognizerService {

  private readonly API_URL = 'https://api.platerecognizer.com/v1/plate-reader/';
  private readonly API_TOKEN = 'c3c5d803ed52a67de942451033f642cefeef0427';

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

    if (!response.results || response.results.length === 0) return null;

    const top = response.results[0];
    return {
      plate: top.plate.toUpperCase(),
      score: top.score,
      region: top.region?.code ?? '',
      vehicleType: top.vehicle?.type ?? '',
    };
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
