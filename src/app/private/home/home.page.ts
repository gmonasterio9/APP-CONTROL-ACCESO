import { Component } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

export interface Estacionamiento {
  id: number;
  nombre: string;
  ubicacion: string;
  cuposDisponibles: number;
  cuposTotales: number;
}

export interface AccesoPeatonal {
  id: number;
  nombre: string;
  ubicacion: string;
  estado: string;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  segmentoActivo = 'estacionamientos';

  tiposEscaneo = [
    { id: 'credencial', label: 'Credencial', svg: 'assets/svg/credencial.svg', color: '#FEEB80' },
    { id: 'cedula',     label: 'Cédula',     svg: 'assets/svg/cedula.svg',     color: '#A7B0F1' },
    { id: 'patente',    label: 'Patente',    svg: 'assets/svg/patente.svg',    color: '#FFB066' },
  ];

  estacionamientos: Estacionamiento[] = [
    { id: 1, nombre: 'Estacionamiento Principal',   ubicacion: 'Entrada Av. Vitacura',      cuposDisponibles: 71, cuposTotales: 75 },
    { id: 2, nombre: 'Estacionamiento Norte',        ubicacion: 'Sector Talleres',            cuposDisponibles: 11, cuposTotales: 75 },
    { id: 3, nombre: 'Estacionamiento Subterráneo',  ubicacion: 'Edificio Central - Subsuelo', cuposDisponibles: 46, cuposTotales: 55 },
  ];

  accesosPeatonales: AccesoPeatonal[] = [
    { id: 1, nombre: 'Entrada Principal', ubicacion: 'Acceso Av. Vitacura', estado: 'Abierto' },
    { id: 2, nombre: 'Entrada Norte',     ubicacion: 'Sector Talleres',     estado: 'Abierto' },
  ];

  statsPeatonal = [
    { valor: 142, label: 'Autorizados', color: '#2ECC71' },
    { valor: 3,   label: 'Expirados',   color: '#F39C12' },
    { valor: 5,   label: 'Visitas',     color: '#2563EB' },
  ];

  constructor(private authService: AuthService) {}

  porcentaje(item: Estacionamiento): number {
    return Math.round((item.cuposDisponibles / item.cuposTotales) * 100);
  }

  colorBarra(_item: Estacionamiento): string {
    return '#4CAF50';
  }

  escanear(): void {
    // TODO: integrar escáner de cámara (Capacitor Camera / BarcodeScanner)
    console.log('Escanear');
  }

  ingresoManual(): void {
    // TODO: abrir modal de ingreso manual
    console.log('Ingreso manual');
  }

  cerrarSesion(): void {
    this.authService.logout();
  }
}
