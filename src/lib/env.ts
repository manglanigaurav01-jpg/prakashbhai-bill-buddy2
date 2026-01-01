/**
 * Environment configuration (Firebase removed)
 */

interface Config {
  environment: string;
}

const config: Config = {
  environment: import.meta.env.MODE || 'production'
};

export { config };
export default config;
