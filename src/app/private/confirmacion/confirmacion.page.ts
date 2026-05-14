import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-confirmacion',
  templateUrl: 'confirmacion.page.html',
  styleUrls: ['confirmacion.page.scss'],
  standalone: false,
})
export class ConfirmacionPage {
  nombre:  string | null = null;
  sede:    string | null = null;
  perfil:  string | null = null;

  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController,
  ) {
    this.nombre = this.route.snapshot.queryParamMap.get('nombre');
    this.sede   = this.route.snapshot.queryParamMap.get('sede')   ?? 'Arica';
    this.perfil = this.route.snapshot.queryParamMap.get('perfil') ?? 'Visita';
  }

  cerrar(): void {
    this.navCtrl.navigateRoot('/home');
  }
}
