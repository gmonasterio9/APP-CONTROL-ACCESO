export class PatenteUtil {
  private constructor() {}

  static formatInput(value: string): string {
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

  static isFormatValid(value: string): boolean {
    const clean = value.replace(/[^A-Za-z0-9]/g, '');
    return clean.length === 6;
  }

  static toApi(value: string): string {
    return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  }
}
