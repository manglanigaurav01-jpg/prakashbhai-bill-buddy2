/**
 * Audit Logger for Bill Buddy App
 *
 * Logs security events, user actions, and system activities
 * for compliance and monitoring purposes.
 */

import { EncryptedStorage } from './encrypted-storage';
import { getAuth } from 'firebase/auth';

export enum AuditEventType {
  AUTH_LOGIN = 'auth_login',
  AUTH_LOGOUT = 'auth_logout',
  AUTH_FAILED = 'auth_failed',
  AUTH_REGISTER = 'auth_register',
  PASSWORD_RESET = 'password_reset',
  SESSION_EXPIRED = 'session_expired',
  DATA_ACCESS = 'data_access',
  DATA_MODIFY = 'data_modify',
  DATA_DELETE = 'data_delete',
  SECURITY_VIOLATION = 'security_violation',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  INJECTION_ATTEMPT = 'injection_attempt',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity'
}

export interface AuditEvent {
  id: string;
  timestamp: number;
  eventType: AuditEventType;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent: string;
  details: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
}

export interface AuditLogSummary {
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  eventsBySeverity: Record<string, number>;
  recentEvents: AuditEvent[];
  lastActivity: number;
}

export class AuditLogger {
  private static readonly LOG_KEY = 'audit_log';
  private static readonly MAX_LOG_ENTRIES = 1000;
  private static readonly RETENTION_DAYS = 90;

  /**
   * Log an audit event
   */
  public static async logEvent(
    eventType: AuditEventType,
    details: Record<string, any> = {},
    severity: 'low' | 'medium' | 'high' | 'critical' = 'low',
    source: string = 'client'
  ): Promise<void> {
    try {
      const auth = getAuth();
      const user = auth.currentUser;

      const event: AuditEvent = {
        id: this.generateEventId(),
        timestamp: Date.now(),
        eventType,
        userId: user?.uid,
        sessionId: this.getCurrentSessionId(),
        ipAddress: await this.getIPAddress(),
        userAgent: navigator.userAgent,
        details,
        severity,
        source
      };

      // Store event
      await this.storeEvent(event);

      // Clean up old entries
      await this.cleanupOldEntries();

      // Log critical events to console
      if (severity === 'critical') {
        console.error('Critical audit event:', event);
      }

    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }

  /**
   * Log authentication events
   */
  public static async logAuthEvent(
    eventType: AuditEventType,
    success: boolean,
    details: Record<string, any> = {}
  ): Promise<void> {
    const severity = success ? 'low' : 'medium';
    await this.logEvent(eventType, { success, ...details }, severity, 'auth');
  }

  /**
   * Log security violations
   */
  public static async logSecurityViolation(
    violationType: string,
    details: Record<string, any>
  ): Promise<void> {
    await this.logEvent(
      AuditEventType.SECURITY_VIOLATION,
      { violationType, ...details },
      'high',
      'security'
    );
  }

  /**
   * Log data access events
   */
  public static async logDataAccess(
    action: 'read' | 'write' | 'delete',
    resource: string,
    resourceId?: string
  ): Promise<void> {
    const eventType = action === 'read' ? AuditEventType.DATA_ACCESS :
                     action === 'write' ? AuditEventType.DATA_MODIFY :
                     AuditEventType.DATA_DELETE;

    await this.logEvent(
      eventType,
      { resource, resourceId, action },
      'low',
      'data'
    );
  }

  /**
   * Get audit log summary
   */
  public static async getAuditSummary(): Promise<AuditLogSummary> {
    try {
      const events = await this.getAllEvents();

      const eventsByType = events.reduce((acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1;
        return acc;
      }, {} as Record<AuditEventType, number>);

      const eventsBySeverity = events.reduce((acc, event) => {
        acc[event.severity] = (acc[event.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const recentEvents = events
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10);

      const lastActivity = events.length > 0 ?
        Math.max(...events.map(e => e.timestamp)) : 0;

      return {
        totalEvents: events.length,
        eventsByType,
        eventsBySeverity,
        recentEvents,
        lastActivity
      };

    } catch (error) {
      console.error('Failed to get audit summary:', error);
      return {
        totalEvents: 0,
        eventsByType: {} as Record<AuditEventType, number>,
        eventsBySeverity: {},
        recentEvents: [],
        lastActivity: 0
      };
    }
  }

  /**
   * Get events by type
   */
  public static async getEventsByType(
    eventType: AuditEventType,
    limit: number = 50
  ): Promise<AuditEvent[]> {
    const events = await this.getAllEvents();
    return events
      .filter(event => event.eventType === eventType)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get events by user
   */
  public static async getEventsByUser(
    userId: string,
    limit: number = 50
  ): Promise<AuditEvent[]> {
    const events = await this.getAllEvents();
    return events
      .filter(event => event.userId === userId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get events by severity
   */
  public static async getEventsBySeverity(
    severity: 'low' | 'medium' | 'high' | 'critical',
    limit: number = 50
  ): Promise<AuditEvent[]> {
    const events = await this.getAllEvents();
    return events
      .filter(event => event.severity === severity)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Search events
   */
  public static async searchEvents(
    query: string,
    limit: number = 50
  ): Promise<AuditEvent[]> {
    const events = await this.getAllEvents();
    const lowerQuery = query.toLowerCase();

    return events
      .filter(event =>
        JSON.stringify(event).toLowerCase().includes(lowerQuery)
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Export audit log (for admin purposes)
   */
  public static async exportAuditLog(): Promise<string> {
    const events = await this.getAllEvents();
    return JSON.stringify(events, null, 2);
  }

  /**
   * Clear audit log (admin only)
   */
  public static async clearAuditLog(): Promise<void> {
    await EncryptedStorage.removeItem(this.LOG_KEY);
  }

  /**
   * Store event in encrypted storage
   */
  private static async storeEvent(event: AuditEvent): Promise<void> {
    const events = await this.getAllEvents();
    events.push(event);

    // Keep only the most recent entries
    if (events.length > this.MAX_LOG_ENTRIES) {
      events.splice(0, events.length - this.MAX_LOG_ENTRIES);
    }

    await EncryptedStorage.setItem(this.LOG_KEY, events);
  }

  /**
   * Get all events from storage
   */
  private static async getAllEvents(): Promise<AuditEvent[]> {
    try {
      return await EncryptedStorage.getItem<AuditEvent[]>(this.LOG_KEY) || [];
    } catch {
      return [];
    }
  }

  /**
   * Clean up old entries based on retention policy
   */
  private static async cleanupOldEntries(): Promise<void> {
    const events = await this.getAllEvents();
    const cutoffTime = Date.now() - (this.RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const filteredEvents = events.filter(event => event.timestamp > cutoffTime);

    if (filteredEvents.length !== events.length) {
      await EncryptedStorage.setItem(this.LOG_KEY, filteredEvents);
    }
  }

  /**
   * Generate unique event ID
   */
  private static generateEventId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `audit_${timestamp}_${random}`;
  }

  /**
   * Get current session ID
   */
  private static getCurrentSessionId(): string | undefined {
    // This would integrate with SessionManager
    return undefined; // Placeholder
  }

  /**
   * Get approximate IP address
   */
  private static async getIPAddress(): Promise<string | undefined> {
    try {
      // In a real implementation, this would come from the server
      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Get audit statistics
   */
  public static async getAuditStats(): Promise<{
    totalEvents: number;
    eventsLast24h: number;
    eventsLast7d: number;
    criticalEvents: number;
    topEventTypes: Array<{ type: AuditEventType; count: number }>;
  }> {
    const events = await this.getAllEvents();
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * oneDay;

    const eventsLast24h = events.filter(e => now - e.timestamp < oneDay).length;
    const eventsLast7d = events.filter(e => now - e.timestamp < sevenDays).length;
    const criticalEvents = events.filter(e => e.severity === 'critical').length;

    const typeCounts = events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<AuditEventType, number>);

    const topEventTypes = Object.entries(typeCounts)
      .map(([type, count]) => ({ type: type as AuditEventType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalEvents: events.length,
      eventsLast24h,
      eventsLast7d,
      criticalEvents,
      topEventTypes
    };
  }
}
