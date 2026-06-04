export class RutUtil {
  private constructor() {}

  static formatInput(value: string): string {
    const clean = value.replace(/[^0-9kK]/gi, '').toUpperCase().slice(0, 9);
    if (!clean) {
      return '';
    }
    if (clean.length <= 8) {
      return RutUtil.formatBodyDots(clean);
    }
    const body = clean.slice(0, 8);
    const dv = clean.slice(8);
    return `${RutUtil.formatBodyDots(body)}-${dv}`;
  }

  static isFormatValid(value: string): boolean {
    const clean = value.replace(/[^0-9kK]/gi, '').toUpperCase();
    return /^[0-9]{7,8}[0-9K]$/.test(clean);
  }

  static normalizeManual(value: string): string {
    const cleaned = value.replace(/\./g, '').trim().toUpperCase();
    if (cleaned.includes('-')) {
      return cleaned;
    }
    const body = cleaned.slice(0, -1);
    const dv = cleaned.slice(-1);
    return `${body}-${dv}`;
  }

  static extractBodyOnly(run: string): string {
    const cleaned = decodeURIComponent(run).replace(/\./g, '').trim();
    const digits = cleaned.match(/^(\d+)/);
    return digits?.[1] ?? cleaned.split('-')[0].replace(/\D/g, '');
  }

  static normalizeFromRun(run: string): string {
    const cleaned = decodeURIComponent(run).replace(/\./g, '').trim().toUpperCase();
    if (!cleaned) {
      return '';
    }

    if (cleaned.includes('-')) {
      const [bodyPart, dvPart] = cleaned.split('-');
      const body = bodyPart.replace(/\D/g, '');
      const dv = dvPart.replace(/[^0-9K]/g, '').slice(0, 1);
      if (body && dv) {
        return `${body}-${dv}`;
      }
    }

    const digits = cleaned.match(/^(\d{7,8})([0-9K])?$/);
    if (digits) {
      const body = digits[1];
      const dv = digits[2];
      return dv ? `${body}-${dv}` : body;
    }

    return cleaned.replace(/\D/g, '');
  }

  static isScannedFormat(value: string): boolean {
    const cleaned = value.replace(/\./g, '').trim().toUpperCase();
    return /^\d{7,8}-[\dkK]$/.test(cleaned) || /^\d{7,9}$/.test(cleaned);
  }

  private static formatBodyDots(body: string): string {
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
}
