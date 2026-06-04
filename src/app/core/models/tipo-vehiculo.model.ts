/** Solo tipos de vehículo del API (detalle[].tipoVehiculo). */
export type CupoVehiculoIcono = 'auto' | 'moto' | 'bicicleta';

export type TipoVehiculoApi = 'auto' | 'moto' | 'bicicleta';

export const TIPO_VEHICULO_API_A_ICONO: Record<TipoVehiculoApi, CupoVehiculoIcono> = {
  auto: 'auto',
  moto: 'moto',
  bicicleta: 'bicicleta',
};

function normalizarClave(valor?: string): string {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function iconoPorTipoVehiculo(tipoVehiculo: string): CupoVehiculoIcono {
  const clave = normalizarClave(tipoVehiculo);

  if (clave in TIPO_VEHICULO_API_A_ICONO) {
    return TIPO_VEHICULO_API_A_ICONO[clave as TipoVehiculoApi];
  }

  if (clave.includes('bici')) {
    return 'bicicleta';
  }
  if (clave.includes('moto')) {
    return 'moto';
  }
  if (clave.includes('automov') || clave.includes('auto')) {
    return 'auto';
  }

  return 'auto';
}
