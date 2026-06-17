import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { EdgeToEdge } from '@capawesome/capacitor-android-edge-to-edge-support';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(
    private auth: AuthService,
    private router: Router
  ) {
    this.initEdgeToEdge();
    void this.bootstrapSession();
    this.listenAppResume();
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
