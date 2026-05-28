import { Injectable } from '@angular/core';
import {
  AlertController,
  AlertOptions,
  LoadingController,
  LoadingOptions,
  ToastController,
  ToastOptions,
} from '@ionic/angular';

@Injectable({ providedIn: 'root' })
export class UiService {
  private readonly mode = 'ios' as const;

  constructor(
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  async presentLoading(
    message: string,
    extra?: Omit<LoadingOptions, 'message' | 'mode'>
  ): Promise<HTMLIonLoadingElement> {
    const loading = await this.loadingCtrl.create({
      mode: this.mode,
      message,
      ...extra,
    });
    await loading.present();
    return loading;
  }

  async dismissLoading(
    loading: HTMLIonLoadingElement | null | undefined
  ): Promise<void> {
    if (loading) {
      await loading.dismiss();
    }
  }

  async presentToast(
    message: string,
    extra?: Omit<ToastOptions, 'message' | 'mode'>
  ): Promise<void> {
    const toast = await this.toastCtrl.create({
      mode: this.mode,
      message,
      duration: 2500,
      position: 'bottom',
      ...extra,
    });
    await toast.present();
  }

  async presentAlert(options: AlertOptions): Promise<HTMLIonAlertElement> {
    const alert = await this.alertCtrl.create({
      mode: this.mode,
      ...options,
    });
    await alert.present();
    return alert;
  }
}
