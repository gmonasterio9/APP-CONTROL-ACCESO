/**
 * Decodifica QR densos (p.ej. credencial colaborador con logo INACAP al centro).
 * jsQR falla con el frame completo reducido; un recorte centrado + escala suele funcionar.
 */
export type JsQRFn = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: {
    inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst';
  }
) => { data?: string } | null;

type Region = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  outW: number;
  outH: number;
};

export class JsQrDecodeUtil {
  private constructor() {}

  /**
   * Rápido para el botón de captura (no bloquear UI / patente).
   * Solo 2 intentos de recorte centrado.
   */
  static decodeImageDataFast(jsQR: JsQRFn, imageData: ImageData): string | null {
    const { width: w, height: h, data } = imageData;
    if (w < 16 || h < 16) {
      return null;
    }

    const side = Math.min(w, h);
    for (const ratio of [0.55, 0.42]) {
      const crop = Math.max(120, Math.floor(side * ratio));
      const sx = Math.floor((w - crop) / 2);
      const sy = Math.floor((h - crop) / 2);
      const cropped = JsQrDecodeUtil.crop(data, w, h, sx, sy, crop, crop);
      const factor = Math.min(2.5, 700 / crop);
      const scaled =
        factor > 1.05
          ? JsQrDecodeUtil.scaleNearest(cropped.data, crop, crop, factor)
          : cropped;
      const result = jsQR(scaled.data, scaled.w, scaled.h, {
        inversionAttempts: 'attemptBoth',
      });
      const valor = result?.data?.trim();
      if (valor) {
        return valor;
      }
    }
    return null;
  }

  /** Más intentos (foto estática / debug). Evitar en el shutter de patente. */
  static decodeImageData(jsQR: JsQRFn, imageData: ImageData): string | null {
    const fast = JsQrDecodeUtil.decodeImageDataFast(jsQR, imageData);
    if (fast) {
      return fast;
    }

    const { width: w, height: h, data } = imageData;
    const side = Math.min(w, h);
    const crop = Math.max(100, Math.floor(side * 0.7));
    const sx = Math.floor((w - crop) / 2);
    const sy = Math.floor((h - crop) / 2);
    const cropped = JsQrDecodeUtil.crop(data, w, h, sx, sy, crop, crop);
    const result = jsQR(cropped.data, cropped.w, cropped.h, {
      inversionAttempts: 'attemptBoth',
    });
    return result?.data?.trim() || null;
  }

  /**
   * Un intento por frame (rota estrategia). Dos jsQR por frame congelaban Lenovo.
   */
  static decodeVideoFrame(
    jsQR: JsQRFn,
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    modo: number
  ): string | null {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw < 16 || vh < 16) {
      return null;
    }

    const region = JsQrDecodeUtil.regionForMode(vw, vh, modo);
    canvas.width = region.outW;
    canvas.height = region.outH;
    ctx.drawImage(
      video,
      region.sx,
      region.sy,
      region.sw,
      region.sh,
      0,
      0,
      region.outW,
      region.outH
    );
    const imageData = ctx.getImageData(0, 0, region.outW, region.outH);
    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });
    return result?.data?.trim() || null;
  }

  private static regionForMode(vw: number, vh: number, modo: number): Region {
    const side = Math.min(vw, vh);
    const cycle = ((modo % 4) + 4) % 4;

    if (cycle === 0) {
      // Logo INACAP / vCard denso (prioridad).
      const crop = Math.max(140, Math.floor(side * 0.5));
      const out = Math.min(800, Math.max(560, Math.floor(crop * 2.5)));
      return {
        sx: Math.floor((vw - crop) / 2),
        sy: Math.floor((vh - crop) / 2),
        sw: crop,
        sh: crop,
        outW: out,
        outH: out,
      };
    }

    if (cycle === 1) {
      const crop = Math.max(160, Math.floor(side * 0.6));
      const out = Math.min(720, Math.max(480, Math.floor(crop * 1.8)));
      return {
        sx: Math.floor((vw - crop) / 2),
        sy: Math.floor((vh - crop) / 2),
        sw: crop,
        sh: crop,
        outW: out,
        outH: out,
      };
    }

    if (cycle === 2) {
      const crop = Math.max(120, Math.floor(side * 0.4));
      const out = Math.min(840, Math.max(560, Math.floor(crop * 2.6)));
      return {
        sx: Math.floor((vw - crop) / 2),
        sy: Math.floor((vh - crop) / 2),
        sw: crop,
        sh: crop,
        outW: out,
        outH: out,
      };
    }

    const maxW = 800;
    const scale = Math.min(1, maxW / vw);
    return {
      sx: 0,
      sy: 0,
      sw: vw,
      sh: vh,
      outW: Math.max(1, Math.floor(vw * scale)),
      outH: Math.max(1, Math.floor(vh * scale)),
    };
  }

  private static crop(
    src: Uint8ClampedArray,
    sw: number,
    _sh: number,
    sx: number,
    sy: number,
    cw: number,
    ch: number
  ): { data: Uint8ClampedArray; w: number; h: number } {
    const out = new Uint8ClampedArray(cw * ch * 4);
    for (let y = 0; y < ch; y++) {
      const srcRow = ((sy + y) * sw + sx) * 4;
      const dstRow = y * cw * 4;
      out.set(src.subarray(srcRow, srcRow + cw * 4), dstRow);
    }
    return { data: out, w: cw, h: ch };
  }

  private static scaleNearest(
    src: Uint8ClampedArray,
    w: number,
    h: number,
    factor: number
  ): { data: Uint8ClampedArray; w: number; h: number } {
    const nw = Math.max(1, Math.floor(w * factor));
    const nh = Math.max(1, Math.floor(h * factor));
    const out = new Uint8ClampedArray(nw * nh * 4);
    for (let y = 0; y < nh; y++) {
      const sy = Math.min(h - 1, Math.floor(y / factor));
      for (let x = 0; x < nw; x++) {
        const sx = Math.min(w - 1, Math.floor(x / factor));
        const si = (sy * w + sx) * 4;
        const di = (y * nw + x) * 4;
        out[di] = src[si];
        out[di + 1] = src[si + 1];
        out[di + 2] = src[si + 2];
        out[di + 3] = 255;
      }
    }
    return { data: out, w: nw, h: nh };
  }
}
