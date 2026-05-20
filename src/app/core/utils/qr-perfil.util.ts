import { ValidarPerfilRequest } from '../models/validar-perfil.model';

const SIDIV_HOST = 'portal.sidiv.registrocivil.cl';

export function buildValidarPerfilBodyFromScan(
  raw: string
): ValidarPerfilRequest | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  if (value.includes('BEGIN:VCARD')) {
    const email = extractVCardEmail(value);
    return email ? { email } : null;
  }

  if (isSidivUrl(value)) {
    const rut = extractRutFromSidivUrl(value);
    return rut ? { rut } : null;
  }

  if (isCredencialVirtualQr(value)) {
    return { qr: value };
  }

  return null;
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
