/**
 * Threat Detection for Bill Buddy App
 *
 * Advanced threat detection system monitoring suspicious activities,
 * brute force attacks, and security anomalies in real-time.
 */

import { AuditLogger, AuditEventType } from './audit-logger';
import { EncryptedStorage } from './encrypted-storage';

export interface ThreatEvent {
  id: string;
  timestamp: number;
  type: ThreatType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1
  source: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
  sessionId?: string;
}

export enum ThreatType {
  BRUTE_FORCE = 'brute_force',
  MALICIOUS_REQUEST = 'malicious_request',
  SUSPICIOUS_LOGIN = 'suspicious_login',
  ANOMALOUS_ACTIVITY = 'anomalous_activity',
  RATE_LIMIT_BREACH = 'rate_limit_breach',
  SUSPICIOUS_IP = 'suspicious_ip',
  UNUSUAL_TRAFFIC = 'unusual_traffic',
  POTENTIAL_ATTACK = 'potential_attack'
}

export interface ThreatConfig {
  enableRealTimeMonitoring: boolean;
  bruteForceThreshold: number; // Failed attempts per window
  bruteForceWindow: number; // Time window in minutes
  anomalyThreshold: number; // Score threshold for anomalies
  suspiciousIPThreshold: number; // Events per IP per hour
  enableIPBlocking: boolean;
  blockedIPs: Set<string>;
  maxEventsPerHour: number;
}

export interface DetectionResult {
  detected: boolean;
  type?: ThreatType;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  actions: string[];
  details: Record<string, any>;
}

export class ThreatDetection {
  private static readonly EVENTS_KEY = 'threat_events';
  private static readonly BRUTE_FORCE_KEY = 'brute_force_attempts';
  private static readonly IP_ACTIVITY_KEY = 'ip_activity';

  private static readonly DEFAULT_CONFIG: ThreatConfig = {
    enableRealTimeMonitoring: true,
    bruteForceThreshold: 5,
    bruteForceWindow: 15, // 15 minutes
    anomalyThreshold: 0.7,
    suspiciousIPThreshold: 10,
    enableIPBlocking: true,
    blockedIPs: new Set(),
    maxEventsPerHour: 1000
  };

  private static config: ThreatConfig = { ...this.DEFAULT_CONFIG };

  /**
   * Configure threat detection settings
   */
  public static configure(config: Partial<ThreatConfig>): void {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyze request for threats
   */
  public static async analyzeRequest(
    request: {
      url: string;
      method: string;
      headers: Record<string, string>;
      body?: any;
      ipAddress?: string;
      userAgent?: string;
    },
    userId?: string,
    sessionId?: string
  ): Promise<DetectionResult> {
    const results: DetectionResult[] = [];

    // Check for malicious request patterns
    const maliciousResult = this.detectMaliciousRequest(request);
    if (maliciousResult.detected) {
      results.push(maliciousResult);
    }

    // Check for brute force attempts
    const bruteForceResult = await this.detectBruteForce(request, userId);
    if (bruteForceResult.detected) {
      results.push(bruteForceResult);
    }

    // Check for suspicious login patterns
    const loginResult = await this.detectSuspiciousLogin(request, userId);
    if (loginResult.detected) {
      results.push(loginResult);
    }

    // Check for anomalous activity
    const anomalyResult = await this.detectAnomalies(request, userId, sessionId);
    if (anomalyResult.detected) {
      results.push(anomalyResult);
    }

    // Check IP-based threats
    const ipResult = await this.detectIPThreats(request.ipAddress);
    if (ipResult.detected) {
      results.push(ipResult);
    }

    // Return the most severe threat detected
    if (results.length === 0) {
      return { detected: false, confidence: 0, actions: [], details: {} };
    }

    const mostSevere = results.reduce((prev, current) => {
      const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
      return severityOrder[current.severity!] > severityOrder[prev.severity!] ? current : prev;
    });

    // Log the threat
    await this.logThreatEvent({
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: mostSevere.type!,
      severity: mostSevere.severity!,
      confidence: mostSevere.confidence,
      source: 'request_analysis',
      details: mostSevere.details,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      userId,
      sessionId
    });

    return mostSevere;
  }

  /**
   * Detect malicious request patterns
   */
  private static detectMaliciousRequest(request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
  }): DetectionResult {
    const patterns = [
      // Directory traversal
      /\.\./,
      // SQL injection patterns
      /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
      // Command injection
      /[;&|`$()]/,
      // XSS patterns
      /<script|<iframe|<object|<embed/i,
      // Path traversal in URL
      /\/etc\/|\/bin\/|\/usr\/|\/var\//,
      // Suspicious file extensions
      /\.(exe|bat|cmd|scr|com|pif)$/i
    ];

    const checkString = `${request.url} ${JSON.stringify(request.headers)} ${JSON.stringify(request.body || {})}`;

    for (const pattern of patterns) {
      if (pattern.test(checkString)) {
        return {
          detected: true,
          type: ThreatType.MALICIOUS_REQUEST,
          severity: 'high',
          confidence: 0.95,
          actions: ['block_request', 'log_event', 'alert_admin'],
          details: {
            matchedPattern: pattern.source,
            requestUrl: request.url,
            method: request.method
          }
        };
      }
    }

    return { detected: false, confidence: 0, actions: [], details: {} };
  }

  /**
   * Detect brute force attempts
   */
  private static async detectBruteForce(
    request: { url: string; ipAddress?: string },
    userId?: string
  ): Promise<DetectionResult> {
    if (!request.ipAddress && !userId) {
      return { detected: false, confidence: 0, actions: [], details: {} };
    }

    const attempts = await this.getBruteForceAttempts(request.ipAddress, userId);
    const windowStart = Date.now() - (this.config.bruteForceWindow * 60 * 1000);
    const recentAttempts = attempts.filter(a => a.timestamp > windowStart);

    if (recentAttempts.length >= this.config.bruteForceThreshold) {
      return {
        detected: true,
        type: ThreatType.BRUTE_FORCE,
        severity: 'high',
        confidence: Math.min(1, recentAttempts.length / (this.config.bruteForceThreshold * 2)),
        actions: ['block_ip', 'log_event', 'alert_admin', 'require_captcha'],
        details: {
          attemptCount: recentAttempts.length,
          windowMinutes: this.config.bruteForceWindow,
          ipAddress: request.ipAddress,
          userId
        }
      };
    }

    return { detected: false, confidence: 0, actions: [], details: {} };
  }

  /**
   * Detect suspicious login patterns
   */
  private static async detectSuspiciousLogin(
    request: { url: string; ipAddress?: string; userAgent?: string },
    userId?: string
  ): Promise<DetectionResult> {
    // Check for login-related URLs
    const isLoginRequest = /login|signin|auth/i.test(request.url);

    if (!isLoginRequest) {
      return { detected: false, confidence: 0, actions: [], details: {} };
    }

    let suspicionScore = 0;
    const reasons: string[] = [];

    // Check for unusual user agents
    if (request.userAgent) {
      if (/bot|crawler|spider/i.test(request.userAgent)) {
        suspicionScore += 0.3;
        reasons.push('bot_user_agent');
      }
    }

    // Check IP reputation (simplified)
    if (request.ipAddress) {
      const ipActivity = await this.getIPActivity(request.ipAddress);
      if (ipActivity.failedLogins > 3) {
        suspicionScore += 0.4;
        reasons.push('high_failed_logins');
      }
    }

    // Check for rapid successive attempts
    if (userId) {
      const recentEvents = await this.getRecentEventsByUser(userId, 5 * 60 * 1000); // 5 minutes
      const failedLogins = recentEvents.filter(e => e.type === ThreatType.SUSPICIOUS_LOGIN);
      if (failedLogins.length > 2) {
        suspicionScore += 0.3;
        reasons.push('rapid_failed_attempts');
      }
    }

    if (suspicionScore >= 0.5) {
      return {
        detected: true,
        type: ThreatType.SUSPICIOUS_LOGIN,
        severity: suspicionScore >= 0.8 ? 'high' : 'medium',
        confidence: suspicionScore,
        actions: ['log_event', 'require_2fa', 'alert_user'],
        details: {
          suspicionScore,
          reasons,
          ipAddress: request.ipAddress,
          userId
        }
      };
    }

    return { detected: false, confidence: 0, actions: [], details: {} };
  }

  /**
   * Detect anomalous activity patterns
   */
  private static async detectAnomalies(
    request: { url: string; method: string; body?: any },
    userId?: string,
    sessionId?: string
  ): Promise<DetectionResult> {
    let anomalyScore = 0;
    const reasons: string[] = [];

    // Check request size anomalies
    const requestSize = JSON.stringify(request).length;
    if (requestSize > 100000) { // 100KB
      anomalyScore += 0.2;
      reasons.push('large_request');
    }

    // Check for unusual HTTP methods
    if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      anomalyScore += 0.3;
      reasons.push('unusual_method');
    }

    // Check for session anomalies
    if (sessionId) {
      const sessionEvents = await this.getRecentEventsBySession(sessionId, 60 * 60 * 1000); // 1 hour
      const requestFrequency = sessionEvents.length;

      if (requestFrequency > 100) { // More than 100 requests per hour
        anomalyScore += 0.4;
        reasons.push('high_frequency');
      }

      // Check for unusual time patterns
      const now = new Date();
      const hour = now.getHours();
      if (hour >= 2 && hour <= 5) { // Unusual hours
        anomalyScore += 0.1;
        reasons.push('unusual_time');
      }
    }

    // Check for data pattern anomalies
    if (request.body) {
      const bodyStr = JSON.stringify(request.body);
      if (/(.)\1{10,}/.test(bodyStr)) { // Repeated characters
        anomalyScore += 0.2;
        reasons.push('repeated_characters');
      }
    }

    if (anomalyScore >= this.config.anomalyThreshold) {
      return {
        detected: true,
        type: ThreatType.ANOMALOUS_ACTIVITY,
        severity: anomalyScore >= 0.9 ? 'high' : 'medium',
        confidence: anomalyScore,
        actions: ['log_event', 'monitor_session', 'alert_admin'],
        details: {
          anomalyScore,
          reasons,
          requestSize,
          method: request.method,
          userId,
          sessionId
        }
      };
    }

    return { detected: false, confidence: 0, actions: [], details: {} };
  }

  /**
   * Detect IP-based threats
   */
  private static async detectIPThreats(ipAddress?: string): Promise<DetectionResult> {
    if (!ipAddress) {
      return { detected: false, confidence: 0, actions: [], details: {} };
    }

    // Check if IP is blocked
    if (this.config.blockedIPs.has(ipAddress)) {
      return {
        detected: true,
        type: ThreatType.SUSPICIOUS_IP,
        severity: 'critical',
        confidence: 1,
        actions: ['block_request', 'log_event'],
        details: { ipAddress, reason: 'blocked_ip' }
      };
    }

    // Check IP activity
    const activity = await this.getIPActivity(ipAddress);
    const eventsPerHour = activity.totalEvents;

    if (eventsPerHour > this.config.suspiciousIPThreshold) {
      return {
        detected: true,
        type: ThreatType.UNUSUAL_TRAFFIC,
        severity: 'medium',
        confidence: Math.min(1, eventsPerHour / (this.config.suspiciousIPThreshold * 2)),
        actions: ['log_event', 'monitor_ip', 'rate_limit'],
        details: {
          ipAddress,
          eventsPerHour,
          threshold: this.config.suspiciousIPThreshold
        }
      };
    }

    return { detected: false, confidence: 0, actions: [], details: {} };
  }

  /**
   * Log a threat event
   */
  private static async logThreatEvent(event: ThreatEvent): Promise<void> {
    const events = await this.getStoredEvents();
    events.push(event);

    // Keep only recent events
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    const recentEvents = events.filter(e => e.timestamp > cutoffTime);

    await EncryptedStorage.setItem(this.EVENTS_KEY, recentEvents);

    // Log to audit system
    await AuditLogger.logSecurityViolation('threat_detected', {
      threatType: event.type,
      severity: event.severity,
      confidence: event.confidence,
      source: event.source,
      details: event.details
    });
  }

  /**
   * Record failed authentication attempt
   */
  public static async recordFailedAuth(
    ipAddress?: string,
    userId?: string,
    reason?: string
  ): Promise<void> {
    const attempt = {
      timestamp: Date.now(),
      ipAddress,
      userId,
      reason: reason || 'invalid_credentials'
    };

    const attempts = await this.getBruteForceAttempts(ipAddress, userId);
    attempts.push(attempt);

    // Keep only recent attempts
    const cutoffTime = Date.now() - (60 * 60 * 1000); // 1 hour
    const recentAttempts = attempts.filter(a => a.timestamp > cutoffTime);

    await EncryptedStorage.setItem(this.BRUTE_FORCE_KEY, recentAttempts);
  }

  /**
   * Block an IP address
   */
  public static async blockIP(ipAddress: string, reason: string): Promise<void> {
    if (this.config.enableIPBlocking) {
      this.config.blockedIPs.add(ipAddress);

      await AuditLogger.logSecurityViolation('ip_blocked', {
        ipAddress,
        reason,
        source: 'threat_detection'
      });
    }
  }

  /**
   * Unblock an IP address
   */
  public static unblockIP(ipAddress: string): void {
    this.config.blockedIPs.delete(ipAddress);
  }

  /**
   * Get threat detection statistics
   */
  public static async getThreatStats(): Promise<{
    totalEvents: number;
    eventsByType: Record<ThreatType, number>;
    eventsBySeverity: Record<string, number>;
    blockedIPs: string[];
    recentEvents: ThreatEvent[];
  }> {
    const events = await this.getStoredEvents();

    const eventsByType = events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<ThreatType, number>);

    const eventsBySeverity = events.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const recentEvents = events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    return {
      totalEvents: events.length,
      eventsByType,
      eventsBySeverity,
      blockedIPs: Array.from(this.config.blockedIPs),
      recentEvents
    };
  }

  /**
   * Get recent events by IP
   */
  private static async getRecentEventsByIP(
    ipAddress: string,
    timeWindow: number = 60 * 60 * 1000
  ): Promise<ThreatEvent[]> {
    const events = await this.getStoredEvents();
    const cutoffTime = Date.now() - timeWindow;

    return events.filter(e =>
      e.ipAddress === ipAddress && e.timestamp > cutoffTime
    );
  }

  /**
   * Get recent events by user
   */
  private static async getRecentEventsByUser(
    userId: string,
    timeWindow: number = 60 * 60 * 1000
  ): Promise<ThreatEvent[]> {
    const events = await this.getStoredEvents();
    const cutoffTime = Date.now() - timeWindow;

    return events.filter(e =>
      e.userId === userId && e.timestamp > cutoffTime
    );
  }

  /**
   * Get recent events by session
   */
  private static async getRecentEventsBySession(
    sessionId: string,
    timeWindow: number = 60 * 60 * 1000
  ): Promise<ThreatEvent[]> {
    const events = await this.getStoredEvents();
    const cutoffTime = Date.now() - timeWindow;

    return events.filter(e =>
      e.sessionId === sessionId && e.timestamp > cutoffTime
    );
  }

  /**
   * Get brute force attempts
   */
  private static async getBruteForceAttempts(
    ipAddress?: string,
    userId?: string
  ): Promise<Array<{ timestamp: number; ipAddress?: string; userId?: string; reason: string }>> {
    try {
      const attempts = await EncryptedStorage.getItem<any[]>(this.BRUTE_FORCE_KEY) || [];
      return attempts.filter(a =>
        (!ipAddress || a.ipAddress === ipAddress) &&
        (!userId || a.userId === userId)
      );
    } catch {
      return [];
    }
  }

  /**
   * Get IP activity data
   */
  private static async getIPActivity(ipAddress: string): Promise<{
    totalEvents: number;
    failedLogins: number;
    lastActivity: number;
  }> {
    const events = await this.getRecentEventsByIP(ipAddress, 60 * 60 * 1000); // 1 hour

    return {
      totalEvents: events.length,
      failedLogins: events.filter(e => e.type === ThreatType.SUSPICIOUS_LOGIN).length,
      lastActivity: events.length > 0 ? Math.max(...events.map(e => e.timestamp)) : 0
    };
  }

  /**
   * Get stored threat events
   */
  private static async getStoredEvents(): Promise<ThreatEvent[]> {
    try {
      return await EncryptedStorage.getItem<ThreatEvent[]>(this.EVENTS_KEY) || [];
    } catch {
      return [];
    }
  }

  /**
   * Generate unique event ID
   */
  private static generateEventId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `threat_${timestamp}_${random}`;
  }

  /**
   * Clean up old data
   */
  public static async cleanup(): Promise<void> {
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days

    // Clean up old events
    const events = await this.getStoredEvents();
    const recentEvents = events.filter(e => e.timestamp > cutoffTime);
    await EncryptedStorage.setItem(this.EVENTS_KEY, recentEvents);

    // Clean up old brute force attempts
    const attempts = await EncryptedStorage.getItem<any[]>(this.BRUTE_FORCE_KEY) || [];
    const recentAttempts = attempts.filter(a => a.timestamp > cutoffTime);
    await EncryptedStorage.setItem(this.BRUTE_FORCE_KEY, recentAttempts);
  }
}
