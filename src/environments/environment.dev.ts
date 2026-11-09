import { environmentSecrets } from './environment.secrets';

export const environment = {
  production: false,
  name: 'dev',
  apiUrl: '/api/v1',
  nativeApiUrl: 'https://siga.desa.inacap.cl/Inacap.Api.ControlAcceso.V2/api/v1',
  keyCrypt: environmentSecrets.keyCrypt,
};
