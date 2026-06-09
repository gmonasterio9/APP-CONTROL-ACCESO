import { Injectable, OnDestroy } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { BehaviorSubject, Observable } from 'rxjs';

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
    if (Capacitor.isNativePlatform()) {
      const estado = await Network.getStatus();
      return estado.connected;
    }
    return navigator.onLine;
  }

  ngOnDestroy(): void {
    void this.listener?.remove();
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
