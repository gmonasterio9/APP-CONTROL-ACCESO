import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';
import { SedesService } from '../../../core/services/sedes.service';
import { Sede } from '../../../core/models/sede.model';

type LoginStep = 'sede' | 'pin';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  step: LoginStep = 'sede';
  sedes: Sede[] = [];
  loadingSedes = false;
  selectedSede: Sede | null = null;
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private sedesService: SedesService,
    private router: Router,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
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
    this.loadSedes();
  }

  get pin() { return this.form.get('pin')!; }

  get sedeId() { return this.form.get('sedeId')!; }

  get selectedSedeText(): string {
    return this.selectedSede?.nombre ?? 'Elige una sede';
  }

  loadSedes(): void {
    this.loadingSedes = true;
    this.sedesService.getSedes().subscribe({
      next: (sedes) => {
        this.sedes = sedes;
        this.loadingSedes = false;
      },
      error: async () => {
        this.loadingSedes = false;
        await this.showToast('No se pudieron cargar las sedes. Intente nuevamente.');
      }
    });
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

    const loading = await this.loadingCtrl.create({ message: 'Verificando PIN...' });
    await loading.present();

    this.authService.loginWithPin(this.pin.value, this.selectedSede.id).subscribe({
      next: async () => {
        await loading.dismiss();
        this.router.navigate(['/home']);
      },
      error: async (err) => {
        await loading.dismiss();
        this.form.get('pin')?.reset();
        const mensaje = err?.error?.message || 'PIN incorrecto. Intente nuevamente.';
        await this.showToast(mensaje);
      }
    });
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color: 'danger',
      position: 'top'
    });
    await toast.present();
  }
}
