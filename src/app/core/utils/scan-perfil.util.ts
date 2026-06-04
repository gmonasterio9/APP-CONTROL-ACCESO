import { ValidarPerfilRequest } from '../models/validar-perfil.model';
import { RutUtil } from './rut.util';

const SIDIV_HOST = 'portal.sidiv.registrocivil.cl';

export class ScanPerfilUtil {
  private constructor() {}

  static esEscaneoQrPerfil(raw: string): boolean {
    const value = raw.trim();
    if (!value) {
      return false;
    }

    if (ScanPerfilUtil.isCredencialVirtualQr(value)) {
      return true;
    }

    if (ScanPerfilUtil.isSidivUrl(value)) {
      return true;
    }

    if (value.includes('BEGIN:VCARD')) {
      return true;
    }

    if (value.startsWith('http')) {
      return true;
    }

    if (RutUtil.isScannedFormat(value)) {
      return false;
    }

    return value.length >= 8;
  }

  static extractEmailFromEscaneo(raw: string): string | null {
    const value = raw.trim();
    if (!value.includes('BEGIN:VCARD')) {
      return null;
    }
    return ScanPerfilUtil.extractVCardEmail(value);
  }

  static esEscaneoPorEmail(raw: string): boolean {
    return !!ScanPerfilUtil.extractEmailFromEscaneo(raw);
  }

  static resolveTipoEscaneo(raw: string): 'cedula' | 'credencial' {
    const value = raw.trim();
    if (ScanPerfilUtil.isSidivUrl(value) || RutUtil.isScannedFormat(value)) {
      return 'cedula';
    }
    return 'credencial';
  }

  static extractRutCompletoFromEscaneo(raw: string): string | null {
    const value = raw.trim();
    if (!value) {
      return null;
    }

    if (ScanPerfilUtil.isSidivUrl(value)) {
      const run = ScanPerfilUtil.readRunParam(value);
      if (!run) {
        return null;
      }
      const normalizado = RutUtil.normalizeFromRun(run);
      return normalizado.includes('-') ? normalizado : null;
    }

    if (RutUtil.isScannedFormat(value)) {
      const normalizado = RutUtil.normalizeManual(value);
      return RutUtil.isFormatValid(normalizado) ? normalizado : null;
    }

    return null;
  }

  static buildValidarPerfilBody(raw: string): ValidarPerfilRequest {
    const value = raw.trim();
    if (!value) {
      return { qr: raw };
    }

    if (value.includes('BEGIN:VCARD')) {
      const email = ScanPerfilUtil.extractVCardEmail(value);
      if (email) {
        return { email };
      }
    }

    if (ScanPerfilUtil.isSidivUrl(value)) {
      const rut = ScanPerfilUtil.extractRutFromSidivUrl(value);
      if (rut) {
        return { rut };
      }
    }

    if (ScanPerfilUtil.isCredencialVirtualQr(value)) {
      return { qr: value };
    }

    if (RutUtil.isScannedFormat(value)) {
      return { rut: RutUtil.normalizeManual(value) };
    }

    return { qr: value };
  }

  private static isSidivUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.hostname.toLowerCase().includes(SIDIV_HOST);
    } catch {
      return value.toLowerCase().includes(SIDIV_HOST);
    }
  }

  private static extractRutFromSidivUrl(value: string): string | null {
    try {
      const url = new URL(value);
      if (!url.hostname.toLowerCase().includes(SIDIV_HOST)) {
        return null;
      }
      const run = ScanPerfilUtil.readRunParam(value);
      return run ? RutUtil.extractBodyOnly(run) : null;
    } catch {
      const run = ScanPerfilUtil.readRunParam(value);
      return run ? RutUtil.extractBodyOnly(run) : null;
    }
  }

  private static readRunParam(value: string): string | null {
    try {
      const url = new URL(value);
      return url.searchParams.get('RUN');
    } catch {
      const match = value.match(/[?&]RUN=([^&]+)/i);
      return match?.[1] ? decodeURIComponent(match[1]) : null;
    }
  }

  private static extractVCardEmail(vcard: string): string | null {
    const match = vcard.match(/^EMAIL[^:\r\n]*:([^\r\n]+)/im);
    return match?.[1]?.trim() ?? null;
  }

  private static isCredencialVirtualQr(value: string): boolean {
    if (value.startsWith('http') || value.includes('BEGIN:VCARD')) {
      return false;
    }
    return /^[A-Za-z0-9+/=]+$/.test(value) && value.length >= 16;
  }
}
