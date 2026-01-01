// AuditLogger stub (Firebase removed)
export enum AuditEventType {
  AUTH_LOGIN = 'auth_login',
  AUTH_LOGOUT = 'auth_logout',
  AUTH_FAILED = 'auth_failed',
  SECURITY_VIOLATION = 'security_violation',
  DATA_ACCESS = 'data_access',
  DATA_MODIFY = 'data_modify',
  DATA_DELETE = 'data_delete'
}
export class AuditLogger {
  public static async logEvent(eventType: AuditEventType, details?: any, severity?: string, source?: string): Promise<void> {}
  public static async logAuthEvent(eventType: AuditEventType, success: boolean, details?: any): Promise<void> {}
  public static async logSecurityViolation(violationType: string, details: any): Promise<void> {}
  public static async logDataAccess(action: string, resource: string, resourceId?: string): Promise<void> {}
}
