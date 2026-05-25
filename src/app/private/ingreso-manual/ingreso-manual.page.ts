import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LoadingController, NavController, ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import {
  IngresoManualRequest,
  TipoMedioIngreso,
  TipoPersonaIngreso,
} from '../../core/models/ingreso-manual.model';
import { AuthService } from '../../core/services/auth.service';
import { IngresoManualService } from '../../core/services/ingreso-manual.service';
import {
  formatPatenteInput,
  formatRutInput,
  isPatenteFormatValid,
  isRutFormatValid,
  patenteToApi,
} from '../../core/utils/input-format.util';
import { normalizeRutManual } from '../../core/utils/qr-perfil.util';
import { ApiHttpError } from '../../core/services/api-http.service';

const MEDIOS_SIN_PATENTE: TipoMedioIngreso[] = ['bicicleta', 'peatonal'];

function rutValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '');
  if (!value.trim()) {
    return null;
  }
  return isRutFormatValid(value) ? null : { rutFormato: true };
}

function patenteValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '');
  if (!value.trim()) {
    return null;
  }
  return isPatenteFormatValid(value) ? null : { patenteFormato: true };
}

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
    { value: 'estudiante' as TipoPersonaIngreso, label: 'Estudiante' },
    { value: 'docente' as TipoPersonaIngreso, label: 'Docente' },
    { value: 'colaborador' as TipoPersonaIngreso, label: 'Colaborador' },
    { value: 'visita' as TipoPersonaIngreso, label: 'Visita' },
  ];

  tiposMedio = [
    { value: 'auto' as TipoMedioIngreso, label: 'Auto' },
    { value: 'moto' as TipoMedioIngreso, label: 'Moto' },
    { value: 'bicicleta' as TipoMedioIngreso, label: 'Bicicleta' },
    { value: 'peatonal' as TipoMedioIngreso, label: 'Peatonal' },
  ];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private ingresoManualService: IngresoManualService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      tipoPersona: ['visita' as TipoPersonaIngreso, Validators.required],
      tipoMedio: ['' as TipoMedioIngreso | '', Validators.required],
      patente: [''],
      rut: ['', [Validators.required, rutValidator]],
      nombre: ['', Validators.required],
      observaciones: ['', Validators.maxLength(this.obsMaxLength)],
    });

    this.form.get('tipoMedio')?.valueChanges.subscribe(() => {
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
      this.form.patchValue({ rut: formatRutInput(normalizeRutManual(rut)) });
    }
    if (perfil) {
      const tipo = this.tiposPersona.find(t => t.value === perfil.toLowerCase());
      if (tipo) {
        this.form.patchValue({ tipoPersona: tipo.value });
      }
    }
  }

  get requierePatente(): boolean {
    const medio = this.form?.get('tipoMedio')?.value as TipoMedioIngreso | '';
    return !!medio && !MEDIOS_SIN_PATENTE.includes(medio);
  }

  get obsLength(): number {
    return (this.form.get('observaciones')?.value ?? '').length;
  }

  onRutInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatRutInput(input.value);
    this.form.get('rut')?.setValue(formatted, { emitEvent: false });
  }

  onPatenteInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatPatenteInput(input.value);
    this.form.get('patente')?.setValue(formatted, { emitEvent: false });
  }

  async aprobar(): Promise<void> {
    this.actualizarValidacionPatente();

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

    const body = this.buildRequestBody();
    const loading = await this.loadingCtrl.create({ message: 'Registrando ingreso...' });
    await loading.present();

    try {
      const res = await firstValueFrom(this.ingresoManualService.registrar(body));
      await loading.dismiss();

      if (!res.success) {
        const toast = await this.toastCtrl.create({
          message: res.message || 'No se pudo registrar el ingreso.',
          duration: 2500,
          color: 'warning',
          position: 'bottom',
        });
        await toast.present();
        return;
      }

      const sede = await this.authService.getSede();
      const tipoPersonaLabel =
        this.tiposPersona.find(t => t.value === body.tipoPersona)?.label ??
        body.tipoPersona;

      await this.navCtrl.navigateForward('/confirmacion', {
        queryParams: {
          nombre: body.nombre,
          sede: sede?.nombre ?? null,
          perfil: tipoPersonaLabel,
        },
      });
    } catch (err: unknown) {
      await loading.dismiss();
      const apiErr = err as ApiHttpError;
      const mensaje =
        apiErr?.message ||
        (typeof apiErr?.error === 'object' &&
        apiErr.error !== null &&
        'message' in apiErr.error &&
        typeof (apiErr.error as { message: unknown }).message === 'string'
          ? (apiErr.error as { message: string }).message
          : null) ||
        'Error al registrar el ingreso.';
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

  private buildRequestBody(): IngresoManualRequest {
    const tipoPersona = this.form.get('tipoPersona')?.value as TipoPersonaIngreso;
    const tipoMedio = this.form.get('tipoMedio')?.value as TipoMedioIngreso;
    const rut = normalizeRutManual(String(this.form.get('rut')?.value ?? ''));
    const nombre = String(this.form.get('nombre')?.value ?? '').trim();
    const observaciones = String(this.form.get('observaciones')?.value ?? '').trim();

    const body: IngresoManualRequest = {
      tipoPersona,
      tipoMedio,
      rut,
      nombre,
    };

    if (observaciones) {
      body.observaciones = observaciones;
    }

    if (this.requierePatente) {
      body.patente = patenteToApi(String(this.form.get('patente')?.value ?? ''));
    }

    return body;
  }

  private actualizarValidacionPatente(): void {
    const patente = this.form.get('patente');
    if (!patente) {
      return;
    }

    if (!this.requierePatente) {
      patente.clearValidators();
      patente.setValue('', { emitEvent: false });
    } else {
      patente.setValidators([Validators.required, patenteValidator]);
    }

    patente.updateValueAndValidity({ emitEvent: false });
  }
}
