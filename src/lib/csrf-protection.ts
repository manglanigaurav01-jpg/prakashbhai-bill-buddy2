/**
 * CSRF Protection for Bill Buddy App
 *
 * Implements Cross-Site Request Forgery protection using
 * double-submit cookie pattern with encrypted tokens.
 */

import { generateSecureToken } from './security';
import { EncryptedStorage } from './encrypted-storage';
import { AuditLogger, AuditEventType } from './audit-logger';

export interface CSRFToken {
  token: string;
  expiresAt: number;
  sessionId: string;
}

export interface CSRFConfig {
  tokenExpiry: number; // 1 hour in milliseconds
  cookieName: string;
  headerName: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'strict' | 'lax' | 'none';
}

export interface CSRFResult {
  valid: boolean;
  token?: string;
  error?: string;
}

export class CSRFProtection {
  private static readonly DEFAULT_CONFIG: CSRFConfig = {
    tokenExpiry: 60 * 60 * 1000, // 1 hour
    cookieName: 'csrf_token',
    headerName: 'X-CSRF-Token',
    secure: true,
    httpOnly: false, // Allow JavaScript access for token retrieval
    sameSite: 'strict'
  };

  private static config: CSRFConfig = { ...this.DEFAULT_CONFIG };
  private static readonly TOKEN_KEY = 'csrf_tokens';

  /**
   * Configure CSRF protection settings
   */
  public static configure(config: Partial<CSRFConfig>): void {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate a new CSRF token for the current session
   */
  public static async generateToken(sessionId: string): Promise<string> {
    const token = generateSecureToken(32);
    const expiresAt = Date.now() + this.config.tokenExpiry;

    const csrfToken: CSRFToken = {
      token,
      expiresAt,
      sessionId
    };

    // Store token securely
    await this.storeToken(csrfToken);

    // Set cookie
    this.setTokenCookie(token);

    return token;
  }

  /**
   * Validate CSRF token from request
   */
  public static async validateToken(
    tokenFromHeader: string | undefined,
    tokenFromBody: string | undefined,
    sessionId: string
  ): Promise<CSRFResult> {
    const providedToken = tokenFromHeader || tokenFromBody;

    if (!providedToken) {
      await AuditLogger.logSecurityViolation('csrf_missing_token', {
        sessionId,
        source: 'csrf_validation'
      });
      return { valid: false, error: 'CSRF token missing' };
    }

    const storedTokens = await this.getStoredTokens();

    // Find matching token
    const tokenIndex = storedTokens.findIndex(t =>
      t.token === providedToken && t.sessionId === sessionId
    );

    if (tokenIndex === -1) {
      await AuditLogger.logSecurityViolation('csrf_invalid_token', {
        providedToken: providedToken.substring(0, 8) + '...',
        sessionId,
        source: 'csrf_validation'
      });
      return { valid: false, error: 'CSRF token invalid' };
    }

    const token = storedTokens[tokenIndex];

    // Check if token has expired
    if (Date.now() > token.expiresAt) {
      // Remove expired token
      storedTokens.splice(tokenIndex, 1);
      await EncryptedStorage.setItem(this.TOKEN_KEY, storedTokens);

      await AuditLogger.logSecurityViolation('csrf_expired_token', {
        sessionId,
        source: 'csrf_validation'
      });
      return { valid: false, error: 'CSRF token expired' };
    }

    // Token is valid - consume it (remove from storage)
    storedTokens.splice(tokenIndex, 1);
    await EncryptedStorage.setItem(this.TOKEN_KEY, storedTokens);

    return { valid: true, token: providedToken };
  }

  /**
   * Validate CSRF token for state-changing operations
   */
  public static async validateRequest(
    request: {
      method: string;
      headers: Record<string, string>;
      body?: any;
    },
    sessionId: string
  ): Promise<CSRFResult> {
    // Only validate for state-changing methods
    const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    if (!stateChangingMethods.includes(request.method.toUpperCase())) {
      return { valid: true };
    }

    const tokenFromHeader = request.headers[this.config.headerName] ||
                           request.headers[this.config.headerName.toLowerCase()];

    let tokenFromBody: string | undefined;
    if (request.body && typeof request.body === 'object') {
      tokenFromBody = request.body._csrf || request.body.csrfToken;
    }

    return await this.validateToken(tokenFromHeader, tokenFromBody, sessionId);
  }

  /**
   * Get current CSRF token for the session (for forms)
   */
  public static async getCurrentToken(sessionId: string): Promise<string | null> {
    const storedTokens = await this.getStoredTokens();

    // Find valid token for session
    const validToken = storedTokens.find(t =>
      t.sessionId === sessionId && Date.now() <= t.expiresAt
    );

    return validToken ? validToken.token : null;
  }

  /**
   * Refresh CSRF token (generate new one, invalidate old)
   */
  public static async refreshToken(sessionId: string): Promise<string> {
    // Remove all tokens for this session
    await this.clearSessionTokens(sessionId);

    // Generate new token
    return await this.generateToken(sessionId);
  }

  /**
   * Clear all tokens for a session (logout)
   */
  public static async clearSessionTokens(sessionId: string): Promise<void> {
    const storedTokens = await this.getStoredTokens();
    const filteredTokens = storedTokens.filter(t => t.sessionId !== sessionId);
    await EncryptedStorage.setItem(this.TOKEN_KEY, filteredTokens);
  }

  /**
   * Clean up expired tokens
   */
  public static async cleanupExpiredTokens(): Promise<void> {
    const storedTokens = await this.getStoredTokens();
    const now = Date.now();
    const validTokens = storedTokens.filter(t => now <= t.expiresAt);

    if (validTokens.length !== storedTokens.length) {
      await EncryptedStorage.setItem(this.TOKEN_KEY, validTokens);
    }
  }

  /**
   * Get CSRF protection statistics
   */
  public static async getCSRFStats(): Promise<{
    totalTokens: number;
    expiredTokens: number;
    activeTokens: number;
    tokensBySession: Record<string, number>;
  }> {
    const storedTokens = await this.getStoredTokens();
    const now = Date.now();

    const expiredTokens = storedTokens.filter(t => now > t.expiresAt).length;
    const activeTokens = storedTokens.filter(t => now <= t.expiresAt).length;

    const tokensBySession = storedTokens.reduce((acc, token) => {
      acc[token.sessionId] = (acc[token.sessionId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalTokens: storedTokens.length,
      expiredTokens,
      activeTokens,
      tokensBySession
    };
  }

  /**
   * Store token securely
   */
  private static async storeToken(token: CSRFToken): Promise<void> {
    const storedTokens = await this.getStoredTokens();
    storedTokens.push(token);

    // Keep only recent tokens (limit to prevent storage bloat)
    if (storedTokens.length > 100) {
      storedTokens.splice(0, storedTokens.length - 100);
    }

    await EncryptedStorage.setItem(this.TOKEN_KEY, storedTokens);
  }

  /**
   * Get stored tokens
   */
  private static async getStoredTokens(): Promise<CSRFToken[]> {
    try {
      return await EncryptedStorage.getItem<CSRFToken[]>(this.TOKEN_KEY) || [];
    } catch {
      return [];
    }
  }

  /**
   * Set CSRF token cookie
   */
  private static setTokenCookie(token: string): void {
    const cookieOptions = [
      `${this.config.cookieName}=${token}`,
      `Max-Age=${Math.floor(this.config.tokenExpiry / 1000)}`,
      `SameSite=${this.config.sameSite}`,
      this.config.secure ? 'Secure' : '',
      this.config.httpOnly ? 'HttpOnly' : '',
      'Path=/'
    ].filter(Boolean).join('; ');

    // In a browser environment, this would set document.cookie
    // For server-side, this would be handled by the HTTP response
    if (typeof document !== 'undefined') {
      document.cookie = cookieOptions;
    }
  }

  /**
   * Get CSRF token from cookie
   */
  public static getTokenFromCookie(): string | null {
    if (typeof document === 'undefined') return null;

    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === this.config.cookieName) {
        return value;
      }
    }
    return null;
  }

  /**
   * Generate CSRF token HTML for forms
   */
  public static generateFormField(sessionId: string): Promise<string> {
    return this.getCurrentToken(sessionId).then(token => {
      if (!token) {
        return '';
      }
      return `<input type="hidden" name="_csrf" value="${token}" />`;
    });
  }

  /**
   * Generate CSRF token meta tag for AJAX requests
   */
  public static generateMetaTag(sessionId: string): Promise<string> {
    return this.getCurrentToken(sessionId).then(token => {
      if (!token) {
        return '';
      }
      return `<meta name="csrf-token" content="${token}" />`;
    });
  }

  /**
   * Middleware function for request validation
   */
  public static createMiddleware() {
    return async (request: any, response: any, next: Function) => {
      try {
        // Get session ID from request (this would depend on your session management)
        const sessionId = request.session?.id || 'anonymous';

        const result = await this.validateRequest(request, sessionId);

        if (!result.valid) {
          response.status(403).json({
            error: 'CSRF validation failed',
            message: result.error
          });
          return;
        }

        // Generate new token for next request
        const newToken = await this.generateToken(sessionId);
        response.setHeader('X-CSRF-Token', newToken);

        next();
      } catch (error) {
        console.error('CSRF middleware error:', error);
        response.status(500).json({ error: 'Internal server error' });
      }
    };
  }

  /**
   * Validate CSRF configuration for production
   */
  public static validateProductionConfig(): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    if (!this.config.secure) {
      warnings.push('CSRF cookies should be secure in production');
    }

    if (this.config.sameSite !== 'strict') {
      warnings.push('CSRF cookies should use SameSite=strict for maximum security');
    }

    if (this.config.tokenExpiry > 2 * 60 * 60 * 1000) { // 2 hours
      warnings.push('CSRF token expiry should be reasonable (max 2 hours)');
    }

    return {
      valid: warnings.length === 0,
      warnings
    };
  }
}
