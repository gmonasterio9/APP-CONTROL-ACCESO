import {
  CategoriaTipo,
  CupoCategoriaView,
  EstacionamientoDisponibilidadView,
  VehiculoActivoView,
} from '../models/estacionamiento-disponibilidad.model';
import { TipoPersonaIngreso } from '../models/ingreso-manual.model';
import {
  OfflineCatalogoAccesoView,
  OfflinePatenteCatalogo,
  OfflinePersonaCatalogo,
} from '../models/offline-catalogo.model';
import { normalizarPathCola } from '../models/offline-cola.model';
import { iconoPorTipoVehiculo } from '../models/tipo-vehiculo.model';
import { PatenteUtil } from './patente.util';
import { RutUtil } from './rut.util';

function normalizarClave(valor?: string): string {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function resolverCategoriaDesdePersona(
  persona?: OfflinePersonaCatalogo | null
): CategoriaTipo {
  if (!persona) {
    return 'visita';
  }

  const perfil = persona.perfil;
  if (perfil === 2) {
    return 'docente';
  }
  if (perfil === 3) {
    return 'colaborador';
  }
  if (perfil === 4) {
    return 'visita';
  }

  const texto = normalizarClave(persona.perfilDescripcion);
  if (texto.includes('docent')) {
    return 'docente';
  }
  if (texto.includes('colabor')) {
    return 'colaborador';
  }
  if (texto.includes('visit')) {
    return 'visita';
  }

  return 'estudiante';
}

function resolverCategoriaDesdeTexto(valor?: string | null): CategoriaTipo {
  const texto = normalizarClave(valor ?? undefined);
  if (texto.includes('docent')) {
    return 'docente';
  }
  if (texto.includes('colabor')) {
    return 'colaborador';
  }
  if (texto.includes('visit')) {
    return 'visita';
  }
  return 'estudiante';
}

function resolverIconoDesdeMedio(medio?: string | null) {
  return iconoPorTipoVehiculo(String(medio ?? 'auto'));
}

function horaIngresoActual(): string {
  return new Date().toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function etiquetaTipoPersona(categoria: CategoriaTipo): string {
  const etiquetas: Record<CategoriaTipo, string> = {
    estudiante: 'Estudiante',
    docente: 'Docente',
    colaborador: 'Colaborador',
    visita: 'Visita',
  };
  return etiquetas[categoria];
}

function construirVehiculoActivoIngreso(
  catalogo: OfflineCatalogoAccesoView,
  body: Record<string, unknown>
): VehiculoActivoView | null {
  const patenteRaw = String(body['patente'] ?? '').trim();
  if (!patenteRaw) {
    return null;
  }

  const patente = PatenteUtil.toApi(patenteRaw).toUpperCase();
  const registroPatente = buscarPatente(catalogo, patente);
  const persNcorr =
    (body['persNcorr'] as number | undefined) ?? registroPatente?.persNcorr;
  const persona = buscarPersona(catalogo, persNcorr);

  const categoria = body['tipoPersona']
    ? resolverCategoriaDesdeTexto(String(body['tipoPersona']))
    : registroPatente?.tipoPersona
      ? resolverCategoriaDesdeTexto(registroPatente.tipoPersona)
      : resolverCategoriaDesdePersona(persona);

  const tipoMedio = body['tipoMedio'] as string | undefined;
  const tipoVehiculo = tipoMedio
    ? String(tipoMedio)
    : registroPatente?.tipoVehiculo ?? 'auto';

  const nombre =
    String(body['nombre'] ?? '').trim() ||
    registroPatente?.nombreCompleto ||
    persona?.nombreCompleto ||
    '—';

  const rutRaw =
    String(body['rut'] ?? '').trim() ||
    registroPatente?.rut ||
    persona?.rut ||
    '';

  return {
    patente,
    nombre,
    rut: rutRaw ? RutUtil.formatDisplay(RutUtil.normalizeManual(rutRaw)) : '—',
    tipo: etiquetaTipoPersona(categoria),
    vehiculo: tipoVehiculo,
    horaIngreso: horaIngresoActual(),
  };
}

function agregarVehiculoActivoOffline(
  catalogo: OfflineCatalogoAccesoView,
  acreNcorr: number,
  vehiculo: VehiculoActivoView
): void {
  const detalles = catalogo.estacionamientosDetalle;
  if (!detalles) {
    return;
  }

  for (const detalle of Object.values(detalles)) {
    if (detalle.aeseNcorr !== acreNcorr || !detalle.vehiculosActivos) {
      continue;
    }

    const patenteNormalizada = vehiculo.patente.toUpperCase();
    const yaExiste = detalle.vehiculosActivos.vehiculos.some(
      item => item.patente.toUpperCase() === patenteNormalizada
    );
    if (yaExiste) {
      continue;
    }

    detalle.vehiculosActivos.vehiculos = [
      vehiculo,
      ...detalle.vehiculosActivos.vehiculos,
    ];
    detalle.vehiculosActivos.paginacion.totalRegistros += 1;
  }
}

function buscarPatente(
  catalogo: OfflineCatalogoAccesoView,
  patenteRaw?: string | null
): OfflinePatenteCatalogo | undefined {
  const patente = PatenteUtil.toApi(String(patenteRaw ?? '')).toUpperCase();
  if (!patente) {
    return undefined;
  }

  return catalogo.patentes?.find(
    item => PatenteUtil.toApi(item.patente).toUpperCase() === patente
  );
}

function buscarPersona(
  catalogo: OfflineCatalogoAccesoView,
  persNcorr?: number | null
): OfflinePersonaCatalogo | undefined {
  if (persNcorr == null || persNcorr <= 0) {
    return undefined;
  }

  return catalogo.personas?.find(item => item.persNcorr === persNcorr);
}

function matcherCupoPorTrackId(
  aepeNcorr?: number,
  aeveNcorr?: number
): ((cupo: CupoCategoriaView) => boolean) | null {
  if (aepeNcorr == null || aeveNcorr == null) {
    return null;
  }

  const trackId = `${aepeNcorr}-${aeveNcorr}`;
  return cupo => cupo.trackId === trackId;
}

function matcherCupoPorCategoria(
  categoria: CategoriaTipo,
  icono = resolverIconoDesdeMedio('auto')
): (cupo: CupoCategoriaView) => boolean {
  return cupo => cupo.categoria === categoria && cupo.icono === icono;
}

function ajustarDisponibilidad(
  disponibilidad: EstacionamientoDisponibilidadView,
  matcher: (cupo: CupoCategoriaView) => boolean,
  delta: 1 | -1
): void {
  const cupo = disponibilidad.cupos.find(matcher);
  if (cupo) {
    if (delta < 0) {
      cupo.disponibles = Math.max(0, cupo.disponibles - 1);
    } else {
      cupo.disponibles = Math.min(cupo.total, cupo.disponibles + 1);
    }
  }

  if (delta < 0) {
    disponibilidad.totales.disponibles = Math.max(
      0,
      disponibilidad.totales.disponibles - 1
    );
    disponibilidad.totales.ocupados += 1;
  } else {
    disponibilidad.totales.disponibles = Math.min(
      disponibilidad.totales.cupos,
      disponibilidad.totales.disponibles + 1
    );
    disponibilidad.totales.ocupados = Math.max(
      0,
      disponibilidad.totales.ocupados - 1
    );
  }
}

function ajustarCuposEstacionamiento(
  catalogo: OfflineCatalogoAccesoView,
  acreNcorr: number,
  delta: 1 | -1
): void {
  const estacionamiento = catalogo.estacionamientos?.find(item => item.id === acreNcorr);
  if (!estacionamiento) {
    return;
  }

  if (delta < 0) {
    estacionamiento.cuposDisponibles = Math.max(
      0,
      estacionamiento.cuposDisponibles - 1
    );
  } else {
    estacionamiento.cuposDisponibles = Math.min(
      estacionamiento.cuposTotales,
      estacionamiento.cuposDisponibles + 1
    );
  }
}

function ajustarDetalleEstacionamiento(
  catalogo: OfflineCatalogoAccesoView,
  acreNcorr: number,
  matcher: (cupo: CupoCategoriaView) => boolean,
  delta: 1 | -1
): void {
  const detalles = catalogo.estacionamientosDetalle;
  if (!detalles) {
    return;
  }

  for (const detalle of Object.values(detalles)) {
    if (detalle.aeseNcorr !== acreNcorr || !detalle.disponibilidad) {
      continue;
    }

    ajustarDisponibilidad(detalle.disponibilidad, matcher, delta);
  }
}

function resolverMatcherIngresoVehicular(
  catalogo: OfflineCatalogoAccesoView,
  params: {
    patente?: string | null;
    persNcorr?: number | null;
    tipoPersona?: TipoPersonaIngreso | string | null;
    tipoMedio?: string | null;
    tipoVehiculo?: string | null;
  }
): (cupo: CupoCategoriaView) => boolean {
  const registroPatente = buscarPatente(catalogo, params.patente);
  const porTrackId = matcherCupoPorTrackId(
    registroPatente?.aepeNcorr,
    registroPatente?.aeveNcorr
  );
  if (porTrackId) {
    return porTrackId;
  }

  const persona =
    buscarPersona(catalogo, params.persNcorr) ??
  (registroPatente
    ? buscarPersona(catalogo, registroPatente.persNcorr)
    : undefined);

  const categoria = params.tipoPersona
    ? resolverCategoriaDesdeTexto(String(params.tipoPersona))
    : registroPatente?.tipoPersona
      ? resolverCategoriaDesdeTexto(registroPatente.tipoPersona)
      : resolverCategoriaDesdePersona(persona);

  const icono = params.tipoMedio
    ? resolverIconoDesdeMedio(params.tipoMedio)
    : iconoPorTipoVehiculo(
        params.tipoVehiculo ?? registroPatente?.tipoVehiculo ?? 'auto'
      );

  return matcherCupoPorCategoria(categoria, icono);
}

function clonarDetalleEstacionamientos(
  detalles: NonNullable<OfflineCatalogoAccesoView['estacionamientosDetalle']>
): NonNullable<OfflineCatalogoAccesoView['estacionamientosDetalle']> {
  const copia: NonNullable<OfflineCatalogoAccesoView['estacionamientosDetalle']> = {};

  for (const key of Object.keys(detalles)) {
    const detalle = detalles[Number(key)];
    copia[Number(key)] = {
      ...detalle,
      disponibilidad: detalle.disponibilidad
        ? {
            ...detalle.disponibilidad,
            totales: { ...detalle.disponibilidad.totales },
            cupos: detalle.disponibilidad.cupos.map(cupo => ({ ...cupo })),
          }
        : undefined,
      vehiculosActivos: detalle.vehiculosActivos
        ? {
            ...detalle.vehiculosActivos,
            paginacion: { ...detalle.vehiculosActivos.paginacion },
            vehiculos: [...detalle.vehiculosActivos.vehiculos],
          }
        : undefined,
    };
  }

  return copia;
}

function aplicarIngresoVehicular(
  catalogo: OfflineCatalogoAccesoView,
  body: Record<string, unknown>
): void {
  const acreNcorrBody = Number(body['acreNcorr']);
  const acreNcorr =
    Number.isFinite(acreNcorrBody) && acreNcorrBody > 0
      ? acreNcorrBody
      : catalogo.acreNcorr ?? 0;

  if (acreNcorr <= 0) {
    return;
  }

  const matcher = resolverMatcherIngresoVehicular(catalogo, {
    patente: body['patente'] as string | undefined,
    persNcorr: body['persNcorr'] as number | undefined,
    tipoPersona: body['tipoPersona'] as TipoPersonaIngreso | undefined,
    tipoMedio: body['tipoMedio'] as string | undefined,
  });

  ajustarCuposEstacionamiento(catalogo, acreNcorr, -1);
  ajustarDetalleEstacionamiento(catalogo, acreNcorr, matcher, -1);

  const vehiculo = construirVehiculoActivoIngreso(catalogo, body);
  if (vehiculo) {
    agregarVehiculoActivoOffline(catalogo, acreNcorr, vehiculo);
  }
}

function aplicarSalidaVehicular(
  catalogo: OfflineCatalogoAccesoView,
  body: Record<string, unknown>
): void {
  const patente = String(body['patente'] ?? '').trim();
  if (!patente) {
    return;
  }

  const acreNcorr = catalogo.acreNcorr;
  if (acreNcorr == null || acreNcorr <= 0) {
    return;
  }

  const matcher = resolverMatcherIngresoVehicular(catalogo, { patente });
  ajustarCuposEstacionamiento(catalogo, acreNcorr, 1);
  ajustarDetalleEstacionamiento(catalogo, acreNcorr, matcher, 1);

  const detalles = catalogo.estacionamientosDetalle;
  if (!detalles) {
    return;
  }

  const patenteNormalizada = PatenteUtil.toApi(patente).toUpperCase();
  for (const detalle of Object.values(detalles)) {
    if (detalle.aeseNcorr !== acreNcorr || !detalle.vehiculosActivos) {
      continue;
    }

    detalle.vehiculosActivos.vehiculos =
      detalle.vehiculosActivos.vehiculos.filter(
        vehiculo => vehiculo.patente.toUpperCase() !== patenteNormalizada
      );
    detalle.vehiculosActivos.paginacion.totalRegistros = Math.max(
      0,
      detalle.vehiculosActivos.paginacion.totalRegistros - 1
    );
  }
}

function incrementarStatPeatonal(
  catalogo: OfflineCatalogoAccesoView,
  label: 'Autorizados' | 'Visitas' | 'Ingreso Manual'
): void {
  const stat = catalogo.resumenPeatonal?.stats.find(item => item.label === label);
  if (stat) {
    stat.valor += 1;
  }
}

export function aplicarAjusteCatalogoOffline(
  catalogo: OfflineCatalogoAccesoView,
  path: string,
  body: unknown
): OfflineCatalogoAccesoView {
  const ruta = normalizarPathCola(path);
  const payload = (body ?? {}) as Record<string, unknown>;
  const actualizado: OfflineCatalogoAccesoView = {
    ...catalogo,
    estacionamientos: catalogo.estacionamientos
      ? catalogo.estacionamientos.map(item => ({ ...item }))
      : undefined,
    estacionamientosDetalle: catalogo.estacionamientosDetalle
      ? clonarDetalleEstacionamientos(catalogo.estacionamientosDetalle)
      : undefined,
    resumenPeatonal: catalogo.resumenPeatonal
      ? {
          ...catalogo.resumenPeatonal,
          stats: catalogo.resumenPeatonal.stats.map(stat => ({ ...stat })),
        }
      : undefined,
  };

  if (ruta === '/estacionamiento/ingreso' || ruta === '/ingreso-manual-vehiculos') {
    aplicarIngresoVehicular(actualizado, payload);
    return actualizado;
  }

  if (ruta === '/estacionamiento/salida') {
    aplicarSalidaVehicular(actualizado, payload);
    return actualizado;
  }

  if (ruta === '/ingreso-manual-peatonal') {
    incrementarStatPeatonal(actualizado, 'Ingreso Manual');
    return actualizado;
  }

  if (ruta === '/peatonal/control-ingreso') {
    const estado = String(payload['estado'] ?? '').trim().toUpperCase();
    if (estado === 'EXITOSO') {
      incrementarStatPeatonal(actualizado, 'Autorizados');
    } else if (estado === 'RECHAZADO') {
      incrementarStatPeatonal(actualizado, 'Visitas');
    }
    return actualizado;
  }

  return actualizado;
}
