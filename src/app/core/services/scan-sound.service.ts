import { Injectable } from '@angular/core';

export type ScanResultSonido = 'autorizado' | 'no_autorizado' | 'manual';

@Injectable({ providedIn: 'root' })
export class ScanSoundService {
  private readonly rutas: Record<ScanResultSonido, string> = {
    autorizado: 'assets/sound/Autorizado.mp3',
    no_autorizado: 'assets/sound/Rechazado.mp3',
    manual: 'assets/sound/Expirado.mp3',
  };

  private cache = new Map<string, HTMLAudioElement>();

  async play(estado: ScanResultSonido): Promise<void> {
    await this.reproducirArchivo(this.rutas[estado]);
  }

  private async reproducirArchivo(src: string): Promise<void> {
    try {
      const audio = this.obtenerAudio(src);
      audio.currentTime = 0;
      await audio.play();
    } catch {
      // Sin audio disponible
    }
  }

  private obtenerAudio(src: string): HTMLAudioElement {
    let audio = this.cache.get(src);
    if (!audio) {
      audio = new Audio(src);
      audio.preload = 'auto';
      this.cache.set(src, audio);
    }
    return audio;
  }
}
