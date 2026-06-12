import { environmentSecrets } from './environment.secrets';

export const environment = {
  production: false,
  name: 'local',
  apiUrl: '/api/v1',
  keyCrypt: environmentSecrets.keyCrypt,
};
