import pino from 'pino'

/**
 * Hospital System Structured Logger (Pino)
 * 
 * Complies with hospital privacy standards:
 * - Automatically redacts PHI and sensitive credentials (passwords, OTPs, citizen IDs)
 * - ISO timestamps
 * - Proper log levels (info, warn, error, debug)
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  redact: {
    paths: [
      'password',
      'salary_pass',
      'otp',
      'otp_code',
      'token',
      'secret',
      'authorization',
      'cookie',
      'cid',
      'citizenId',
      'hash_cid',
      'hn',
      'phone',
      '*.password',
      '*.salary_pass',
      '*.otp',
      '*.otp_code',
      '*.token',
      '*.cid',
      '*.citizenId',
      '*.hash_cid',
      '*.hn',
      '*.phone',
    ],
    remove: false,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
})
