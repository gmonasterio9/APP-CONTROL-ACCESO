import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { EdgeToEdge } from '@capawesome/capacitor-android-edge-to-edge-support';
import { AuthService } from './core/services/auth.service';
import { ConfiguracionesService } from './core/services/configuraciones.service';
import { SedesService } from './core/services/sedes.service';
import { esSedeDesatendida } from './core/utils/sede-desatendida.util';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(
    private auth: AuthService,
    private router: Router,
    private sedes: SedesService,
    private configuraciones: ConfiguracionesService
  ) {
    this.initEdgeToEdge();
    void this.bootstrapPreferencias();
    this.sedes.prefetch();
    void this.bootstrapSession();
    this.listenAppResume();
  }

  private async bootstrapPreferencias(): Promise<void> {
    const sede = await this.auth.getSede();
    await this.configuraciones.aplicarSegunSede(esSedeDesatendida(sede));
  }

  private async bootstrapSession(): Promise<void> {
    const sessionActiva = await this.auth.restoreSession();
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
        this.sedes.prefetch();
        void this.reaplicarPreferenciasSede();
      }
    });
  }

  private async reaplicarPreferenciasSede(): Promise<void> {
    const sede = await this.auth.getSede();
    await this.configuraciones.aplicarSegunSede(esSedeDesatendida(sede));
  }

  private async initEdgeToEdge(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await EdgeToEdge.enable();
      await EdgeToEdge.setBackgroundColor({ color: '#050508' });
      await EdgeToEdge.setNavigationBarColor({ color: '#050508' });
    }
  }
}
