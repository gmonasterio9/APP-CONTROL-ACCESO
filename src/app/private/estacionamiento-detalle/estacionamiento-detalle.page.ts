import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';

export type CategoriaTipo = 'estudiante' | 'docente' | 'visita';

export interface CupoCategoria {
  icono: string;
  label: string;
  disponibles: number;
  total: number;
  categoria: CategoriaTipo;
  fullWidth?: boolean;
}

const COLORES: Record<CategoriaTipo, { circulo: string; barra: string }> = {
  estudiante: { circulo: '#EDF3F8', barra: '#A0C3D9' },
  docente:    { circulo: '#DCDFF9', barra: '#717FE8' },
  visita:     { circulo: '#DCF9F8', barra: '#99D1CF' },
};

export interface VehiculoActivo {
  patente: string;
  nombre: string;
  rut: string;
  tipo: string;
  vehiculo: string;
  horaIngreso: string;
}

@Component({
  selector: 'app-estacionamiento-detalle',
  templateUrl: 'estacionamiento-detalle.page.html',
  styleUrls: ['estacionamiento-detalle.page.scss'],
  standalone: false,
})
export class EstacionamientoDetallePage implements OnInit {

  nombre   = '';
  subtitulo = 'Registro de vehículos';
  busqueda = '';

  cupos: CupoCategoria[] = [
    { icono: 'auto',   label: 'Auto Estudiantes', disponibles: 29, total: 30, categoria: 'estudiante' },
    { icono: 'moto',   label: 'Moto Estudiantes', disponibles: 19, total: 20, categoria: 'estudiante' },
    { icono: 'auto',   label: 'Auto Docentes',    disponibles: 29, total: 30, categoria: 'docente'    },
    { icono: 'moto',   label: 'Moto Docentes',    disponibles: 19, total: 20, categoria: 'docente'    },
    { icono: 'visita', label: 'Cupos Visitas',    disponibles: 29, total: 30, categoria: 'visita', fullWidth: true },
  ];

  colorCirculo(c: CupoCategoria): string { return COLORES[c.categoria].circulo; }
  colorBarra(c: CupoCategoria): string   { return COLORES[c.categoria].barra; }

  vehiculos: VehiculoActivo[] = [
    { patente: 'ABCD12', nombre: 'Juan Pérez',    rut: '12.34.678-9',  tipo: 'Estudiante', vehiculo: 'Auto', horaIngreso: '08:30' },
    { patente: 'WXYZ98', nombre: 'María López',   rut: '98.765.432-1', tipo: 'Estudiante', vehiculo: 'Moto', horaIngreso: '09:15' },
    { patente: 'PROF01', nombre: 'Carlos Rojas',  rut: '15.678.234-5', tipo: 'Visita',     vehiculo: 'Auto', horaIngreso: '07:45' },
  ];

  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController,
  ) {}

  ngOnInit(): void {
    this.nombre = this.route.snapshot.queryParamMap.get('nombre') ?? 'Estacionamiento';
  }

  get vehiculosFiltrados(): VehiculoActivo[] {
    const q = this.busqueda.trim().toLowerCase();
    if (!q) return this.vehiculos;
    return this.vehiculos.filter(v =>
      v.patente.toLowerCase().includes(q) ||
      v.nombre.toLowerCase().includes(q) ||
      v.rut.toLowerCase().includes(q)
    );
  }

  porcentaje(c: CupoCategoria): number {
    return Math.round((c.disponibles / c.total) * 100);
  }

  marcarSalida(v: VehiculoActivo): void {
    this.vehiculos = this.vehiculos.filter(x => x.patente !== v.patente);
  }

  volver(): void {
    this.navCtrl.back();
  }
}
