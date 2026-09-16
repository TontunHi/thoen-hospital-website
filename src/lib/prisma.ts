import { PrismaClient } from '@prisma/client'
import { AsyncLocalStorage } from 'node:async_hooks'

const globalForPrisma = globalThis as unknown as {
  prisma: any
}

const basePrisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma

// Context to track if the current async execution is already within an interactive transaction
const transactionContext = new AsyncLocalStorage<boolean>()

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }: any) {
        // If already inside an interactive transaction (pinned connection with utf8mb4), run directly
        if (transactionContext.getStore()) {
          return await query(args)
        }

        // Pin a dedicated database connection via an interactive transaction and execute SET NAMES utf8mb4.
        // This permanently solves the issue where the hospital's MariaDB server has a global setting `init_connect = 'SET NAMES tis620'`
        // which previously caused Prisma's Rust deserializer to throw:
        // "P2023: Inconsistent column data: Conversion failed: Couldn't convert data to UTF-8"
        const result = await transactionContext.run(true, async () => {
          return await basePrisma.$transaction(async (tx: any) => {
            await tx.$executeRawUnsafe('SET NAMES utf8mb4')
            const modelKey = model.charAt(0).toLowerCase() + model.slice(1)
            const delegate = tx[modelKey] || tx[model]
            if (delegate && typeof delegate[operation] === 'function') {
              return await delegate[operation](args)
            }
            return await query(args)
          })
        })

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
  }
})

