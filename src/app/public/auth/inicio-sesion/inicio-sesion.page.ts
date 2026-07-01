import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SedesService } from '../../../core/services/sedes.service';
import { UiService } from '../../../core/services/ui.service';
import { Sede } from '../../../core/models/sede.model';

type InicioSesionStep = 'sede' | 'pin';

@Component({
  selector: 'app-inicio-sesion',
  templateUrl: './inicio-sesion.page.html',
  styleUrls: ['./inicio-sesion.page.scss'],
  standalone: false,
})
export class InicioSesionPage implements OnInit {
  step: InicioSesionStep = 'sede';
  sedes: Sede[] = [];
  loadingSedes = false;
  sedesLoadError = false;
  selectedSede: Sede | null = null;
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private sedesService: SedesService,
    private router: Router,
    private ui: UiService
  ) {
    this.form = this.fb.group({
      sedeId: [null as number | null, Validators.required],
      pin: ['', [
        Validators.required,
        Validators.minLength(6),
        Validators.maxLength(6),
        Validators.pattern(/^\d{6}$/)
      ]]
    });
  }

  ngOnInit(): void {
    void this.loadSedes();
  }

  async ionViewWillEnter(): Promise<void> {
    if (await this.authService.restoreSession()) {
      await this.router.navigate(['/home'], { replaceUrl: true });
      return;
    }

    if (!this.sedes.length) {
      void this.loadSedes();
    }
  }

  get pin() { return this.form.get('pin')!; }

  get sedeId() { return this.form.get('sedeId')!; }

  get selectedSedeText(): string {
    return this.selectedSede?.nombre ?? 'Elige una sede';
  }

  async loadSedes(): Promise<void> {
    this.sedesLoadError = false;
    const cached = await this.sedesService.getCachedSedes();

    if (cached.length > 0) {
      this.sedes = cached;
      this.loadingSedes = false;
      this.sedesLoadError = false;
      await this.restaurarSedeGuardada();
      this.actualizarSedesEnSegundoPlano();
      return;
    }

    this.loadingSedes = true;
    this.sedesService.refreshSedes().subscribe({
      next: async sedes => {
        this.sedes = sedes;
        this.loadingSedes = false;
        this.sedesLoadError = sedes.length === 0;
        await this.restaurarSedeGuardada();
      },
      error: () => {
        this.loadingSedes = false;
        this.sedesLoadError = true;
      },
    });
  }

  private actualizarSedesEnSegundoPlano(): void {
    this.sedesService.refreshSedes().subscribe({
      next: async sedes => {
        this.sedes = sedes;
        this.sedesLoadError = sedes.length === 0;
        await this.restaurarSedeGuardada();
      },
      error: () => {
        /* Mantiene el listado en caché sin molestar al usuario. */
      },
    });
  }

  private async restaurarSedeGuardada(): Promise<void> {
    const guardada = await this.authService.getSede();
    if (!guardada) {
      return;
    }

    const match = this.sedes.find(s => s.id === guardada.id);
    if (match) {
      this.onSedeSelected(match);
    }
  }

  onSedeSelected(sede: Sede): void {
    this.selectedSede = sede;
    this.form.patchValue({ sedeId: sede.id });
  }

  async continuarASede(): Promise<void> {
    if (this.sedeId.invalid || !this.selectedSede) return;
    await this.authService.setSede(this.selectedSede);
    this.step = 'pin';
  }

  volverASede(): void {
    this.step = 'sede';
    this.form.get('pin')?.reset();
  }

  async onSubmit(): Promise<void> {
    if (this.step !== 'pin' || this.form.invalid || !this.selectedSede) return;

    const loading = await this.ui.presentLoading('Verificando PIN...');

    this.authService.loginWithPin(this.pin.value, this.selectedSede.id).subscribe({
      next: async () => {
        await this.ui.dismissLoading(loading);
        this.router.navigate(['/home']);
      },
      error: async (err) => {
        await this.ui.dismissLoading(loading);
        this.form.get('pin')?.reset();
        const mensaje = err?.error?.message || 'PIN incorrecto. Intente nuevamente.';
        await this.showToast(mensaje);
      }
    });
  }

  private async showToast(message: string): Promise<void> {
    await this.ui.presentToast(message, {
      duration: 3000,
      color: 'danger',
      position: 'top',
    });
  }
}
