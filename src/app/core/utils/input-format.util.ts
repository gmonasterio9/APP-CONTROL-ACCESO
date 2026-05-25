/** Máscara visual: 20.497.490-K (máx. 8 dígitos cuerpo + 1 DV). */
export function formatRutInput(value: string): string {
  const clean = value.replace(/[^0-9kK]/gi, '').toUpperCase().slice(0, 9);
  if (!clean) {
    return '';
  }
  if (clean.length <= 8) {
    return formatRutBodyDots(clean);
  }
  const body = clean.slice(0, 8);
  const dv = clean.slice(8);
  return `${formatRutBodyDots(body)}-${dv}`;
}

function formatRutBodyDots(body: string): string {
  return body
    .split('')
    .reverse()
    .reduce((acc, char, index) => {
      if (index > 0 && index % 3 === 0) {
        return `${char}.${acc}`;
      }
      return `${char}${acc}`;
    }, '');
}

export function isRutFormatValid(value: string): boolean {
  const clean = value.replace(/[^0-9kK]/gi, '').toUpperCase();
  return /^[0-9]{7,8}[0-9K]$/.test(clean);
}

/** Máscara visual: PT-CL-21 (máx. 6 letras/números). */
export function formatPatenteInput(value: string): string {
  const clean = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
  if (!clean) {
    return '';
  }
  const parts: string[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    parts.push(clean.slice(i, i + 2));
  }
  return parts.join('-');
}

export function isPatenteFormatValid(value: string): boolean {
  const clean = value.replace(/[^A-Za-z0-9]/g, '');
  return clean.length === 6;
}

/** Valor para API sin guiones (ej. PTCL21 o ABQE15). */
export function patenteToApi(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}
