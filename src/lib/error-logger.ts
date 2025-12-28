// Error logging service with Sentry integration support

export interface ErrorLog {
  id: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  timestamp: number;
  severity: 'error' | 'warning' | 'info';
  userAgent?: string;
  url?: string;
}

const ERROR_LOG_KEY = 'prakash_error_logs';
const MAX_ERROR_LOGS = 50;

// Check if Sentry is available (will be loaded dynamically)
let sentryAvailable = false;

// Initialize error logging
export const initErrorLogging = async (sentryDsn?: string): Promise<void> => {
  if (sentryDsn && typeof window !== 'undefined') {
    try {
      // Dynamically import Sentry if DSN is provided
      // Note: @sentry/react is optional dependency
      const Sentry = await import('@sentry/react').catch(() => null);
      if (Sentry && Sentry.init) {
        Sentry.init({
          dsn: sentryDsn,
          environment: process.env.NODE_ENV || 'development',
          tracesSampleRate: 0.1,
          beforeSend(event: any) {
            // Filter out sensitive data
            if (event.request) {
              delete event.request.cookies;
              delete event.request.headers;
            }
            return event;
          }
        });
        sentryAvailable = true;
        console.log('Error logging initialized with Sentry');
      }
    } catch (error) {
      console.warn('Failed to initialize Sentry:', error);
    }
  }
};

// Log error to both Sentry (if available) and local storage
export const logError = (
  error: Error | string,
  context?: Record<string, any>,
  severity: ErrorLog['severity'] = 'error'
): string => {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  const errorLog: ErrorLog = {
    id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    message: errorMessage,
    stack: errorStack,
    context,
    timestamp: Date.now(),
    severity,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined
  };
  
  // Log to Sentry if available
  if (sentryAvailable && typeof window !== 'undefined') {
    try {
      const Sentry = (window as any).Sentry;
      if (Sentry) {
        Sentry.captureException(error instanceof Error ? error : new Error(error), {
          contexts: {
            custom: context || {}
          },
          level: severity
        });
      }
    } catch (e) {
      console.warn('Failed to log to Sentry:', e);
    }
  }
  
  // Also store locally
  const logs = getErrorLogs();
  logs.push(errorLog);
  
  // Keep only recent logs
  if (logs.length > MAX_ERROR_LOGS) {
    logs.shift();
  }
  
  localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(logs));
  
  // Console log in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error logged:', errorLog);
  }
  
  return errorLog.id;
};

// Get error logs
export const getErrorLogs = (): ErrorLog[] => {
  try {
    const logs = localStorage.getItem(ERROR_LOG_KEY);
    return logs ? JSON.parse(logs) : [];
  } catch {
    return [];
  }
};

// Clear error logs
export const clearErrorLogs = (): void => {
  localStorage.removeItem(ERROR_LOG_KEY);
};

// Get error logs by severity
export const getErrorLogsBySeverity = (severity: ErrorLog['severity']): ErrorLog[] => {
  return getErrorLogs().filter(log => log.severity === severity);
};

// Export error logs
export const exportErrorLogs = (): string => {
  return JSON.stringify(getErrorLogs(), null, 2);
};

// Global error handler
export const setupGlobalErrorHandler = (): (() => void) => {
  const handleError = (event: ErrorEvent) => {
    logError(event.error || new Error(event.message), {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  };
  
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    logError(
      event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      { type: 'unhandledRejection' },
      'error'
    );
  };
  
  if (typeof window !== 'undefined') {
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }
  
  return () => {}; // No-op if window is not available
};

