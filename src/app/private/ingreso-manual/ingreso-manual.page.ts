import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import {
  IngresoManualRequest,
  TipoMedioIngreso,
  TipoPersonaIngreso,
} from '../../core/models/ingreso-manual.model';
import { AuthService } from '../../core/services/auth.service';
import { IngresoManualService } from '../../core/services/ingreso-manual.service';
import { UiService } from '../../core/services/ui.service';
import { PatenteUtil } from '../../core/utils/patente.util';
import { RutUtil } from '../../core/utils/rut.util';
import { ApiHttpError } from '../../core/services/api-http.service';

const MEDIOS_SIN_PATENTE: TipoMedioIngreso[] = ['bicicleta', 'peatonal'];

function rutValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '');
  if (!value.trim()) {
    return null;
  }
  return RutUtil.isFormatValid(value) ? null : { rutFormato: true };
}

function patenteValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '');
  if (!value.trim()) {
    return null;
  }
  return PatenteUtil.isFormatValid(value) ? null : { patenteFormato: true };
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
    private ui: UiService,
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
    const patente = this.route.snapshot.queryParamMap.get('patente');
    const tipoMedio = this.route.snapshot.queryParamMap.get('tipoMedio');

    if (nombre) {
      this.form.patchValue({ nombre });
    }
    if (rut) {
      this.form.patchValue({ rut: RutUtil.formatInput(RutUtil.normalizeManual(rut)) });
    }
    if (patente) {
      this.form.patchValue({
        patente: PatenteUtil.formatInput(patente),
        tipoMedio: (tipoMedio as TipoMedioIngreso) || 'auto',
      });
      this.actualizarValidacionPatente();
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
    const formatted = RutUtil.formatInput(input.value);
    this.form.get('rut')?.setValue(formatted, { emitEvent: false });
  }

  onPatenteInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = PatenteUtil.formatInput(input.value);
    this.form.get('patente')?.setValue(formatted, { emitEvent: false });
  }

  async aprobar(): Promise<void> {
    this.actualizarValidacionPatente();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      await this.ui.presentToast('Completa los campos obligatorios.', {
        duration: 2000,
        color: 'warning',
      });
      return;
    }

    const body = this.buildRequestBody();
    const loading = await this.ui.presentLoading('Registrando ingreso...');

    try {
      const res = await firstValueFrom(this.ingresoManualService.registrar(body));
      await this.ui.dismissLoading(loading);

      if (!res.success) {
        await this.ui.presentToast(
          res.message || 'No se pudo registrar el ingreso.',
          { color: 'warning' }
        );
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
      await this.ui.dismissLoading(loading);
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
      await this.ui.presentToast(mensaje, { color: 'danger' });
    }
  }

  volver(): void {
    this.navCtrl.back();
  }

  private buildRequestBody(): IngresoManualRequest {
    const tipoPersona = this.form.get('tipoPersona')?.value as TipoPersonaIngreso;
    const tipoMedio = this.form.get('tipoMedio')?.value as TipoMedioIngreso;
    const rut = RutUtil.normalizeManual(String(this.form.get('rut')?.value ?? ''));
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
      body.patente = PatenteUtil.toApi(String(this.form.get('patente')?.value ?? ''));
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
