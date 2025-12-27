/**
 * Environment configuration management
 * Handles environment variables and configuration validation
 */

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

interface AppConfig {
  version: string;
  environment: 'development' | 'production' | 'test';
  firebase: FirebaseConfig;
  sentry?: {
    dsn: string;
  };
  features: {
    enableSentry: boolean;
    enableAnalytics: boolean;
    enableAutoBackup: boolean;
  };
}

/**
 * Get environment variable with validation
 */
function getEnvVar(key: string, defaultValue?: string): string {
  const value = import.meta.env[key] || defaultValue;
  if (!value && !defaultValue) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

/**
 * Validate Firebase configuration
 */
function validateFirebaseConfig(config: Partial<FirebaseConfig>): FirebaseConfig {
  const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];

  for (const key of required) {
    if (!config[key as keyof FirebaseConfig]) {
      throw new Error(`Firebase config missing required field: ${key}`);
    }
  }

  return config as FirebaseConfig;
}

/**
 * Application configuration
 */
export const config: AppConfig = {
  version: getEnvVar('VITE_APP_VERSION', '1.0.0'),
  environment: (getEnvVar('VITE_NODE_ENV', 'development') as AppConfig['environment']),
  firebase: validateFirebaseConfig({
    apiKey: getEnvVar('VITE_FIREBASE_API_KEY'),
    authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getEnvVar('VITE_FIREBASE_APP_ID'),
  }),
  sentry: getEnvVar('VITE_SENTRY_DSN') ? {
    dsn: getEnvVar('VITE_SENTRY_DSN'),
  } : undefined,
  features: {
    enableSentry: getEnvVar('VITE_ENABLE_SENTRY', 'false') === 'true',
    enableAnalytics: getEnvVar('VITE_ENABLE_ANALYTICS', 'false') === 'true',
    enableAutoBackup: getEnvVar('VITE_ENABLE_AUTO_BACKUP', 'true') === 'true',
  },
};

/**
 * Check if running in development mode
 */
export const isDevelopment = config.environment === 'development';

/**
 * Check if running in production mode
 */
export const isProduction = config.environment === 'production';

/**
 * Check if running in test mode
 */
export const isTest = config.environment === 'test';

/**
 * Get Firebase configuration for backward compatibility
 */
export const getFirebaseConfig = (): FirebaseConfig => config.firebase;

/**
 * Get Sentry DSN if available
 */
export const getSentryDSN = (): string | undefined => config.sentry?.dsn;

/**
 * Check if a feature is enabled
 */
export const isFeatureEnabled = (feature: keyof AppConfig['features']): boolean =>
  config.features[feature];
