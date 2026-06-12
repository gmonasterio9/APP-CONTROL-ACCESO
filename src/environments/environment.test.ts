import { environmentSecrets } from './environment.secrets';

export const environment = {
  production: false,
  name: 'test',
  apiUrl: 'https://siga.test.inacap.cl/Inacap.Api.ControlAcceso.V2/api/v1',
  keyCrypt: environmentSecrets.keyCrypt,
};
