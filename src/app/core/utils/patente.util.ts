export type PatenteMedio = 'auto' | 'moto';

const AUTO_ACTUAL = /^[A-Z0-9]{2}[A-Z0-9]{2}[A-Z0-9]{2}$/;

const AUTO_NUEVA = /^[A-Z]{5}[A-Z0-9]$/;

const MOTO_ACTUAL = /^[A-Z0-9]{3}[A-Z0-9]{2}$/;

const MOTO_NUEVA = /^[A-Z]{4}[A-Z0-9]$/;

const LONGITUD: Record<PatenteMedio, number> = {
  auto: 6,
  moto: 5,
};

export class PatenteUtil {
  private constructor() {}

  static longitud(medio: PatenteMedio = 'auto'): number {
    return LONGITUD[medio];
  }

  static maxAlfanumericos(medio: PatenteMedio = 'auto'): number {
    return this.longitud(medio);
  }

  static limpiar(value: string): string {
    return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  }

  static toApi(value: string): string {
    return this.limpiar(value);
  }

  static esAutoValida(clean: string): boolean {
    return AUTO_ACTUAL.test(clean) || AUTO_NUEVA.test(clean);
  }

  static esMotoValida(clean: string): boolean {
    return MOTO_ACTUAL.test(clean) || MOTO_NUEVA.test(clean);
  }

  static inferirMedio(clean: string): PatenteMedio | null {
    if (clean.length === 6 && this.esAutoValida(clean)) {
      return 'auto';
    }
    if (clean.length === 5 && this.esMotoValida(clean)) {
      return 'moto';
    }
    return null;
  }

  static formatInput(value: string, medio: PatenteMedio = 'auto'): string {
    const max = this.longitud(medio);
    const clean = this.limpiar(value).slice(0, max);
    if (!clean) {
      return '';
    }
    return medio === 'moto' ? this.formatMoto(clean) : this.formatAuto(clean);
  }

  static formatInputScanner(value: string): string {
    const clean = this.limpiar(value).slice(0, 6);
    if (!clean) {
      return '';
    }

    if (clean.length === 6) {
      return this.formatAuto(clean);
    }

    if (clean.length === 5) {
      if (/^[A-Z]{5}$/.test(clean)) {
        return clean;
      }
      return this.formatMoto(clean);
    }

    if (clean.length === 4 && /^[A-Z]{4}$/.test(clean)) {
      return clean;
    }

    if (clean.length <= 2) {
      return clean;
    }

    return `${clean.slice(0, 2)}-${clean.slice(2)}`;
  }

  static isFormatValid(value: string, medio: PatenteMedio = 'auto'): boolean {
    const clean = this.limpiar(value);
    return medio === 'moto' ? this.esMotoValida(clean) : this.esAutoValida(clean);
  }

  static isFormatValidAutoOMoto(value: string): boolean {
    const clean = this.limpiar(value);
    return this.inferirMedio(clean) !== null;
  }

  private static formatAuto(clean: string): string {
    if (clean.length === 6 && AUTO_NUEVA.test(clean)) {
      return `${clean.slice(0, 5)}-${clean.slice(5)}`;
    }

    if (clean.length <= 2) {
      return clean;
    }
    if (clean.length <= 4) {
      return `${clean.slice(0, 2)}-${clean.slice(2)}`;
    }
    return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
  }

  private static formatMoto(clean: string): string {
    if (clean.length === 5 && MOTO_NUEVA.test(clean)) {
      return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    }

    if (clean.length <= 3) {
      return clean;
    }
    return `${clean.slice(0, 3)}-${clean.slice(3, 5)}`;
  }
}
