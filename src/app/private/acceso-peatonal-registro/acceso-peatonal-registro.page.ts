import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';
import { OBSERVACIONES_VACIAS } from '../../core/models/ingreso-manual.model';
import { PeatonalAccesoEstado } from '../../core/models/peatonal-detalle.model';

@Component({
  selector: 'app-acceso-peatonal-registro',
  templateUrl: 'acceso-peatonal-registro.page.html',
  styleUrls: ['acceso-peatonal-registro.page.scss'],
  standalone: false,
})
export class AccesoPeatonalRegistroPage {
  apesNcorr: number | null = null;
  nombre = '—';
  rut = '—';
  tipoQr = '—';
  estado: PeatonalAccesoEstado = 'permitido';
  hora = '—';
  observacion: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController
  ) {}

  ionViewWillEnter(): void {
    const params = this.route.snapshot.queryParamMap;
    const id = Number(params.get('apesNcorr'));

    this.apesNcorr = Number.isFinite(id) && id > 0 ? id : null;
    this.nombre = params.get('nombre')?.trim() || '—';
    this.rut = params.get('rut')?.trim() || '—';
    this.tipoQr = params.get('tipoQr')?.trim() || '—';
    this.hora = params.get('hora')?.trim() || '—';
    this.observacion = params.get('observacion')?.trim() || null;
    this.estado = this.normalizarEstado(params.get('estado'));
  }

  get textoObservacion(): string {
    return this.observacion?.trim() || OBSERVACIONES_VACIAS;
  }

  chipLabel(estado: PeatonalAccesoEstado): string {
    return {
      permitido: 'Permitido',
      manual: 'Manual',
      visita: 'Visita',
      rechazado: 'Rechazado',
      expirado: 'Expirado',
    }[estado];
  }

  volver(): void {
    this.navCtrl.back();
  }

  private normalizarEstado(raw: string | null): PeatonalAccesoEstado {
    const n = String(raw ?? '').trim().toLowerCase();
    if (n === 'manual') return 'manual';
    if (n === 'visita') return 'visita';
    if (n === 'rechazado') return 'rechazado';
    if (n === 'expirado') return 'expirado';
    return 'permitido';
  }
}
