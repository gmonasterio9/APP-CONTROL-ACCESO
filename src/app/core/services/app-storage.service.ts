import { Inject, Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';

@Injectable({ providedIn: 'root' })
export class AppStorageService {
  private readonly ready: Promise<Storage>;

  constructor(@Inject(Storage) private ionicStorage: Storage) {
    this.ready = this.ionicStorage.create();
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.ready;
    await this.ionicStorage.set(key, value);
  }

  async get<T>(key: string): Promise<T | null> {
    await this.ready;
    const value = await this.ionicStorage.get(key);
    return (value ?? null) as T | null;
  }

  async remove(key: string): Promise<void> {
    await this.ready;
    await this.ionicStorage.remove(key);
  }
}
