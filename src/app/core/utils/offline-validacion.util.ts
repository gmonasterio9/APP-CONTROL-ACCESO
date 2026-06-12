import {
  OfflineCatalogoAccesoView,
  OfflinePersonaCatalogo,
} from '../models/offline-catalogo.model';
import { ValidarPatenteResponse } from '../models/validar-patente.model';
import { ValidarPerfilResponse } from '../models/validar-perfil.model';
import { QrCredencialParseada } from '../services/qr-offline.service';
import { PatenteUtil } from './patente.util';
import { ScanPerfilUtil } from './scan-perfil.util';
import { ValidarPerfilUtil } from './validar-perfil.util';

export class OfflineValidacionUtil {
  private constructor() {}

  static tieneCatalogoValidacion(
    catalogo: OfflineCatalogoAccesoView | null | undefined
  ): boolean {
    return (
      (catalogo?.personas?.length ?? 0) > 0 ||
      (catalogo?.patentes?.length ?? 0) > 0
    );
  }

  static validarPerfilDesdeEscaneo(
    catalogo: OfflineCatalogoAccesoView,
    input: {
      codigoEscaneado?: string | null;
      rut?: string | null;
      email?: string | null;
    },
    parseQrApp: (qr: string) => QrCredencialParseada
  ): ValidarPerfilResponse {
    const codigo = input.codigoEscaneado?.trim() ?? '';
    if (codigo && ScanPerfilUtil.isCredencialVirtualQr(codigo)) {
      return OfflineValidacionUtil.validarQrApp(
        catalogo,
        codigo,
        parseQrApp(codigo)
      );
    }

    return OfflineValidacionUtil.validarPerfil(catalogo, input);
  }

  static validarQrApp(
    catalogo: OfflineCatalogoAccesoView,
    qr: string,
    parsed: QrCredencialParseada
  ): ValidarPerfilResponse {
    if (!parsed.tokenValido) {
      return {
        success: false,
        code: 'rechazado',
        ingresarManual: true,
        message: 'Código QR inválido.',
      };
    }

    if (parsed.credencialExpirada) {
      return {
        success: false,
        code: 'expirado',
        credencialExpirada: true,
        persNcorr: parsed.persNcorr > 0 ? parsed.persNcorr : undefined,
        ingresarManual: true,
        message:
          'Código expirado. Solicitar credencial desde la APP INACAP.',
      };
    }

    const persona = catalogo.personas?.find(p => p.persNcorr === parsed.persNcorr);

    if (!persona) {
      return {
        success: false,
        code: 'visita',
        persNcorr: parsed.persNcorr,
        ingresarManual: true,
        message:
          'Persona no encontrada en el catálogo. Debe ingresar como visita.',
      };
    }

    return OfflineValidacionUtil.respuestaPerfilDesdePersona(persona, {
      codigoCredencial: qr,
    });
  }

  static validarPerfil(
    catalogo: OfflineCatalogoAccesoView,
    input: {
      rut?: string | null;
      email?: string | null;
    }
  ): ValidarPerfilResponse {
    const rut = ValidarPerfilUtil.normalizarRut(input.rut);
    const email = ValidarPerfilUtil.normalizarEmail(input.email);

    if (rut) {
      const persona = OfflineValidacionUtil.buscarPersonaPorRut(catalogo, rut);
      if (persona) {
        return OfflineValidacionUtil.respuestaPerfilDesdePersona(persona);
      }

      return {
        success: false,
        code: 'no_encontrado',
        rut,
        message:
          'Persona no encontrada en el catálogo. Debe ingresar de forma manual.',
        ingresarManual: true,
      };
    }

    if (email) {
      const persona = OfflineValidacionUtil.buscarPersonaPorEmail(catalogo, email);
      if (persona) {
        return OfflineValidacionUtil.respuestaPerfilDesdePersona(persona);
      }

      return {
        success: false,
        code: 'no_encontrado',
        email,
        message:
          'Colaborador no encontrado en el catálogo. Debe ingresar de forma manual.',
        ingresarManual: true,
      };
    }

    return {
      success: false,
      message:
        'Escanea cédula de identidad, credencial de colaborador o ingresa manualmente.',
      ingresarManual: true,
    };
  }

  static validarPatente(
    catalogo: OfflineCatalogoAccesoView,
    patenteRaw: string
  ): ValidarPatenteResponse {
    const patente = PatenteUtil.toApi(patenteRaw).toUpperCase();

    if (!PatenteUtil.isFormatValidAutoOMoto(patente)) {
      return {
        success: false,
        valida: false,
        patente,
        message: 'Patente inválida.',
      };
    }

    const registro = catalogo.patentes?.find(
      p => PatenteUtil.toApi(p.patente).toUpperCase() === patente
    );

    if (!registro) {
      return {
        success: false,
        valida: false,
        ingresarComoVisita: true,
        patente,
        message:
          'Patente no encontrada en el catálogo. Debe ingresarla como visita.',
      };
    }

    const persona = catalogo.personas?.find(p => p.persNcorr === registro.persNcorr);
    const accesoVehicular = persona?.accesoVehicular ?? true;

    if (!accesoVehicular) {
      return {
        success: false,
        valida: false,
        ingresarComoVisita: true,
        patente: registro.patente,
        nombreCompleto: registro.nombreCompleto,
        persNcorr: registro.persNcorr,
        perfil: registro.aepeNcorr,
        perfilDescripcion: registro.tipoPersona,
        message: 'Sin acceso vehicular.',
      };
    }

    return {
      success: true,
      valida: true,
      patente: registro.patente,
      nombreCompleto: registro.nombreCompleto,
      persNcorr: registro.persNcorr,
      perfil: registro.aepeNcorr,
      perfilDescripcion: registro.tipoPersona,
      tipoAcceso: registro.tipoVehiculo,
    };
  }

  private static buscarPersonaPorRut(
    catalogo: OfflineCatalogoAccesoView,
    rut: string
  ): OfflinePersonaCatalogo | undefined {
    return catalogo.personas?.find(
      p => ValidarPerfilUtil.normalizarRut(p.rut) === rut
    );
  }

  private static buscarPersonaPorEmail(
    catalogo: OfflineCatalogoAccesoView,
    email: string
  ): OfflinePersonaCatalogo | undefined {
    const objetivo = email.toLowerCase();
    return catalogo.personas?.find(p => {
      const normalizado = OfflineValidacionUtil.emailDesdePersona(p);
      return normalizado?.toLowerCase() === objetivo;
    });
  }

  private static emailDesdePersona(
    persona: OfflinePersonaCatalogo
  ): string | undefined {
    return ValidarPerfilUtil.normalizarEmail(persona.emailInacap);
  }

  private static respuestaPerfilDesdePersona(
    persona: OfflinePersonaCatalogo,
    extras?: { codigoCredencial?: string }
  ): ValidarPerfilResponse {
    const base = {
      perfil: persona.perfil,
      perfilDescripcion: persona.perfilDescripcion,
      rut: persona.rut,
      email: OfflineValidacionUtil.emailDesdePersona(persona) ?? null,
      nombreCompleto: persona.nombreCompleto,
      persNcorr: persona.persNcorr,
      codigoCredencial: extras?.codigoCredencial,
    };

    if (!persona.accesoPeatonal) {
      return {
        ...base,
        success: false,
        code: 'visita',
        ingresarManual: true,
        message: `Sin acceso peatonal (${persona.perfilDescripcion}). Debe ingresar de forma manual.`,
      };
    }

    return {
      ...base,
      success: true,
      messages: ['Acceso Autorizado'],
    };
  }
}
