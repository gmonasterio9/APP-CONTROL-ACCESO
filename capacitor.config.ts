import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cl.inacap.control.acceso',
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
