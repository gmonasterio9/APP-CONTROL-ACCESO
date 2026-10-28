import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { firstValueFrom, timeout } from 'rxjs';
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
  private readonly REQUEST_TIMEOUT_MS = 8_000;
  /** Más chico = upload más rápido; 960px alcanza para patentes CL. */
  private readonly MAX_IMAGE_SIDE = 960;
  private readonly JPEG_QUALITY = 0.58;

  constructor(private http: HttpClient) {}

  async readPlate(base64Image: string): Promise<PlateResult | null> {
    try {
      const optimizada = await this.optimizarImagen(base64Image);
      const response = Capacitor.isNativePlatform()
        ? await this.postNativo(optimizada)
        : await this.postWeb(optimizada);

      return this.extraerPatente(response);
    } catch {
      return null;
    }
  }

  private async postNativo(base64: string): Promise<PlateRecognizerResponse> {
    const res = await CapacitorHttp.post({
      url: this.API_URL,
      headers: {
        Authorization: `Token ${this.API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        upload: base64,
        regions: ['cl'],
      },
      connectTimeout: this.REQUEST_TIMEOUT_MS,
      readTimeout: this.REQUEST_TIMEOUT_MS,
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`PlateRecognizer HTTP ${res.status}`);
    }

    return (typeof res.data === 'string'
      ? JSON.parse(res.data)
      : res.data) as PlateRecognizerResponse;
  }

  private async postWeb(base64: string): Promise<PlateRecognizerResponse> {
    const headers = new HttpHeaders({
      Authorization: `Token ${this.API_TOKEN}`,
      'Content-Type': 'application/json',
    });

    return firstValueFrom(
      this.http
        .post<PlateRecognizerResponse>(
          this.API_URL,
          { upload: base64, regions: ['cl'] },
          { headers }
        )
        .pipe(timeout(this.REQUEST_TIMEOUT_MS))
    );
  }

  private extraerPatente(
    response: PlateRecognizerResponse | null | undefined
  ): PlateResult | null {
    if (!response?.results?.length) {
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

  private async optimizarImagen(base64: string): Promise<string> {
    try {
      const img = await this.cargarImagen(base64);
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) {
        return base64;
      }

      const scale = Math.min(1, this.MAX_IMAGE_SIDE / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return base64;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', this.JPEG_QUALITY);
    } catch {
      return base64;
    }
  }

  private cargarImagen(base64: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
      img.src = base64;
    });
  }
}
