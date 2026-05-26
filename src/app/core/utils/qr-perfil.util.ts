import { ValidarPerfilRequest } from '../models/validar-perfil.model';

const SIDIV_HOST = 'portal.sidiv.registrocivil.cl';

export function buildValidarPerfilBodyFromScan(raw: string): ValidarPerfilRequest {
  const value = raw.trim();
  if (!value) {
    return { qr: raw };
  }

  if (value.includes('BEGIN:VCARD')) {
    const email = extractVCardEmail(value);
    if (email) {
      return { email };
    }
  }

  if (isSidivUrl(value)) {
    const rut = extractRutFromSidivUrl(value);
    if (rut) {
      return { rut };
    }
  }

  if (isCredencialVirtualQr(value)) {
    return { qr: value };
  }

  if (isRutEscaneado(value)) {
    return { rut: normalizeRutManual(value) };
  }

  return { qr: value };
}

export function normalizeRutManual(value: string): string {
  const cleaned = value.replace(/\./g, '').trim().toUpperCase();
  if (cleaned.includes('-')) {
    return cleaned;
  }
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  return `${body}-${dv}`;
}

function isSidivUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname.toLowerCase().includes(SIDIV_HOST);
  } catch {
    return value.toLowerCase().includes(SIDIV_HOST);
  }
}

function extractRutFromSidivUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!url.hostname.toLowerCase().includes(SIDIV_HOST)) {
      return null;
    }
    const run = url.searchParams.get('RUN');
    return run ? extractRutBodyOnly(run) : null;
  } catch {
    const match = value.match(/[?&]RUN=([^&]+)/i);
    return match?.[1] ? extractRutBodyOnly(decodeURIComponent(match[1])) : null;
  }
}

function extractRutBodyOnly(run: string): string {
  const cleaned = decodeURIComponent(run).replace(/\./g, '').trim();
  const digits = cleaned.match(/^(\d+)/);
  return digits?.[1] ?? cleaned.split('-')[0].replace(/\D/g, '');
}

function extractVCardEmail(vcard: string): string | null {
  const match = vcard.match(/^EMAIL[^:\r\n]*:([^\r\n]+)/im);
  return match?.[1]?.trim() ?? null;
}

function isCredencialVirtualQr(value: string): boolean {
  if (value.startsWith('http') || value.includes('BEGIN:VCARD')) {
    return false;
  }
  return /^[A-Za-z0-9+/=]+$/.test(value) && value.length >= 16;
}

function isRutEscaneado(value: string): boolean {
  const cleaned = value.replace(/\./g, '').trim().toUpperCase();
  return /^\d{7,8}-[\dkK]$/.test(cleaned) || /^\d{7,9}$/.test(cleaned);
}
