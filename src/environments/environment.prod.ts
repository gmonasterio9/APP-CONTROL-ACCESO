import { environmentSecrets } from './environment.secrets';

export const environment = {
  production: true,
  name: 'prod',
  apiUrl: '/api/v1',
  nativeApiUrl: 'https://siga.inacap.cl/Inacap.Api.ControlAcceso.V2/api/v1',
  keyCrypt: environmentSecrets.keyCrypt,
};
