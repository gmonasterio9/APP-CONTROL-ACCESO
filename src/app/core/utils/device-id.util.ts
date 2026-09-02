import { crearIdColaOffline } from '../models/offline-cola.model';
import { AppStorageService } from '../services/app-storage.service';

const DEVICE_ID_KEY = 'device_id';

export async function obtenerDeviceId(storage: AppStorageService): Promise<string> {
  const existente = await storage.get<string>(DEVICE_ID_KEY);
  if (existente) {
    return existente;
  }

  const nuevo = crearIdColaOffline();
  await storage.set(DEVICE_ID_KEY, nuevo);
  return nuevo;
}
