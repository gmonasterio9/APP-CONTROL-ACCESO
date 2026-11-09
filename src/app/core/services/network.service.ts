import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { ConnectionStatus, Network } from '@capacitor/network';
import { BehaviorSubject, Observable } from 'rxjs';

export type TipoConexionRed = 'wifi' | 'cellular' | 'none' | 'unknown';

export interface EstadoConexionRed {
  conectado: boolean;
  tipo: TipoConexionRed;
}

@Injectable({ providedIn: 'root' })
export class NetworkService implements OnDestroy {
  private readonly enLineaSubject = new BehaviorSubject<boolean>(navigator.onLine);
  private listener?: { remove: () => Promise<void> };
  private appStateListener?: { remove: () => Promise<void> };
  private onlineHandler?: () => void;
  private offlineHandler?: () => void;

  constructor(private zone: NgZone) {
    void this.inicializar();
  }

  get enLinea$(): Observable<boolean> {
    return this.enLineaSubject.asObservable();
  }

  get enLinea(): boolean {
    return this.enLineaSubject.value;
  }

  async hayInternet(): Promise<boolean> {
    const estado = await this.obtenerEstadoConexion();
    return estado.conectado;
  }

  /**
   * Red utilizable para operaciones en vivo (p. ej. ingreso vehicular que levanta barrera).
   * Sin conexión → se encola y luego sincroniza por batch sin barrera.
   */
  async aptaParaOperacionTiempoReal(): Promise<boolean> {
    const estado = await this.obtenerEstadoConexion();
    return estado.conectado && estado.tipo !== 'none';
  }

  async obtenerEstadoConexion(): Promise<EstadoConexionRed> {
    if (Capacitor.isNativePlatform()) {
      const estado = await Network.getStatus();
      const mapeado = this.mapEstadoNativo(estado);
      this.emitirEstado(mapeado.conectado);
      return mapeado;
    }

    const conectado = navigator.onLine;
    this.emitirEstado(conectado);
    return {
      conectado,
      tipo: conectado ? 'unknown' : 'none',
    };
  }

  /** Fuerza lectura actual de Network (útil al volver a primer plano). */
  async refrescarEstado(): Promise<boolean> {
    const estado = await this.obtenerEstadoConexion();
    return estado.conectado;
  }

  ngOnDestroy(): void {
    void this.listener?.remove();
    void this.appStateListener?.remove();
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
    }
    if (this.offlineHandler) {
      window.removeEventListener('offline', this.offlineHandler);
    }
  }

  private emitirEstado(conectado: boolean): void {
    if (this.enLineaSubject.value === conectado) {
      return;
    }
    this.zone.run(() => {
      this.enLineaSubject.next(conectado);
    });
  }

  private mapEstadoNativo(estado: ConnectionStatus): EstadoConexionRed {
    const tipo = (estado.connectionType ?? 'unknown') as TipoConexionRed;
    const conectado = !!estado.connected && tipo !== 'none';
    return { conectado, tipo };
  }

  private async inicializar(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      const estado = await Network.getStatus();
      this.emitirEstado(this.mapEstadoNativo(estado).conectado);
      this.listener = await Network.addListener('networkStatusChange', event => {
        this.emitirEstado(this.mapEstadoNativo(event).conectado);
      });
      this.appStateListener = await App.addListener(
        'appStateChange',
        ({ isActive }) => {
          if (isActive) {
            void this.refrescarEstado();
          }
        }
      );
      return;
    }

    this.onlineHandler = () => this.emitirEstado(true);
    this.offlineHandler = () => this.emitirEstado(false);
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
    this.emitirEstado(navigator.onLine);
  }
}
