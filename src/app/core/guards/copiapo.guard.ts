import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { esSedeDesatendida } from '../utils/sede-desatendida.util';

@Injectable({ providedIn: 'root' })
export class CopiapoGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async canActivate(): Promise<boolean> {
    if (esSedeDesatendida(await this.authService.getSede())) {
      return true;
    }
    await this.router.navigate(['/home'], { replaceUrl: true });
    return false;
  }
}
