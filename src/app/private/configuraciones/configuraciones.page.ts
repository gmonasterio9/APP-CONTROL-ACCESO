import { Component } from '@angular/core';
import { NavController } from '@ionic/angular';
import {
  AppConfiguracion,
  ConfiguracionesService,
  TAMANO_LETRA_MAX,
  TAMANO_LETRA_MIN,
  TamanoLetra,
} from '../../core/services/configuraciones.service';
import { UiService } from '../../core/services/ui.service';

@Component({
  selector: 'app-configuraciones',
  templateUrl: 'configuraciones.page.html',
  styleUrls: ['configuraciones.page.scss'],
  standalone: false,
})
export class ConfiguracionesPage {
  cfg: AppConfiguracion = this.configuraciones.actual;
  readonly tamanoMin = TAMANO_LETRA_MIN;
  readonly tamanoMax = TAMANO_LETRA_MAX;

  constructor(
    private navCtrl: NavController,
    private configuraciones: ConfiguracionesService,
    private ui: UiService
  ) {}

  get tamanoValor(): number {
    return this.cfg.tamanoLetra;
  }

  async ionViewWillEnter(): Promise<void> {
    await this.configuraciones.init();
    this.cfg = this.configuraciones.actual;
  }

  volver(): void {
    this.navCtrl.back();
  }

  async onEscanearQr(checked: boolean): Promise<void> {
    if (checked === this.cfg.escanearQr) {
      return;
    }
    await this.guardarEscaneo({ escanearQr: checked });
  }

  async onEscanearPatente(checked: boolean): Promise<void> {
    if (checked === this.cfg.escanearPatente) {
      return;
    }
    await this.guardarEscaneo({ escanearPatente: checked });
  }

  async onTamano(valor: number | { lower: number; upper: number }): Promise<void> {
    const crudo = typeof valor === 'number' ? valor : valor.lower;
    const tamano = Math.min(
      TAMANO_LETRA_MAX,
      Math.max(TAMANO_LETRA_MIN, Math.round(crudo))
    ) as TamanoLetra;
    if (tamano === this.cfg.tamanoLetra) {
      return;
    }
    this.cfg = await this.configuraciones.actualizar({ tamanoLetra: tamano });
  }

  async onModoOscuro(checked: boolean): Promise<void> {
    const tema = checked ? 'oscuro' : 'claro';
    if (tema === this.cfg.tema) {
      return;
    }
    this.cfg = await this.configuraciones.actualizar({ tema });
  }

  private async guardarEscaneo(
    parcial: Pick<AppConfiguracion, 'escanearQr'> | Pick<AppConfiguracion, 'escanearPatente'>
  ): Promise<void> {
    const siguiente = { ...this.configuraciones.actual, ...parcial };
    if (!siguiente.escanearQr && !siguiente.escanearPatente) {
      await this.ui.presentToast('Debes dejar al menos un tipo de escaneo activo.');
      this.cfg = { ...this.configuraciones.actual };
      return;
    }
    this.cfg = await this.configuraciones.actualizar(parcial);
  }
}
