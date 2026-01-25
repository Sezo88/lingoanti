import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lingoanti.app',
  appName: 'Lingo Master',
  webDir: 'out',
  server: {
    url: 'http://192.168.1.144:3000',
    cleartext: true
  }
};

export default config;
