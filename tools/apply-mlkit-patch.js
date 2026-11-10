#!/usr/bin/env node
/**
 * Copia el helper parcheado (vCard CONTACT_INFO sin NPE) al plugin Capawesome.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(__dirname, 'patches', 'BarcodeScannerHelper.java');
const dest = path.join(
  root,
  'node_modules',
  '@capacitor-mlkit',
  'barcode-scanning',
  'android',
  'src',
  'main',
  'java',
  'io',
  'capawesome',
  'capacitorjs',
  'plugins',
  'mlkit',
  'barcodescanning',
  'BarcodeScannerHelper.java'
);

if (!fs.existsSync(src)) {
  console.warn('[mlkit-patch] no existe tools/patches/BarcodeScannerHelper.java');
  process.exit(0);
}
if (!fs.existsSync(path.dirname(dest))) {
  console.warn('[mlkit-patch] plugin no instalado, se omite');
  process.exit(0);
}
fs.copyFileSync(src, dest);
console.log('[mlkit-patch] BarcodeScannerHelper.java aplicado');
