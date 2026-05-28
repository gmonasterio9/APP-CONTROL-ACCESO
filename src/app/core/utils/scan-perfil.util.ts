import { ValidarPerfilRequest } from '../models/validar-perfil.model';
import { RutUtil } from './rut.util';

const SIDIV_HOST = 'portal.sidiv.registrocivil.cl';

export class ScanPerfilUtil {
  private constructor() {}

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
      const run = url.searchParams.get('RUN');
      return run ? RutUtil.extractBodyOnly(run) : null;
    } catch {
      const match = value.match(/[?&]RUN=([^&]+)/i);
      return match?.[1] ? RutUtil.extractBodyOnly(decodeURIComponent(match[1])) : null;
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
