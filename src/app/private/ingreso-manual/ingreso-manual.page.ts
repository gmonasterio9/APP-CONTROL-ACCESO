import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import {
  IngresoManualPeatonalRequest,
  IngresoManualRequest,
  IngresoManualVehiculosRequest,
  normalizarObservaciones,
  resolverTipoQr,
  TipoMedioIngreso,
  TipoMedioVehiculo,
  TipoPersonaIngreso,
} from '../../core/models/ingreso-manual.model';
import { AuthService } from '../../core/services/auth.service';
import { IngresoManualService } from '../../core/services/ingreso-manual.service';
import { UiService } from '../../core/services/ui.service';
import { PatenteMedio, PatenteUtil } from '../../core/utils/patente.util';
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
  const medio: PatenteMedio =
    control.parent?.get('tipoMedio')?.value === 'moto' ? 'moto' : 'auto';
  return PatenteUtil.isFormatValid(value, medio) ? null : { patenteFormato: true };
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

  private origenScan: string | null = null;
  private perfilScan: string | null = null;
  private perfilDescripcionScan: string | null = null;

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
      tipoPersona: ['estudiante' as TipoPersonaIngreso, Validators.required],
      tipoMedio: ['' as TipoMedioIngreso | '', Validators.required],
      patente: [''],
      rut: ['', [Validators.required, rutValidator]],
      nombre: ['', Validators.required],
      observaciones: ['', Validators.maxLength(this.obsMaxLength)],
    });

    this.form.get('tipoMedio')?.valueChanges.subscribe(() => {
      const patenteCtrl = this.form.get('patente');
      const raw = String(patenteCtrl?.value ?? '');
      if (raw.trim()) {
        patenteCtrl?.setValue(
          PatenteUtil.formatInput(raw, this.patenteMedio),
          { emitEvent: false }
        );
      }
      this.actualizarValidacionPatente();
    });
    this.actualizarValidacionPatente();

    const nombre = this.route.snapshot.queryParamMap.get('nombre');
    const rut = this.route.snapshot.queryParamMap.get('rut');
    const perfil = this.route.snapshot.queryParamMap.get('perfil');
    const patente = this.route.snapshot.queryParamMap.get('patente');
    const tipoMedio = this.route.snapshot.queryParamMap.get('tipoMedio');

    this.origenScan = this.route.snapshot.queryParamMap.get('origen');
    this.perfilScan = perfil;
    const perfilDescripcion =
      this.route.snapshot.queryParamMap.get('perfilDescripcion');
    this.perfilDescripcionScan = perfilDescripcion ?? null;

    const nombreLimpio = (nombre ?? '').trim();
    const noEsPerfilEnNombre =
      !perfilDescripcion ||
      nombreLimpio.toLowerCase() !== perfilDescripcion.trim().toLowerCase();
    if (nombreLimpio && noEsPerfilEnNombre) {
      this.form.patchValue({ nombre: nombreLimpio });
    }
    if (rut) {
      const rutNormalizado = RutUtil.normalizeManual(rut);
      if (RutUtil.isFormatValid(rutNormalizado)) {
        this.form.patchValue({
          rut: RutUtil.formatInput(rutNormalizado),
        });
      }
    }
    if (patente) {
      const medio = ((tipoMedio as TipoMedioIngreso) || 'auto') === 'moto' ? 'moto' : 'auto';
      this.form.patchValue({
        tipoMedio: (tipoMedio as TipoMedioIngreso) || 'auto',
        patente: PatenteUtil.formatInput(patente, medio),
      });
      this.actualizarValidacionPatente();
    }
    if (perfil) {
      const clave = perfil.trim().toLowerCase();
      const tipo = this.tiposPersona.find(
        t => t.value === clave || t.label.toLowerCase() === clave
      );
      if (tipo) {
        this.form.patchValue({ tipoPersona: tipo.value });
      }
    }
  }

  get requierePatente(): boolean {
    const medio = this.form?.get('tipoMedio')?.value as TipoMedioIngreso | '';
    return !!medio && !MEDIOS_SIN_PATENTE.includes(medio);
  }

  get patenteMedio(): PatenteMedio {
    return this.form?.get('tipoMedio')?.value === 'moto' ? 'moto' : 'auto';
  }


  get patenteFormatoHint(): string {
    return this.patenteMedio === 'moto'
      ? 'Moto: XXX-XX (ej. ABC-12 o 222-22) o ABCD-1 (nueva) — 5 caracteres'
      : 'Auto: 22-22-22 (actual) o ABCDE-1 (nueva) — 6 caracteres';
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
    const formatted = PatenteUtil.formatInput(input.value, this.patenteMedio);
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
    const observaciones = normalizarObservaciones(
      String(this.form.get('observaciones')?.value ?? '')
    );

    if (tipoMedio === 'peatonal') {
      const peatonal: IngresoManualPeatonalRequest = {
        tipoPersona,
        tipoQr: resolverTipoQr({
          origen: this.origenScan,
          tipoPersona,
          perfil: this.perfilScan,
          perfilDescripcion: this.perfilDescripcionScan,
        }),
        estado: 'EXITOSO',
        rut,
        nombre,
        observaciones,
      };
      return peatonal;
    }

    const vehiculos: IngresoManualVehiculosRequest = {
      tipoPersona,
      tipoMedio: tipoMedio as TipoMedioVehiculo,
      rut,
      nombre,
      observaciones,
    };

    if (this.requierePatente) {
      vehiculos.patente = PatenteUtil.toApi(
        String(this.form.get('patente')?.value ?? '')
      );
    }

    return vehiculos;
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
