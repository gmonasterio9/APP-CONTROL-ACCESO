import { Sede } from './sede.model';

/** Catálogo local para mostrar sedes de inmediato en la primera instalación. */
export const SEDES_DEFAULT: Sede[] = [
  { id: 18, nombre: 'Arica' },
  { id: 26, nombre: 'Iquique' },
  { id: 15, nombre: 'Calama' },
  { id: 10, nombre: 'Antofagasta' },
  { id: 19, nombre: 'Copiapó' },
  { id: 11, nombre: 'La Serena' },
  { id: 13, nombre: 'Valparaíso' },
  { id: 7, nombre: 'Apoquindo' },
  { id: 41, nombre: 'Santiago Sur' },
  { id: 6, nombre: 'Renca' },
  { id: 2, nombre: 'Santiago Centro' },
  { id: 5, nombre: 'Maipú' },
  { id: 40, nombre: 'Ñuñoa (Ex Pérez Rosales)' },
  { id: 43, nombre: 'Puente Alto' },
  { id: 46, nombre: 'La Granja' },
  { id: 17, nombre: 'Rancagua' },
  { id: 34, nombre: 'Curicó' },
  { id: 29, nombre: 'Talca' },
  { id: 20, nombre: 'Chillán' },
  { id: 45, nombre: 'San Pedro De La Paz' },
  { id: 32, nombre: 'Concepción - Talcahuano' },
  { id: 30, nombre: 'Los Ángeles' },
  { id: 8, nombre: 'Temuco' },
  { id: 21, nombre: 'Valdivia' },
  { id: 22, nombre: 'Osorno' },
  { id: 23, nombre: 'Puerto Montt' },
  { id: 24, nombre: 'Coyhaique' },
  { id: 25, nombre: 'Punta Arenas' },
];

export function mergeSedes(base: Sede[], incoming: Sede[]): Sede[] {
  const byId = new Map<number, Sede>();

  for (const sede of base) {
    if (!sede?.id) {
      continue;
    }
    byId.set(sede.id, { id: sede.id, nombre: sede.nombre });
  }

  const nuevas: Sede[] = [];
  for (const sede of incoming) {
    if (!sede?.id) {
      continue;
    }

    const actual = byId.get(sede.id);
    if (actual) {
      byId.set(sede.id, {
        id: sede.id,
        nombre: sede.nombre?.trim() || actual.nombre,
      });
      continue;
    }

    const agregada = { id: sede.id, nombre: sede.nombre };
    byId.set(sede.id, agregada);
    nuevas.push(agregada);
  }

  const resultado: Sede[] = [];
  const vistos = new Set<number>();

  for (const sede of base) {
    if (!sede?.id || vistos.has(sede.id)) {
      continue;
    }
    resultado.push(byId.get(sede.id)!);
    vistos.add(sede.id);
  }

  for (const sede of nuevas) {
    if (vistos.has(sede.id)) {
      continue;
    }
    resultado.push(byId.get(sede.id)!);
    vistos.add(sede.id);
  }

  return resultado;
}
