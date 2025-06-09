/**
 * Simple logger service for the payment system
 */
export class LoggerService {
  private static formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] ${message}${dataStr}`;
  }

  static logInfo(message: string, data?: any): void {
    console.log(this.formatMessage('INFO', message, data));
  }

  static logError(message: string, error?: any): void {
    const errorStr = error instanceof Error ? error.message : error;
    console.error(this.formatMessage('ERROR', message, errorStr));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  }

  static logWarn(message: string, data?: any): void {
    console.warn(this.formatMessage('WARN', message, data));
  }

  static logDebug(message: string, data?: any): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('DEBUG', message, data));
    }
  }

  static logCache(operation: string, key: string, hit: boolean): void {
    this.logDebug(`Cache ${operation}: ${key} (${hit ? 'HIT' : 'MISS'})`);
  }

  static logDatabase(operation: string, table: string, data?: any): void {
    this.logDebug(`Database ${operation}: ${table}`, data);
  }
}
