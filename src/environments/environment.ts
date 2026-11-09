import { environmentSecrets } from './environment.secrets';

export const environment = {
  production: false,
  name: 'local',
  apiUrl: '/api/v1',
  keyCrypt: environmentSecrets.keyCrypt,
  appVersion: '1.0',
  /** Rama tablet: solo acceso peatonal, modal informativo. */
  tabletPeatonal: true,
};
