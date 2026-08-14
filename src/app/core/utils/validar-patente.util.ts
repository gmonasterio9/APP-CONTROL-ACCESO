import { ValidarPatenteResponse } from '../models/validar-patente.model';
import { ApiHttpError } from '../services/api-http.service';
import { ValidarPerfilUtil } from './validar-perfil.util';

export class ValidarPatenteUtil {
  private constructor() {}

  static esAutorizada(res: ValidarPatenteResponse): boolean {
    if (res.valida === false || res.ingresarComoVisita === true) {
      return false;
    }

    if (res.valida === true) {
      return true;
    }

    return res.success === true;
  }

  static esPendienteSalida(res: ValidarPatenteResponse): boolean {
    if (
      res.ingresoActivo === true ||
      res.dentro === true ||
      res.salidaPendiente === true
    ) {
      return true;
    }

    const code = String(res.code ?? '').toLowerCase();
    if (
      code === 'salida' ||
      code === 'ingreso_activo' ||
      code === 'dentro'
    ) {
      return true;
    }

    const texto = [res.message, ...(res.messages ?? [])]
      .join(' ')
      .toLowerCase();
    return /marcar la salida|ya se encuentra|ya ingres[oó]|ya est[aá]|ingreso activo|dentro del estacionamiento/.test(
      texto
    );
  }

  static extraerTituloYMensaje(
    res: ValidarPatenteResponse
  ): { titulo?: string; mensaje?: string } {
    if (res.messages?.length) {
      return ValidarPerfilUtil.extraerTituloYMensajeDesdeMessages(res.messages);
    }

    return { mensaje: res.message };
  }

  static extraerResponse(source: unknown): ValidarPatenteResponse | null {
    const apiErr = source as ApiHttpError;
    const body = apiErr?.error ?? source;

    if (!body || typeof body !== 'object') {
      return null;
    }

    const res = body as ValidarPatenteResponse;
    if (
      'success' in res ||
      'valida' in res ||
      'ingresarComoVisita' in res ||
      'patente' in res
    ) {
      return res;
    }

    return null;
  }
}
