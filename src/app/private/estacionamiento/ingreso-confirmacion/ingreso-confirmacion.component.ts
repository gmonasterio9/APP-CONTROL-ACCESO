import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-ingreso-confirmacion',
  templateUrl: 'ingreso-confirmacion.component.html',
  styleUrls: ['ingreso-confirmacion.component.scss'],
  standalone: false,
})
export class IngresoConfirmacionComponent {
  @Input() nombre?:     string;
  @Input() sede?:       string = 'Arica';
  @Input() perfil?:     string = 'Visita';
  @Input() estacionamiento?: string;

  constructor(private modalCtrl: ModalController) {}

  cerrar(): void {
    this.modalCtrl.dismiss();
  }
}
