import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { EdgeToEdge } from '@capawesome/capacitor-android-edge-to-edge-support';
import { Subscription, distinctUntilChanged, pairwise } from 'rxjs';
import { AuthService } from './core/services/auth.service';
import { NetworkService } from './core/services/network.service';
import { OfflineService } from './core/services/offline.service';
import { SedesService } from './core/services/sedes.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnDestroy {
  bannerVisible = false;
  bannerOk = false;
  bannerMensaje = 'Sin conexión';
  /** Fuerza recrear el banner al pasar de rojo a verde. */
  bannerKey = 0;

  private networkSub?: Subscription;
  private ocultarTimer?: ReturnType<typeof setTimeout>;
  private readonly BANNER_OK_MS = 3000;

  constructor(
    private auth: AuthService,
    private network: NetworkService,
    private offline: OfflineService,
    private router: Router,
    private sedes: SedesService,
    private cdr: ChangeDetectorRef
  ) {
    // Estado inicial: solo mostrar si ya está offline.
    if (!this.network.enLinea) {
      this.mostrarSinConexion();
    }

    // pairwise necesita 2 emisiones: salta el valor actual y compara cambios reales.
    this.networkSub = this.network.enLinea$
      .pipe(distinctUntilChanged(), pairwise())
      .subscribe(([antes, ahora]) => {
        if (!ahora) {
          this.mostrarSinConexion();
          return;
        }
        if (!antes && ahora) {
          this.mostrarConexionRestablecida();
        }
      });

    this.initEdgeToEdge();
    this.sedes.prefetch();
    void this.bootstrapSession();
    this.listenAppResume();
  }

  ngOnDestroy(): void {
    this.networkSub?.unsubscribe();
    this.limpiarTimer();
  }

  private mostrarSinConexion(): void {
    this.limpiarTimer();
    this.bannerOk = false;
    this.bannerMensaje = 'Sin conexión';
    this.bannerKey += 1;
    this.bannerVisible = true;
    this.cdr.detectChanges();
  }

  private mostrarConexionRestablecida(): void {
    this.limpiarTimer();
    this.bannerOk = true;
    this.bannerMensaje = 'Conexión restablecida';
    this.bannerKey += 1;
    this.bannerVisible = true;
    this.cdr.detectChanges();

    this.ocultarTimer = setTimeout(() => {
      if (this.network.enLinea) {
        this.bannerVisible = false;
        this.cdr.detectChanges();
      }
      this.ocultarTimer = undefined;
    }, this.BANNER_OK_MS);
  }

  private limpiarTimer(): void {
    if (this.ocultarTimer) {
      clearTimeout(this.ocultarTimer);
      this.ocultarTimer = undefined;
    }
  }

  private async bootstrapSession(): Promise<void> {
    const sessionActiva = await this.auth.restoreSession();
    void this.network.refrescarEstado();
    void this.offline.refrescarEstadoCatalogoPersonas();
    const enLogin =
      this.router.url === '/' ||
      this.router.url.includes('/auth/inicio-sesion');

    if (sessionActiva && enLogin) {
      await this.router.navigate(['/home'], { replaceUrl: true });
    }
  }

  private listenAppResume(): void {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void this.auth.restoreSession();
        void this.network.refrescarEstado();
        void this.offline.refrescarEstadoCatalogoPersonas();
        this.sedes.prefetch();
      }
    });
  }

  private async initEdgeToEdge(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await EdgeToEdge.enable();
      await EdgeToEdge.setBackgroundColor({ color: '#050508' });
      await EdgeToEdge.setNavigationBarColor({ color: '#050508' });
    }
  }
}
