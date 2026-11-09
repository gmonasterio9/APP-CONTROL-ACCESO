import { Injectable, OnDestroy } from '@angular/core';
import { Capacitor } from '@capacitor/core';
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

  constructor() {
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
      return this.mapEstadoNativo(estado);
    }

    return {
      conectado: navigator.onLine,
      tipo: navigator.onLine ? 'unknown' : 'none',
    };
  }

  ngOnDestroy(): void {
    void this.listener?.remove();
  }

  private mapEstadoNativo(estado: ConnectionStatus): EstadoConexionRed {
    return {
      conectado: estado.connected,
      tipo: estado.connectionType ?? 'unknown',
    };
  }

  private async inicializar(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      const estado = await Network.getStatus();
      this.enLineaSubject.next(estado.connected);
      this.listener = await Network.addListener('networkStatusChange', event => {
        this.enLineaSubject.next(event.connected);
      });
      return;
    }

    const actualizar = () => this.enLineaSubject.next(navigator.onLine);
    window.addEventListener('online', actualizar);
    window.addEventListener('offline', actualizar);
  }
}
