/**
 * Session Manager for Bill Buddy App
 *
 * Manages user sessions with automatic expiration, activity tracking,
 * and secure session storage.
 */

import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
import { EncryptedStorage } from './encrypted-storage';

export interface SessionData {
  userId: string;
  startTime: number;
  lastActivity: number;
  expiresAt: number;
  sessionId: string;
  userAgent: string;
  ipAddress?: string;
}

export interface SessionConfig {
  maxSessionDuration: number; // 24 hours in milliseconds
  inactivityTimeout: number; // 2 hours in milliseconds
  extendOnActivity: boolean;
}

export class SessionManager {
  private static instance: SessionManager | null = null;
  private static currentSession: SessionData | null = null;
  private static activityTimer: NodeJS.Timeout | null = null;
  private static expiryTimer: NodeJS.Timeout | null = null;

  private static readonly SESSION_KEY = 'user_session';
  private static readonly CONFIG: SessionConfig = {
    maxSessionDuration: 24 * 60 * 60 * 1000, // 24 hours
    inactivityTimeout: 2 * 60 * 60 * 1000, // 2 hours
    extendOnActivity: true
  };

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): SessionManager {
    if (!this.instance) {
      this.instance = new SessionManager();
    }
    return this.instance;
  }

  /**
   * Initialize session management
   */
  public static async initialize(): Promise<void> {
    const auth = getAuth();

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        await this.createSession(user);
      } else {
        await this.endSession();
      }
    });

    // Restore session if exists
    await this.restoreSession();

    // Set up activity tracking
    this.setupActivityTracking();
  }

  /**
   * Create a new session for authenticated user
   */
  private static async createSession(user: User): Promise<void> {
    const now = Date.now();
    const sessionId = this.generateSessionId();

    this.currentSession = {
      userId: user.uid,
      startTime: now,
      lastActivity: now,
      expiresAt: now + this.CONFIG.maxSessionDuration,
      sessionId,
      userAgent: navigator.userAgent,
      ipAddress: await this.getIPAddress()
    };

    // Store session securely
    await EncryptedStorage.setItem(this.SESSION_KEY, this.currentSession);

    // Set up timers
    this.setupExpiryTimer();
    this.resetActivityTimer();

    console.log('Session created:', sessionId);
  }

  /**
   * Restore existing session on app reload
   */
  private static async restoreSession(): Promise<void> {
    try {
      const storedSession = await EncryptedStorage.getItem<SessionData>(this.SESSION_KEY);

      if (storedSession && this.isValidSession(storedSession)) {
        this.currentSession = storedSession;

        // Check if session should be extended due to recent activity
        const timeSinceActivity = Date.now() - storedSession.lastActivity;
        if (timeSinceActivity < this.CONFIG.inactivityTimeout) {
          this.extendSession();
        }

        this.setupExpiryTimer();
        this.resetActivityTimer();

        console.log('Session restored:', storedSession.sessionId);
      } else if (storedSession) {
        // Session exists but is invalid/expired
        await this.endSession();
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
    }
  }

  /**
   * End current session
   */
  public static async endSession(): Promise<void> {
    if (this.currentSession) {
      console.log('Session ended:', this.currentSession.sessionId);
    }

    // Clear timers
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
      this.activityTimer = null;
    }
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }

    // Clear session data
    await EncryptedStorage.removeItem(this.SESSION_KEY);
    this.currentSession = null;
  }

  /**
   * Check if session is valid
   */
  private static isValidSession(session: SessionData): boolean {
    const now = Date.now();

    // Check if session has expired
    if (now > session.expiresAt) {
      return false;
    }

    // Check if user is still authenticated
    const auth = getAuth();
    if (!auth.currentUser || auth.currentUser.uid !== session.userId) {
      return false;
    }

    return true;
  }

  /**
   * Extend session on user activity
   */
  private static extendSession(): void {
    if (!this.currentSession) return;

    const now = Date.now();
    const newExpiry = Math.min(
      now + this.CONFIG.maxSessionDuration,
      this.currentSession.startTime + this.CONFIG.maxSessionDuration
    );

    this.currentSession.lastActivity = now;
    this.currentSession.expiresAt = newExpiry;

    // Update stored session
    EncryptedStorage.setItem(this.SESSION_KEY, this.currentSession);

    // Reset timers
    this.resetActivityTimer();
    this.setupExpiryTimer();
  }

  /**
   * Get current session data
   */
  public static getCurrentSession(): SessionData | null {
    return this.currentSession;
  }

  /**
   * Check if user has active session
   */
  public static hasActiveSession(): boolean {
    return this.currentSession !== null && this.isValidSession(this.currentSession);
  }

  /**
   * Get session status
   */
  public static getSessionStatus() {
    if (!this.currentSession) {
      return { active: false };
    }

    const now = Date.now();
    const timeRemaining = this.currentSession.expiresAt - now;
    const timeSinceActivity = now - this.currentSession.lastActivity;

    return {
      active: this.hasActiveSession(),
      sessionId: this.currentSession.sessionId,
      startTime: this.currentSession.startTime,
      lastActivity: this.currentSession.lastActivity,
      expiresAt: this.currentSession.expiresAt,
      timeRemaining,
      timeSinceActivity,
      isExpiringSoon: timeRemaining < 30 * 60 * 1000, // 30 minutes
      isInactive: timeSinceActivity > this.CONFIG.inactivityTimeout
    };
  }

  /**
   * Force session refresh
   */
  public static async refreshSession(): Promise<void> {
    const auth = getAuth();
    const user = auth.currentUser;

    if (user && this.currentSession) {
      this.extendSession();
    }
  }

  /**
   * Set up activity tracking
   */
  private static setupActivityTracking(): void {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    const activityHandler = () => {
      if (this.hasActiveSession() && this.CONFIG.extendOnActivity) {
        this.extendSession();
      }
    };

    events.forEach(event => {
      document.addEventListener(event, activityHandler, { passive: true });
    });
  }

  /**
   * Set up session expiry timer
   */
  private static setupExpiryTimer(): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
    }

    if (!this.currentSession) return;

    const timeUntilExpiry = this.currentSession.expiresAt - Date.now();

    if (timeUntilExpiry > 0) {
      this.expiryTimer = setTimeout(async () => {
        console.log('Session expired');
        await this.endSession();
        // Trigger logout or session expiry handling
        window.location.reload();
      }, timeUntilExpiry);
    }
  }

  /**
   * Reset activity timer
   */
  private static resetActivityTimer(): void {
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
    }

    if (!this.currentSession) return;

    this.activityTimer = setTimeout(async () => {
      console.log('Session inactive for too long');
      await this.endSession();
      // Trigger logout or session expiry handling
      window.location.reload();
    }, this.CONFIG.inactivityTimeout);
  }

  /**
   * Generate unique session ID
   */
  private static generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `sess_${timestamp}_${random}`;
  }

  /**
   * Get approximate IP address (client-side)
   */
  private static async getIPAddress(): Promise<string | undefined> {
    try {
      // This is a simplified approach - in production, you'd get this from server
      return undefined; // Not available client-side
    } catch {
      return undefined;
    }
  }

  /**
   * Clean up resources
   */
  public static cleanup(): void {
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
      this.activityTimer = null;
    }
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }
}
