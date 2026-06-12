import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import {
  ingresoManualFueRegistrado,
  IngresoManualPeatonalRequest,
  IngresoManualRequest,
  IngresoManualVehiculosRequest,
  normalizarObservaciones,
  TipoMedioIngreso,
  TipoMedioVehiculo,
  TipoPersonaIngreso,
} from '../../core/models/ingreso-manual.model';
import {
  mapCatalogoIngresoManual,
  OpcionTipoMedioIngreso,
  OpcionTipoPersonaIngreso,
} from '../../core/models/login-sesion.model';
import { AuthService } from '../../core/services/auth.service';
import { IngresoManualService } from '../../core/services/ingreso-manual.service';
import { OfflineService } from '../../core/services/offline.service';
import { UiService } from '../../core/services/ui.service';
import {
  esPostEncoladoOffline,
  MENSAJE_POST_ENCOLADO,
} from '../../core/models/offline-cola.model';
import { mensajeErrorUsuario } from '../../core/utils/api-response.util';
import { PatenteMedio, PatenteUtil } from '../../core/utils/patente.util';
import { RutUtil } from '../../core/utils/rut.util';

const MEDIOS_SIN_PATENTE: TipoMedioIngreso[] = ['bicicleta', 'peatonal'];

const NOMBRES_PLACEHOLDER = new Set(['visitante', 'visita']);

function esNombreRealIngreso(nombre: string, perfilDescripcion?: string | null): boolean {
  const limpio = nombre.trim();
  if (!limpio) {
    return false;
  }
  const clave = limpio.toLowerCase();
  if (NOMBRES_PLACEHOLDER.has(clave)) {
    return false;
  }
  if (perfilDescripcion && clave === perfilDescripcion.trim().toLowerCase()) {
    return false;
  }
  return true;
}

function rutValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '');
  if (!value.trim()) {
    return null;
  }
  return RutUtil.isFormatValid(value) ? null : { rutFormato: true };
}

const NOMBRE_MAX_LENGTH = 20;
const NOMBRE_SOLO_LETRAS = /^[\p{L}\s]+$/u;

function filtrarNombreSoloLetras(value: string): string {
  return value
    .replace(/[^\p{L}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .slice(0, NOMBRE_MAX_LENGTH);
}

function nombreValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  if (!value) {
    return null;
  }
  return NOMBRE_SOLO_LETRAS.test(value) ? null : { nombreLetras: true };
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
  nombreMaxLength = NOMBRE_MAX_LENGTH;

  tiposPersonaVehicular: OpcionTipoPersonaIngreso[] = [];
  tiposPersonaPeatonal: OpcionTipoPersonaIngreso[] = [];
  tiposMedio: OpcionTipoMedioIngreso[] = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private ui: UiService,
    private ingresoManualService: IngresoManualService,
    private authService: AuthService,
    private offlineService: OfflineService
  ) {}

  async ngOnInit(): Promise<void> {
    this.form = this.fb.group({
      tipoPersona: ['estudiante' as TipoPersonaIngreso, Validators.required],
      tipoMedio: ['' as TipoMedioIngreso | '', Validators.required],
      patente: [''],
      rut: ['', [Validators.required, rutValidator]],
      nombre: [
        '',
        [
          Validators.required,
          Validators.maxLength(this.nombreMaxLength),
          nombreValidator,
        ],
      ],
      observaciones: ['', Validators.maxLength(this.obsMaxLength)],
    });

    this.form.get('tipoMedio')?.valueChanges.subscribe(medio => {
      const patenteCtrl = this.form.get('patente');
      const raw = String(patenteCtrl?.value ?? '');
      if (raw.trim()) {
        patenteCtrl?.setValue(
          PatenteUtil.formatInput(raw, this.patenteMedio),
          { emitEvent: false }
        );
      }
      this.sincronizarTipoPersonaConMedio(medio as TipoMedioIngreso | '');
      this.actualizarValidacionPatente();
    });

    await this.cargarCatalogosDesdeSesion();
    this.actualizarValidacionPatente();

    const nombre = this.route.snapshot.queryParamMap.get('nombre');
    const rut = this.route.snapshot.queryParamMap.get('rut');
    const perfil = this.route.snapshot.queryParamMap.get('perfil');
    const patente = this.route.snapshot.queryParamMap.get('patente');
    const tipoMedio = this.route.snapshot.queryParamMap.get('tipoMedio');

    const perfilDescripcion =
      this.route.snapshot.queryParamMap.get('perfilDescripcion');

    const nombreLimpio = (nombre ?? '').trim();
    if (esNombreRealIngreso(nombreLimpio, perfilDescripcion)) {
      this.form.patchValue({
        nombre: filtrarNombreSoloLetras(nombreLimpio),
      });
    }
    if (rut) {
      const rutNormalizado = RutUtil.normalizeManual(rut);
      if (RutUtil.isFormatValid(rutNormalizado)) {
        this.form.patchValue({
          rut: RutUtil.formatInput(rutNormalizado),
        });
      }
    }
    if (perfil) {
      const clave = perfil.trim().toLowerCase();
      const buscarEn = (lista: OpcionTipoPersonaIngreso[]) =>
        lista.find(t => t.value === clave || t.label.toLowerCase() === clave);
      const tipo =
        buscarEn(this.tiposPersonaPeatonal) ?? buscarEn(this.tiposPersonaVehicular);

      if (tipo) {
        this.form.patchValue({ tipoPersona: tipo.value });
      }

      if (tipo && !patente && !tipoMedio) {
        this.form.patchValue({ tipoMedio: 'peatonal' });
        this.actualizarValidacionPatente();
      }
    }

    if (patente) {
      const medioParam = (tipoMedio as TipoMedioIngreso) || 'auto';
      const medioPatente: PatenteMedio =
        medioParam === 'moto' ? 'moto' : 'auto';
      const medioIngreso: TipoMedioIngreso =
        medioParam === 'moto' || medioParam === 'auto'
          ? medioParam
          : 'auto';
      this.form.patchValue({
        tipoMedio: medioIngreso,
        patente: PatenteUtil.formatInput(patente, medioPatente),
      });
      this.actualizarValidacionPatente();
    } else if (tipoMedio) {
      this.form.patchValue({ tipoMedio: tipoMedio as TipoMedioIngreso });
      this.actualizarValidacionPatente();
    }
  }

  get tiposPersonaActivos(): OpcionTipoPersonaIngreso[] {
    if (this.form?.get('tipoMedio')?.value === 'peatonal') {
      return this.tiposPersonaPeatonal;
    }
    return this.tiposPersonaVehicular;
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

  get nombreLength(): number {
    return (this.form.get('nombre')?.value ?? '').length;
  }

  get obsLength(): number {
    return (this.form.get('observaciones')?.value ?? '').length;
  }

  onNombreInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const filtrado = filtrarNombreSoloLetras(input.value);
    this.form.get('nombre')?.setValue(filtrado, { emitEvent: false });
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

      if (!ingresoManualFueRegistrado(res)) {
        await this.ui.presentToast(
          res.message || 'No se pudo registrar el ingreso.',
          { color: 'warning' }
        );
        return;
      }

      if (esPostEncoladoOffline(res)) {
        await this.ui.presentToast(res.message ?? MENSAJE_POST_ENCOLADO, {
          color: 'warning',
          duration: 3000,
        });
      }

      const sede = await this.authService.getSede();
      const tipoPersonaLabel =
        this.tiposPersonaActivos.find(t => t.value === body.tipoPersona)?.label ??
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
      await this.ui.presentToast(
        mensajeErrorUsuario(err, 'Error al registrar el ingreso.'),
        { color: 'danger' }
      );
    }
  }

  volver(): void {
    this.navCtrl.back();
  }

  private buildRequestBody(): IngresoManualRequest {
    const tipoPersona = this.form.get('tipoPersona')?.value as TipoPersonaIngreso;
    const tipoMedio = this.form.get('tipoMedio')?.value as TipoMedioIngreso;
    const rut = RutUtil.normalizeManual(String(this.form.get('rut')?.value ?? ''));
    const nombre = filtrarNombreSoloLetras(
      String(this.form.get('nombre')?.value ?? '')
    ).trim();
    const observaciones = normalizarObservaciones(
      String(this.form.get('observaciones')?.value ?? '')
    );

    if (tipoMedio === 'peatonal') {
      const peatonal: IngresoManualPeatonalRequest = {
        tipoPersona,
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

  private async cargarCatalogosDesdeSesion(): Promise<void> {
    const usarOffline = await this.offlineService.debeUsarModoOffline();
    const sesion = usarOffline
      ? await this.offlineService.getEstacionamientoOffline()
      : await this.authService.getEstacionamientoSesion();
    const catalogo = mapCatalogoIngresoManual(sesion);

    this.tiposPersonaVehicular = catalogo.vehicular.tiposPersona;
    this.tiposPersonaPeatonal = catalogo.peatonal.tiposPersona;
    this.tiposMedio = catalogo.medios;

    const personaDefault = this.tiposPersonaVehicular[0]?.value ?? 'estudiante';
    this.form.patchValue({ tipoPersona: personaDefault });
  }

  private sincronizarTipoPersonaConMedio(medio: TipoMedioIngreso | ''): void {
    if (!medio) {
      return;
    }

    const opciones = medio === 'peatonal'
      ? this.tiposPersonaPeatonal
      : this.tiposPersonaVehicular;
    const actual = this.form.get('tipoPersona')?.value as TipoPersonaIngreso;

    if (!opciones.some(o => o.value === actual) && opciones[0]) {
      this.form.patchValue({ tipoPersona: opciones[0].value });
    }
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
