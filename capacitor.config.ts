import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.prakashbhai.billbuddy',
  appName: 'Prakashbhai Bill Manager',
  webDir: 'dist',
  android: {
    path: undefined,
    backgroundColor: '#ffffff'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#3449be',
      showSpinner: true,
      spinnerColor: '#ffffff'
    },
    Filesystem: {
      iosStorageLocation: 'Documents',
      androidStorageLocation: 'Documents'
    },
    Share: {},
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '491579424292-96mf2l65h34g6ld29qngoc3sf2qe2v73.apps.googleusercontent.com', // Web client ID from Firebase
      forceCodeForRefreshToken: true
    }
  }
};

export default config;