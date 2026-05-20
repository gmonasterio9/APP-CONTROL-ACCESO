import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LoadingController, NavController, ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ValidarPerfilService } from '../../core/services/validar-perfil.service';

@Component({
  selector: 'app-ingreso-manual',
  templateUrl: 'ingreso-manual.page.html',
  styleUrls: ['ingreso-manual.page.scss'],
  standalone: false,
})
export class IngresoManualPage implements OnInit {

  form!: FormGroup;
  obsMaxLength = 100;

  tiposPersona = [
    { value: 'estudiante', label: 'Estudiante' },
    { value: 'docente',    label: 'Docente'    },
    { value: 'visita',     label: 'Visita'     },
  ];

  tiposVehiculo = [
    { value: 'auto', label: 'Auto' },
    { value: 'moto', label: 'Moto' },
    { value: 'peatonal', label: 'Peatonal' },
  ];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private validarPerfilService: ValidarPerfilService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      tipoPersona: ['visita', Validators.required],
      vehiculo:    ['', Validators.required],
      patente:     ['', Validators.required],
      rut:         ['', Validators.required],
      nombre:      [''],
      observaciones: ['', Validators.maxLength(this.obsMaxLength)],
    });

    this.form.get('vehiculo')?.valueChanges.subscribe(() => {
      this.actualizarValidacionPatente();
    });
    this.actualizarValidacionPatente();

    const nombre = this.route.snapshot.queryParamMap.get('nombre');
    const rut = this.route.snapshot.queryParamMap.get('rut');
    const perfil = this.route.snapshot.queryParamMap.get('perfil');
    if (nombre) {
      this.form.patchValue({ nombre });
    }
    if (rut) {
      this.form.patchValue({ rut });
    }
    if (perfil) {
      const tipo = this.tiposPersona.find(t => t.value === perfil.toLowerCase());
      if (tipo) {
        this.form.patchValue({ tipoPersona: tipo.value });
      }
    }
  }

  get esPeatonal(): boolean {
    return this.form?.get('vehiculo')?.value === 'peatonal';
  }

  get obsLength(): number {
    return (this.form.get('observaciones')?.value ?? '').length;
  }

  async aprobar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const toast = await this.toastCtrl.create({
        message: 'Completa los campos obligatorios.',
        duration: 2000,
        color: 'warning',
        position: 'bottom',
      });
      await toast.present();
      return;
    }

    const rut = String(this.form.get('rut')?.value ?? '').trim();
    const loading = await this.loadingCtrl.create({ message: 'Validando perfil...' });
    await loading.present();

    try {
      const res = await firstValueFrom(this.validarPerfilService.validarPorRut(rut));
      await loading.dismiss();

      if (!res.success) {
        const toast = await this.toastCtrl.create({
          message: res.message || 'No se pudo validar el RUT.',
          duration: 2500,
          color: 'warning',
          position: 'bottom',
        });
        await toast.present();
        return;
      }

      const sede = await this.authService.getSede();

      await this.navCtrl.navigateForward('/confirmacion', {
        queryParams: {
          nombre:
            this.form.get('nombre')?.value ||
            res.perfilDescripcion ||
            null,
          sede: sede?.nombre ?? null,
          perfil: res.perfilDescripcion || res.perfil || this.form.get('tipoPersona')?.value,
        },
      });
    } catch (err: unknown) {
      await loading.dismiss();
      const mensaje =
        (err as { error?: { message?: string } })?.error?.message ||
        (err instanceof Error ? err.message : null) ||
        'Error al validar el RUT.';
      const toast = await this.toastCtrl.create({
        message: mensaje,
        duration: 2500,
        color: 'danger',
        position: 'bottom',
      });
      await toast.present();
    }
  }

  volver(): void {
    this.navCtrl.back();
  }

  private actualizarValidacionPatente(): void {
    const patente = this.form.get('patente');
    if (!patente) {
      return;
    }

    if (this.esPeatonal) {
      patente.clearValidators();
      patente.setValue('', { emitEvent: false });
    } else {
      patente.setValidators([Validators.required]);
    }

    patente.updateValueAndValidity({ emitEvent: false });
  }
}
