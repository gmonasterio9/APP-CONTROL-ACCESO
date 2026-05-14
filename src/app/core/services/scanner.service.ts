import { Injectable } from '@angular/core';
import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerTypeHintALLOption,
  CapacitorBarcodeScannerCameraDirection,
  CapacitorBarcodeScannerScanOrientation,
  CapacitorBarcodeScannerAndroidScanningLibrary,
} from '@capacitor/barcode-scanner';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

@Injectable({ providedIn: 'root' })
export class ScannerService {

  async scanQR(): Promise<string | null> {
    const result = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHintALLOption.ALL,
      cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
      scanOrientation: CapacitorBarcodeScannerScanOrientation.PORTRAIT,
      android: {
        scanningLibrary: CapacitorBarcodeScannerAndroidScanningLibrary.MLKIT,
      },
    });

    return result.ScanResult ?? null;
  }

  async takePhotoBase64(): Promise<string | null> {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      quality: 90,
    });

    return photo.base64String ? `data:image/jpeg;base64,${photo.base64String}` : null;
  }
}
