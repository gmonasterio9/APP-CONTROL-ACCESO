import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth/inicio-sesion',
    pathMatch: 'full'
  },
  {
    path: 'auth/inicio-sesion',
    loadChildren: () =>
      import('./public/auth/inicio-sesion/inicio-sesion.module').then(
        m => m.InicioSesionPageModule
      )
  },
  {
    path: 'home',
    canActivate: [AuthGuard],
    loadChildren: () => import('./private/home/home.module').then(m => m.HomePageModule)
  },
  {
    path: 'estacionamiento',
    canActivate: [AuthGuard],
    loadChildren: () => import('./private/estacionamiento/estacionamiento.module').then(m => m.EstacionamientoModule)
  },
  {
    path: 'ingreso-manual',
    canActivate: [AuthGuard],
    loadChildren: () => import('./private/ingreso-manual/ingreso-manual.module').then(m => m.IngresoManualModule)
  },
  {
    path: 'estacionamiento-detalle',
    canActivate: [AuthGuard],
    loadChildren: () => import('./private/estacionamiento-detalle/estacionamiento-detalle.module').then(m => m.EstacionamientoDetalleModule)
  },
  {
    path: 'confirmacion',
    canActivate: [AuthGuard],
    loadChildren: () => import('./private/confirmacion/confirmacion.module').then(m => m.ConfirmacionModule)
  },
  {
    path: 'scanner',
    canActivate: [AuthGuard],
    loadChildren: () => import('./private/scanner/scanner.module').then(m => m.ScannerModule)
  },
  {
    path: 'acceso-peatonal-detalle',
    canActivate: [AuthGuard],
    loadChildren: () => import('./private/acceso-peatonal-detalle/acceso-peatonal-detalle.module').then(m => m.AccesoPeatonalDetalleModule)
  },
  {
    path: 'acceso-peatonal-registro',
    canActivate: [AuthGuard],
    loadChildren: () => import('./private/acceso-peatonal-registro/acceso-peatonal-registro.module').then(m => m.AccesoPeatonalRegistroModule)
  },
  {
    path: '**',
    redirectTo: 'auth/inicio-sesion'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
