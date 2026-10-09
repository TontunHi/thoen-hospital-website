import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { createRegistrationService } from './RegistrationService'

/** Production wiring for RegistrationService: Prisma, per-IP rate limit, Pino logger, audit trail. */
export const registrationService = createRegistrationService({
  createRegistration: (data) =>
    prisma.memberRegistration.create({ data, select: { id: true } }),
  checkRateLimit: async () => {
    const result = await checkRateLimit({ key: 'member-register', maxAttempts: 5, windowSeconds: 900 })
    return {
      allowed: result.allowed,
      retryAfterSeconds: Math.max(0, Math.ceil((result.resetTime - Date.now()) / 1000)),
    }
  },
  log: (message, context) => logger.info(context, message),
  audit: (actionType, targetTable, details, actor) => logAudit(actionType, targetTable, details, actor),
})
