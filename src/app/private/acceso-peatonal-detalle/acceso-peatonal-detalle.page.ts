import { Component } from '@angular/core';
import { NavController } from '@ionic/angular';

export type AccesoEstado = 'permitido' | 'manual' | 'visita';

export interface AccesoReciente {
  nombre:     string;
  rut:        string;
  credencial: string;
  estado:     AccesoEstado;
}

@Component({
  selector: 'app-acceso-peatonal-detalle',
  templateUrl: 'acceso-peatonal-detalle.page.html',
  styleUrls: ['acceso-peatonal-detalle.page.scss'],
  standalone: false,
})
export class AccesoPeatonalDetallePage {

  stats = [
    { valor: 142, label: 'Autorizados', color: '#2ECC71' },
    { valor: 3,   label: 'Ingreso Manual',   color: '#F39C12' },
    { valor: 5,   label: 'Visitas',     color: '#2563EB' },
  ];

  accesos: AccesoReciente[] = [
    { nombre: 'Juan Pérez Gonzalez', rut: '12.345.678-9', credencial: 'INP-2024-001', estado: 'permitido' },
    { nombre: 'Juan Pérez Gonzalez', rut: '12.345.678-9', credencial: 'INP-2024-001', estado: 'manual'  },
    { nombre: 'Juan Pérez Gonzalez', rut: '12.345.678-9', credencial: 'INP-2024-001', estado: 'visita'    },
  ];

  constructor(private navCtrl: NavController) {}

  chipLabel(estado: AccesoEstado): string {
    return { permitido: 'Permitido', manual: 'Manual', visita: 'Visita' }[estado];
  }

  volver(): void {
    this.navCtrl.back();
  }
}
