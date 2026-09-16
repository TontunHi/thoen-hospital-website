import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: any
}

const basePrisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma

// Cache charset initialization so we don't execute SET NAMES on every single query
let charsetInitialized = false

async function ensureCharset() {
  if (charsetInitialized) return
  try {
    await basePrisma.$executeRawUnsafe('SET NAMES utf8mb4')
    charsetInitialized = true
  } catch {
    // Suppress if already initialized or connection warm-up
  }
}

export const prisma = basePrisma.$extends({
  query: {
    $allOperations: async ({ model, operation, args, query }: any) => {
      if (!charsetInitialized) {
        await ensureCharset()
      }
      
      const result = await query(args)

      try {
        const writeOperations = ['create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert']
        if (writeOperations.includes(operation)) {
          let actionType = 'UPDATE'
          if (operation.startsWith('create')) actionType = 'CREATE'
          else if (operation.startsWith('delete')) actionType = 'DELETE'

          const { logAudit } = await import('./audit')
          const { logger } = await import('./logger')
          logAudit(
            actionType as any,
            model || 'prisma',
            `Operation: ${operation} | Args: ${JSON.stringify(args)}`
          ).catch(err => logger.error({ err }, 'Prisma audit log failed'))
        }
      } catch (err) {
        const { logger } = await import('./logger')
        logger.error({ err }, 'Error in Prisma audit hook')
      }

      return result
    }
  }
})
