import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage {
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
  ) {
    this.form = this.fb.group({
      pin: ['', [
        Validators.required,
        Validators.minLength(6),
        Validators.maxLength(6),
        Validators.pattern(/^\d{6}$/)
      ]]
    });
  }

  get pin() { return this.form.get('pin')!; }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    const loading = await this.loadingCtrl.create({ message: 'Verificando PIN...' });
    await loading.present();

    this.authService.loginWithPin(this.pin.value).subscribe({
      next: async () => {
        await loading.dismiss();
        this.router.navigate(['/home']);
      },
      error: async (err) => {
        await loading.dismiss();
        this.form.reset();
        const mensaje = err?.error?.message || 'PIN incorrecto. Intente nuevamente.';
        const toast = await this.toastCtrl.create({
          message: mensaje,
          duration: 3000,
          color: 'danger',
          position: 'top'
        });
        await toast.present();
      }
    });
  }
}
