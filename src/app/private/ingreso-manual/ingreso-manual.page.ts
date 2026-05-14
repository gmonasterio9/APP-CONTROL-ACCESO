import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LoadingController, NavController, ToastController } from '@ionic/angular';

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
  ];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
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

    const nombre = this.route.snapshot.queryParamMap.get('nombre');
    const rut    = this.route.snapshot.queryParamMap.get('rut');
    if (nombre) this.form.patchValue({ nombre });
    if (rut)    this.form.patchValue({ rut });
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

    const loading = await this.loadingCtrl.create({ message: 'Registrando ingreso...' });
    await loading.present();
    await new Promise(r => setTimeout(r, 1000));
    await loading.dismiss();

    const toast = await this.toastCtrl.create({
      message: 'Ingreso aprobado correctamente.',
      duration: 2500,
      color: 'success',
      position: 'bottom',
    });
    await toast.present();
    this.navCtrl.back();
  }

  volver(): void {
    this.navCtrl.back();
  }
}
