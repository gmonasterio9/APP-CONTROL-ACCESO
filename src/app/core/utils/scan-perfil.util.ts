import { ValidarPerfilRequest } from '../models/validar-perfil.model';
import { RutUtil } from './rut.util';

const SIDIV_HOST = 'sidiv.registrocivil.cl';
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

/** Campos unificados de credencial colaborador (vCard / MECARD). */
export type TarjetaPresentacionNorm = {
  email: string | null;
  nombre: string | null;
  titulo: string | null;
  sede: string | null;
  telefono: string | null;
  formato: 'vcard' | 'mecard';
};

export class ScanPerfilUtil {
  private constructor() {}

  static esEscaneoQrPerfil(raw: string): boolean {
    const value = ScanPerfilUtil.normalizarTextoEscaneo(raw);
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
      return RutUtil.isFormatValid(RutUtil.normalizeManual(value));
    }

    return false;
  }

  static extractEmailFromEscaneo(raw: string): string | null {
    const value = ScanPerfilUtil.normalizarTextoEscaneo(raw);
    if (!ScanPerfilUtil.esTarjetaPresentacion(value)) {
      return null;
    }
    return ScanPerfilUtil.parseTarjetaPresentacion(value).email;
  }

  static esEscaneoPorEmail(raw: string): boolean {
    return !!ScanPerfilUtil.extractEmailFromEscaneo(raw);
  }

  static resolveTipoEscaneo(raw: string): 'cedula' | 'credencial' {
    const value = ScanPerfilUtil.normalizarTextoEscaneo(raw);
    if (ScanPerfilUtil.isSidivUrl(value) || RutUtil.isScannedFormat(value)) {
      return 'cedula';
    }
    return 'credencial';
  }

  static extractRutCompletoFromEscaneo(raw: string): string | null {
    const value = ScanPerfilUtil.normalizarTextoEscaneo(raw);
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
    const value = ScanPerfilUtil.normalizarTextoEscaneo(raw);
    if (!value) {
      return { qr: raw };
    }

    if (ScanPerfilUtil.esTarjetaPresentacion(value)) {
      const email = ScanPerfilUtil.parseTarjetaPresentacion(value).email;
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
    const texto = ScanPerfilUtil.normalizarTextoEscaneo(value);
    return ScanPerfilUtil.esVCard(texto) || ScanPerfilUtil.esMecard(texto);
  }

  /**
   * Unifica vCard (con/sin TEL, EMAIL;WORK;INTERNET, etc.) y MECARD
   * al mismo modelo interno para validar por email.
   */
  static parseTarjetaPresentacion(raw: string): TarjetaPresentacionNorm {
    const texto = ScanPerfilUtil.normalizarTextoEscaneo(raw);
    if (ScanPerfilUtil.esMecard(texto)) {
      return ScanPerfilUtil.parseMecard(texto);
    }
    return ScanPerfilUtil.parseVCard(texto);
  }

  private static normalizarTextoEscaneo(raw: string): string {
    return String(raw ?? '')
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Unfold vCard soft line breaks (CRLF + space/tab).
      .replace(/\n[ \t]/g, '')
      .trim();
  }

  private static esVCard(value: string): boolean {
    return /BEGIN\s*:\s*VCARD/i.test(value);
  }

  private static esMecard(value: string): boolean {
    return /^\s*MECARD:/i.test(value);
  }

  private static parseVCard(texto: string): TarjetaPresentacionNorm {
    const lineas = ScanPerfilUtil.lineasVCard(texto);
    const email =
      ScanPerfilUtil.valorCampoVCard(lineas, 'EMAIL') ??
      ScanPerfilUtil.primerEmailEnTexto(texto);
    const fn = ScanPerfilUtil.valorCampoVCard(lineas, 'FN');
    const n = ScanPerfilUtil.valorCampoVCard(lineas, 'N');
    const nombre = fn || ScanPerfilUtil.nombreDesdeN(n);
    return {
      email: email ? email.toLowerCase() : null,
      nombre,
      titulo: ScanPerfilUtil.valorCampoVCard(lineas, 'TITLE'),
      sede: ScanPerfilUtil.valorCampoVCard(lineas, 'ORG'),
      telefono: ScanPerfilUtil.valorCampoVCard(lineas, 'TEL'),
      formato: 'vcard',
    };
  }

  private static parseMecard(texto: string): TarjetaPresentacionNorm {
    const cuerpo = texto.replace(/^\s*MECARD:/i, '');
    const email =
      ScanPerfilUtil.valorMecard(cuerpo, 'EMAIL') ??
      ScanPerfilUtil.primerEmailEnTexto(texto);
    const nombre = ScanPerfilUtil.valorMecard(cuerpo, 'N');
    const telefono = ScanPerfilUtil.valorMecard(cuerpo, 'TEL');
    const sede =
      ScanPerfilUtil.valorMecard(cuerpo, 'ORG') ??
      ScanPerfilUtil.valorMecard(cuerpo, 'NOTE');
    return {
      email: email ? email.toLowerCase() : null,
      nombre,
      titulo: ScanPerfilUtil.valorMecard(cuerpo, 'TITLE'),
      sede,
      telefono,
      formato: 'mecard',
    };
  }

  private static lineasVCard(texto: string): string[] {
    return texto
      .split('\n')
      .map(l => l.trim())
      .filter(l => !!l && !/^BEGIN\s*:/i.test(l) && !/^END\s*:/i.test(l) && !/^VERSION\s*:/i.test(l));
  }

  /**
   * Acepta:
   * - EMAIL:user@inacap.cl
   * - EMAIL;WORK;INTERNET:user@inacap.cl
   * - EMAIL;TYPE=INTERNET;TYPE=WORK:user@inacap.cl
   * - item1.EMAIL;TYPE=INTERNET:user@inacap.cl
   */
  private static valorCampoVCard(lineas: string[], campo: string): string | null {
    const re = new RegExp(
      `^(?:item\\d+\\.)?${campo}(?:[;:]|$)`,
      'i'
    );
    for (const linea of lineas) {
      if (!re.test(linea)) {
        continue;
      }
      const idx = linea.indexOf(':');
      if (idx < 0) {
        continue;
      }
      const valor = linea.slice(idx + 1).trim();
      if (!valor) {
        continue;
      }
      if (campo.toUpperCase() === 'EMAIL') {
        return valor.match(EMAIL_RE)?.[0]?.trim() ?? null;
      }
      return valor.replace(/\\n/gi, ' ').trim() || null;
    }
    return null;
  }

  private static valorMecard(cuerpo: string, campo: string): string | null {
    const re = new RegExp(`${campo}:([^;]*)`, 'i');
    const m = cuerpo.match(re);
    const valor = m?.[1]?.trim();
    if (!valor) {
      return null;
    }
    if (campo.toUpperCase() === 'EMAIL') {
      return valor.match(EMAIL_RE)?.[0]?.trim() ?? null;
    }
    return valor;
  }

  private static nombreDesdeN(n: string | null): string | null {
    if (!n) {
      return null;
    }
    // N:Apellidos;Nombre;...
    const parts = n.split(';').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[1]} ${parts[0]}`.trim();
    }
    return parts[0] || null;
  }

  private static primerEmailEnTexto(texto: string): string | null {
    return texto.match(EMAIL_RE)?.[0]?.trim() ?? null;
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

  static isCredencialVirtualQr(value: string): boolean {
    const texto = ScanPerfilUtil.normalizarTextoEscaneo(value);
    if (texto.startsWith('http') || ScanPerfilUtil.esTarjetaPresentacion(texto)) {
      return false;
    }
    return /^[A-Za-z0-9+/=]+$/.test(texto) && texto.length >= 16;
  }
}
