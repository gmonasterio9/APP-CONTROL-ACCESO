import {
  TipoQrPeatonal,
  resolverTipoQr,
} from '../models/ingreso-manual.model';
import {
  EstadoControlPeatonalEscaneo,
  IdentificadorControlIngresoPeatonal,
} from '../models/peatonal-control-ingreso.model';
import { ScanPerfilUtil } from './scan-perfil.util';
import { ValidarPerfilUtil } from './validar-perfil.util';

export type OrigenEscaneoQr = 'cedula' | 'credencial';

export class PeatonalEscaneoUtil {
  private constructor() {}

  static mapEstadoControlIngreso(
    estado: 'autorizado' | 'no_autorizado' | 'manual'
  ): EstadoControlPeatonalEscaneo {
    switch (estado) {
      case 'autorizado':
        return 'EXITOSO';
      case 'manual':
        return 'EXPIRADO';
      default:
        return 'RECHAZADO';
    }
  }

  static resolverIdentificadorControlIngreso(
    codigoEscaneado: string,
    data: {
      persNcorr?: unknown;
      rut?: unknown;
      email?: unknown;
    } = {}
  ): IdentificadorControlIngresoPeatonal | null {
    const persNcorr = ValidarPerfilUtil.normalizarPersNcorr(data.persNcorr);
    if (persNcorr != null) {
      return { persNcorr };
    }

    const rutDesdeDatos = ValidarPerfilUtil.normalizarRut(data.rut);
    if (rutDesdeDatos) {
      return { rut: rutDesdeDatos };
    }

    const codigo = codigoEscaneado.trim();
    const rutDesdeEscaneo = ValidarPerfilUtil.normalizarRut(
      ScanPerfilUtil.extractRutCompletoFromEscaneo(codigo)
    );
    if (rutDesdeEscaneo) {
      return { rut: rutDesdeEscaneo };
    }

    const emailDesdeDatos = ValidarPerfilUtil.normalizarEmail(data.email);
    if (emailDesdeDatos) {
      return { email: emailDesdeDatos };
    }

    if (!codigo) {
      return null;
    }

    const solicitud = ScanPerfilUtil.buildValidarPerfilBody(codigo);

    if ('email' in solicitud) {
      const email = ValidarPerfilUtil.normalizarEmail(solicitud.email);
      if (email) {
        return { email };
      }
    }

    if ('rut' in solicitud) {
      const rut = ValidarPerfilUtil.normalizarRut(solicitud.rut);
      if (rut) {
        return { rut };
      }
    }

    if ('qr' in solicitud) {
      const qr = solicitud.qr.trim();
      if (qr) {
        return { qr };
      }
    }

    return null;
  }

  static resolverTipoQrEscaneo(params: {
    origen: OrigenEscaneoQr;
    escaneoPorEmail?: boolean;
    perfil?: string | null;
    perfilDescripcion?: string | null;
  }): TipoQrPeatonal {
    if (params.escaneoPorEmail) {
      return 'CREDENCIAL_COLABORADOR';
    }

    return resolverTipoQr({
      origen: params.origen,
      perfil: params.perfil,
      perfilDescripcion: params.perfilDescripcion,
    });
  }
}
