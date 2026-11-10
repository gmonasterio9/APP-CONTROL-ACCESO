import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'Control Acceso',
  webDir: 'www',
  android: {
    // Diagnóstico en Lenovo X705 (pantalla blanca / WebView viejo).
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
