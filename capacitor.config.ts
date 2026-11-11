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
    // false: XHR/fetch van por WebView (Chromium). OkHttp nativo rechaza la
    // cadena Sectigo→AAA Certificate Services de siga.inacap.cl (SSLHandshakeException).
    CapacitorHttp: {
      enabled: false,
    },
  },
};

export default config;
