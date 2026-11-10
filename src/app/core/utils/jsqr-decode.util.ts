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

  /** Intenta varias regiones/escalas sobre un ImageData ya capturado. */
  static decodeImageData(jsQR: JsQRFn, imageData: ImageData): string | null {
    const { width: w, height: h, data } = imageData;
    if (w < 16 || h < 16) {
      return null;
    }

    const intentos: Array<{ data: Uint8ClampedArray; w: number; h: number }> = [
      { data, w, h },
    ];

    for (const ratio of [0.7, 0.55, 0.45]) {
      const side = Math.floor(Math.min(w, h) * ratio);
      if (side < 80) {
        continue;
      }
      const sx = Math.floor((w - side) / 2);
      const sy = Math.floor((h - side) / 2);
      intentos.push(JsQrDecodeUtil.crop(data, w, h, sx, sy, side, side));
      // Credenciales con logo: upscale del recorte ayuda a jsQR.
      if (side < 700) {
        const factor = Math.min(2.5, 700 / side);
        intentos.push(
          JsQrDecodeUtil.scaleNearest(
            JsQrDecodeUtil.crop(data, w, h, sx, sy, side, side).data,
            side,
            side,
            factor
          )
        );
      }
    }

    for (const intento of intentos) {
      const result = jsQR(intento.data, intento.w, intento.h, {
        inversionAttempts: 'attemptBoth',
      });
      const valor = result?.data?.trim();
      if (valor) {
        return valor;
      }
    }
    return null;
  }

  /**
   * Decodifica un frame de video dibujando una región en canvas.
   * `modo` rota estrategias entre frames para no saturar tablets lentas.
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
    const cycle = ((modo % 3) + 3) % 3;

    if (cycle === 0) {
      // Recorte central ~60%: caso típico de credencial en el marco.
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

    if (cycle === 1) {
      // Recorte más cerrado + más upscale (QR denso con logo).
      const crop = Math.max(140, Math.floor(side * 0.48));
      const out = Math.min(800, Math.max(560, Math.floor(crop * 2.4)));
      return {
        sx: Math.floor((vw - crop) / 2),
        sy: Math.floor((vh - crop) / 2),
        sw: crop,
        sh: crop,
        outW: out,
        outH: out,
      };
    }

    // Frame completo a resolución moderada.
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
    sh: number,
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
