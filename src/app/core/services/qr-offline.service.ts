import { Injectable } from '@angular/core';
import * as CryptoJS from 'crypto-js';
import { environment } from '../../../environments/environment';

export interface QrCredencialParseada {
  tokenValido: boolean;
  credencialExpirada: boolean;
  persNcorr: number;
  fechaExpira?: Date;
}

@Injectable({ providedIn: 'root' })
export class QrOfflineService {
  private readonly salt = '0x3sbvpjg4u84dri';
  private readonly iv = '4yrvfp5ffnkdhx6p';

  parseCredencialInacap(qrBase64: string): QrCredencialParseada {
    const invalido = (persNcorr = -1): QrCredencialParseada => ({
      tokenValido: false,
      credencialExpirada: false,
      persNcorr,
    });

    if (!qrBase64?.trim()) {
      return invalido();
    }

    const texto = this.decrypt(qrBase64.trim());
    if (!texto) {
      return invalido();
    }

    const partes = texto.split('|');
    const persNcorr = parseInt(partes[0]?.trim() ?? '', 10);
    if (partes.length !== 6 || !persNcorr || persNcorr <= 0) {
      return invalido();
    }

    const fechaExpira = this.parseFechaExpira(partes[5]);
    const credencialExpirada = !!fechaExpira && new Date() > fechaExpira;

    return {
      tokenValido: true,
      credencialExpirada,
      persNcorr,
      fechaExpira,
    };
  }

  private decrypt(qrBase64: string): string {
    const keyCrypt = environment.keyCrypt?.trim();
    if (!keyCrypt) {
      return '';
    }

    try {
      const key = this.deriveKeyNet(keyCrypt, this.salt, 2);
      const iv = CryptoJS.enc.Latin1.parse(this.iv);
      const cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: CryptoJS.enc.Base64.parse(qrBase64),
      });

      const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      return CryptoJS.enc.Utf8.stringify(decrypted);
    } catch {
      return '';
    }
  }

  private deriveKeyNet(
    password: string,
    salt: string,
    iterations: number
  ): CryptoJS.lib.WordArray {
    const passWords = CryptoJS.enc.Utf16LE.parse(password);
    const saltWords = CryptoJS.enc.Latin1.parse(salt);

    let hash = CryptoJS.SHA1(passWords.concat(saltWords));
    for (let i = 1; i < iterations; i++) {
      hash = CryptoJS.SHA1(hash);
    }

    const out: number[] = [];
    let buffer = hash;
    let counter = 0;

    while (out.length < 32) {
      if (counter === 0) {
        const words = buffer.words;
        for (let i = 0; i < words.length && out.length < 32; i++) {
          const w = words[i];
          out.push((w >>> 24) & 0xff, (w >>> 16) & 0xff, (w >>> 8) & 0xff, w & 0xff);
        }
        counter = 1;
        continue;
      }

      const ctr = CryptoJS.lib.WordArray.create([counter], 4);
      buffer = CryptoJS.SHA1(buffer.concat(ctr));
      const words = buffer.words;
      for (let i = 0; i < words.length && out.length < 32; i++) {
        const w = words[i];
        out.push((w >>> 24) & 0xff, (w >>> 16) & 0xff, (w >>> 8) & 0xff, w & 0xff);
      }
      counter++;
    }

    return CryptoJS.lib.WordArray.create(out.slice(0, 32), 32);
  }

  private parseFechaExpira(value?: string): Date | undefined {
    if (!value?.trim()) {
      return undefined;
    }
    const v = value.trim();
    if (v.length !== 12) {
      return undefined;
    }

    const dd = +v.slice(0, 2);
    const MM = +v.slice(2, 4);
    const yyyy = +v.slice(4, 8);
    const HH = +v.slice(8, 10);
    const mm = +v.slice(10, 12);

    const fecha = new Date(yyyy, MM - 1, dd, HH, mm, 0);
    return isNaN(fecha.getTime()) ? undefined : fecha;
  }
}
