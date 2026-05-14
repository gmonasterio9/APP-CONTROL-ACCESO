import { Component } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { EdgeToEdge } from '@capawesome/capacitor-android-edge-to-edge-support';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor() {
    this.initEdgeToEdge();
  }

  private async initEdgeToEdge(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await EdgeToEdge.enable();
      await EdgeToEdge.setBackgroundColor({ color: '#050508' });
      await EdgeToEdge.setNavigationBarColor({ color: '#050508' });
    }
  }
}
