import winston from 'winston'

/**
 * Shared Winston logger instance for the application.
 * Configured with console and file transports for consistent logging across all modules.
 */
export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'api-server.log' })
  ]
})
