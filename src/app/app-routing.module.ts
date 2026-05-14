import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full'
  },
  {
    path: 'auth/login',
    loadChildren: () => import('./public/auth/login/login.module').then(m => m.LoginPageModule)
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
    path: '**',
    redirectTo: 'auth/login'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
