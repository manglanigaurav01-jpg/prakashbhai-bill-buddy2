/**
 * Content Security Policy (CSP) for Bill Buddy App
 *
 * Implements Content Security Policy headers to prevent XSS attacks
 * and other code injection vulnerabilities.
 */

export interface CSPDirective {
  name: string;
  values: string[];
}

export interface CSPConfig {
  defaultSrc: string[];
  scriptSrc: string[];
  styleSrc: string[];
  imgSrc: string[];
  fontSrc: string[];
  connectSrc: string[];
  mediaSrc: string[];
  objectSrc: string[];
  frameSrc: string[];
  frameAncestors: string[];
  formAction: string[];
  upgradeInsecureRequests: boolean;
  blockAllMixedContent: boolean;
  reportUri?: string;
  reportOnly: boolean;
}

export interface CSPResult {
  headerName: string;
  headerValue: string;
  violations: CSPViolation[];
}

export interface CSPViolation {
  timestamp: number;
  documentUri: string;
  violatedDirective: string;
  effectiveDirective: string;
  originalPolicy: string;
  blockedUri: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
}

export class ContentSecurityPolicy {
  private static readonly DEFAULT_CONFIG: CSPConfig = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Relaxed for development
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    fontSrc: ["'self'", 'https:', 'data:'],
    connectSrc: ["'self'", 'https://firestore.googleapis.com', 'https://identitytoolkit.googleapis.com'],
    mediaSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameSrc: ["'none'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
    upgradeInsecureRequests: true,
    blockAllMixedContent: true,
    reportOnly: false
  };

  private static config: CSPConfig = { ...this.DEFAULT_CONFIG };
  private static violations: CSPViolation[] = [];

  /**
   * Configure CSP settings
   */
  public static configure(config: Partial<CSPConfig>): void {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate CSP header
   */
  public static generateHeader(): CSPResult {
    const directives: CSPDirective[] = [];

    // Build directives from config
    directives.push({ name: 'default-src', values: this.config.defaultSrc });
    directives.push({ name: 'script-src', values: this.config.scriptSrc });
    directives.push({ name: 'style-src', values: this.config.styleSrc });
    directives.push({ name: 'img-src', values: this.config.imgSrc });
    directives.push({ name: 'font-src', values: this.config.fontSrc });
    directives.push({ name: 'connect-src', values: this.config.connectSrc });
    directives.push({ name: 'media-src', values: this.config.mediaSrc });
    directives.push({ name: 'object-src', values: this.config.objectSrc });
    directives.push({ name: 'frame-src', values: this.config.frameSrc });
    directives.push({ name: 'frame-ancestors', values: this.config.frameAncestors });
    directives.push({ name: 'form-action', values: this.config.formAction });

    if (this.config.upgradeInsecureRequests) {
      directives.push({ name: 'upgrade-insecure-requests', values: [] });
    }

    if (this.config.blockAllMixedContent) {
      directives.push({ name: 'block-all-mixed-content', values: [] });
    }

    if (this.config.reportUri) {
      directives.push({ name: 'report-uri', values: [this.config.reportUri] });
    }

    // Generate header value
    const headerValue = directives
      .map(directive => {
        if (directive.values.length === 0) {
          return directive.name;
        }
        return `${directive.name} ${directive.values.join(' ')}`;
      })
      .join('; ');

    const headerName = this.config.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';

    return {
      headerName,
      headerValue,
      violations: [...this.violations]
    };
  }

  /**
   * Set production-ready strict CSP
   */
  public static setStrictPolicy(): void {
    this.config = {
      ...this.DEFAULT_CONFIG,
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'https:'],
      connectSrc: ["'self'", 'https://firestore.googleapis.com', 'https://identitytoolkit.googleapis.com'],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: true,
      blockAllMixedContent: true,
      reportOnly: false
    };
  }

  /**
   * Add nonce to script-src for inline scripts
   */
  public static addScriptNonce(nonce: string): void {
    if (!this.config.scriptSrc.includes(`'nonce-${nonce}'`)) {
      this.config.scriptSrc.push(`'nonce-${nonce}'`);
    }
  }

  /**
   * Add hash to script-src for inline scripts
   */
  public static addScriptHash(hash: string): void {
    if (!this.config.scriptSrc.includes(`'${hash}'`)) {
      this.config.scriptSrc.push(`'${hash}'`);
    }
  }

  /**
   * Allow external domain for specific directive
   */
  public static allowDomain(directive: keyof CSPConfig, domain: string): void {
    if (Array.isArray(this.config[directive])) {
      const directiveArray = this.config[directive] as string[];
      if (!directiveArray.includes(domain)) {
        directiveArray.push(domain);
      }
    }
  }

  /**
   * Record CSP violation report
   */
  public static recordViolation(report: any): void {
    const violation: CSPViolation = {
      timestamp: Date.now(),
      documentUri: report.documentUri || '',
      violatedDirective: report.violatedDirective || '',
      effectiveDirective: report.effectiveDirective || '',
      originalPolicy: report.originalPolicy || '',
      blockedUri: report.blockedUri || '',
      sourceFile: report.sourceFile,
      lineNumber: report.lineNumber,
      columnNumber: report.columnNumber
    };

    this.violations.push(violation);

    // Keep only recent violations (last 100)
    if (this.violations.length > 100) {
      this.violations.shift();
    }

    // Log critical violations
    if (this.isCriticalViolation(violation)) {
      console.error('Critical CSP violation:', violation);
    }
  }

  /**
   * Get CSP violations
   */
  public static getViolations(limit: number = 50): CSPViolation[] {
    return this.violations.slice(-limit);
  }

  /**
   * Clear violations
   */
  public static clearViolations(): void {
    this.violations = [];
  }

  /**
   * Get CSP statistics
   */
  public static getCSPStats(): {
    totalViolations: number;
    violationsByDirective: Record<string, number>;
    recentViolations: CSPViolation[];
    config: CSPConfig;
  } {
    const violationsByDirective = this.violations.reduce((acc, violation) => {
      acc[violation.violatedDirective] = (acc[violation.violatedDirective] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalViolations: this.violations.length,
      violationsByDirective,
      recentViolations: this.violations.slice(-10),
      config: { ...this.config }
    };
  }

  /**
   * Validate CSP configuration for production
   */
  public static validateProductionConfig(): { valid: boolean; warnings: string[]; recommendations: string[] } {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check for unsafe directives
    if (this.config.scriptSrc.includes("'unsafe-inline'")) {
      warnings.push("script-src contains 'unsafe-inline'");
      recommendations.push("Use nonces or hashes instead of 'unsafe-inline'");
    }

    if (this.config.scriptSrc.includes("'unsafe-eval'")) {
      warnings.push("script-src contains 'unsafe-eval'");
      recommendations.push("Avoid 'unsafe-eval' in production");
    }

    if (this.config.styleSrc.includes("'unsafe-inline'")) {
      warnings.push("style-src contains 'unsafe-inline'");
      recommendations.push("Use nonces or hashes for inline styles");
    }

    // Check for overly permissive sources
    if (this.config.defaultSrc.includes('*')) {
      warnings.push("default-src should not contain '*'");
      recommendations.push("Specify exact domains instead of '*'");
    }

    // Check for missing upgrade-insecure-requests
    if (!this.config.upgradeInsecureRequests) {
      warnings.push("upgrade-insecure-requests not enabled");
      recommendations.push("Enable upgrade-insecure-requests for HTTPS enforcement");
    }

    // Check for missing report-uri
    if (!this.config.reportUri) {
      recommendations.push("Set report-uri to monitor CSP violations");
    }

    return {
      valid: warnings.length === 0,
      warnings,
      recommendations
    };
  }

  /**
   * Generate development-friendly CSP
   */
  public static setDevelopmentPolicy(): void {
    this.config = {
      ...this.DEFAULT_CONFIG,
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:', 'http:'],
      connectSrc: ["'self'", 'https:', 'http:', 'ws:', 'wss:'],
      reportOnly: true
    };
  }

  /**
   * Check if violation is critical
   */
  private static isCriticalViolation(violation: CSPViolation): boolean {
    const criticalDirectives = ['script-src', 'object-src', 'base-uri'];
    return criticalDirectives.some(directive =>
      violation.violatedDirective.includes(directive)
    );
  }

  /**
   * Generate nonce for inline scripts
   */
  public static generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array)).replace(/[+/=]/g, '').substring(0, 16);
  }

  /**
   * Generate hash for inline script/style
   */
  public static generateHash(content: string, algorithm: 'sha256' | 'sha384' | 'sha512' = 'sha256'): string {
    // Note: This is a simplified version. In practice, you'd use Web Crypto API
    // For now, return a placeholder
    return `${algorithm}-placeholder-hash`;
  }
}
