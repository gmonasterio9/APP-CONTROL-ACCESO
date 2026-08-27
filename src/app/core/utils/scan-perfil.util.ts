import { ValidarPerfilRequest } from '../models/validar-perfil.model';
import { RutUtil } from './rut.util';

const SIDIV_HOST = 'sidiv.registrocivil.cl';
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

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

    if (ScanPerfilUtil.esTarjetaPresentacion(value)) {
      return true;
    }

    if (RutUtil.isScannedFormat(value)) {
      return false;
    }

    return false;
  }

  static extractEmailFromEscaneo(raw: string): string | null {
    const value = raw.trim();
    if (!ScanPerfilUtil.esTarjetaPresentacion(value)) {
      return null;
    }
    return ScanPerfilUtil.extractEmailDesdeTarjeta(value);
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

    if (ScanPerfilUtil.esTarjetaPresentacion(value)) {
      const email = ScanPerfilUtil.extractEmailDesdeTarjeta(value);
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

  static esTarjetaPresentacion(value: string): boolean {
    return ScanPerfilUtil.esVCard(value) || ScanPerfilUtil.esMecard(value);
  }

  private static esVCard(value: string): boolean {
    return /BEGIN\s*:\s*VCARD/i.test(value);
  }

  private static esMecard(value: string): boolean {
    return /^\s*MECARD:/i.test(value);
  }

  private static isSidivUrl(value: string): boolean {
    return ScanPerfilUtil.esHostSidiv(value);
  }

  private static esHostSidiv(value: string): boolean {
    try {
      const url = new URL(value);
      return url.hostname.toLowerCase().includes(SIDIV_HOST);
    } catch {
      return value.toLowerCase().includes(SIDIV_HOST);
    }
  }

  private static extractRutFromSidivUrl(value: string): string | null {
    if (!ScanPerfilUtil.esHostSidiv(value)) {
      return null;
    }
    const run = ScanPerfilUtil.readRunParam(value);
    return run ? RutUtil.extractBodyOnly(run) : null;
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

  private static extractEmailDesdeTarjeta(texto: string): string | null {
    const linea = texto.match(
      /(?:^|[\r\n])(?:item\d+\.)?EMAIL[^:\r\n]*:\s*([^\r\n]+)/i
    );
    const desdeLinea = linea?.[1]?.match(EMAIL_RE)?.[0]?.trim();
    if (desdeLinea) {
      return desdeLinea;
    }

    return texto.match(EMAIL_RE)?.[0]?.trim() ?? null;
  }

  static isCredencialVirtualQr(value: string): boolean {
    if (value.startsWith('http') || ScanPerfilUtil.esTarjetaPresentacion(value)) {
      return false;
    }
    return /^[A-Za-z0-9+/=]+$/.test(value) && value.length >= 16;
  }
}
