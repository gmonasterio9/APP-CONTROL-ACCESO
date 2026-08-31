import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AppStorageService } from './app-storage.service';

export type TemaApp = 'claro' | 'oscuro';
export type TamanoLetra = 1 | 2 | 3 | 4 | 5 | 6;

export const TAMANO_LETRA_MIN = 1;
export const TAMANO_LETRA_MAX = 6;
export const TAMANO_LETRA_DEFAULT: TamanoLetra = 3;

export interface AppConfiguracion {
  escanearQr: boolean;
  escanearPatente: boolean;
  tamanoLetra: TamanoLetra;
  tema: TemaApp;
}

const STORAGE_KEY = 'app_configuracion';

const DEFAULTS: AppConfiguracion = {
  escanearQr: true,
  escanearPatente: true,
  tamanoLetra: TAMANO_LETRA_DEFAULT,
  tema: 'claro',
};

const CLASES_TEXTO = [
  'texto-1',
  'texto-2',
  'texto-3',
  'texto-4',
  'texto-5',
  'texto-6',
  'texto-normal',
  'texto-grande',
  'texto-muy-grande',
];

function normalizarTamanoLetra(valor: unknown): TamanoLetra {
  if (valor === 'normal') {
    return 3;
  }
  if (valor === 'grande') {
    return 5;
  }
  if (valor === 'muy-grande') {
    return 6;
  }
  const n = Number(valor);
  if (n >= TAMANO_LETRA_MIN && n <= TAMANO_LETRA_MAX) {
    return n as TamanoLetra;
  }
  return TAMANO_LETRA_DEFAULT;
}

@Injectable({ providedIn: 'root' })
export class ConfiguracionesService {
  private readonly state = new BehaviorSubject<AppConfiguracion>({ ...DEFAULTS });
  readonly cambios$ = this.state.asObservable();
  private readyPromise: Promise<void> | null = null;

  constructor(private storage: AppStorageService) {}

  get actual(): AppConfiguracion {
    return this.state.value;
  }

  init(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = this.cargar();
    }
    return this.readyPromise;
  }

  async actualizar(parcial: Partial<AppConfiguracion>): Promise<AppConfiguracion> {
    await this.init();
    const siguiente: AppConfiguracion = {
      ...this.state.value,
      ...parcial,
      tamanoLetra: normalizarTamanoLetra(parcial.tamanoLetra ?? this.state.value.tamanoLetra),
    };
    if (!siguiente.escanearQr && !siguiente.escanearPatente) {
      return this.state.value;
    }
    this.state.next(siguiente);
    this.aplicarDom(siguiente);
    await this.storage.set(STORAGE_KEY, siguiente);
    return siguiente;
  }

  private async cargar(): Promise<void> {
    const guardado = await this.storage.get<Partial<AppConfiguracion>>(STORAGE_KEY);
    const cfg: AppConfiguracion = {
      ...DEFAULTS,
      ...(guardado ?? {}),
    };
    if (!cfg.escanearQr && !cfg.escanearPatente) {
      cfg.escanearQr = true;
      cfg.escanearPatente = true;
    }
    if (cfg.tema !== 'oscuro' && cfg.tema !== 'claro') {
      cfg.tema = 'claro';
    }
    cfg.tamanoLetra = normalizarTamanoLetra(cfg.tamanoLetra);
    this.state.next(cfg);
    this.aplicarDom(cfg);
  }

  private aplicarDom(cfg: AppConfiguracion): void {
    const html = document.documentElement;
    html.classList.toggle('tema-oscuro', cfg.tema === 'oscuro');
    html.classList.toggle('tema-claro', cfg.tema === 'claro');
    html.classList.remove(...CLASES_TEXTO);
    html.classList.add(`texto-${cfg.tamanoLetra}`);
    html.style.colorScheme = cfg.tema === 'oscuro' ? 'dark' : 'light';
  }
}
