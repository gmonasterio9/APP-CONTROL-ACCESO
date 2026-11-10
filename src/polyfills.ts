import './zone-flags';
import 'zone.js';

// Android 9 / WebView viejo (p.ej. Lenovo YT-X705F): Angular puede fallar con pantalla blanca.
(() => {
  const g: any =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof self !== 'undefined'
        ? self
        : typeof window !== 'undefined'
          ? window
          : undefined;
  if (g && typeof g.globalThis === 'undefined') {
    g.globalThis = g;
  }

  const proto: any = Array.prototype;

  if (typeof proto.flat !== 'function') {
    proto.flat = function flat(this: any[], depth?: number): any[] {
      const d = Number(depth) || 1;
      return d > 0
        ? this.reduce(
            (acc: any[], val: any) =>
              acc.concat(Array.isArray(val) ? proto.flat.call(val, d - 1) : val),
            []
          )
        : this.slice();
    };
  }

  if (typeof proto.flatMap !== 'function') {
    proto.flatMap = function flatMap(
      this: any[],
      callback: (value: any, index: number, array: any[]) => any,
      thisArg?: any
    ): any[] {
      return proto.flat.call(this.map(callback, thisArg), 1);
    };
  }
})();
