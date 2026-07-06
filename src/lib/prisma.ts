import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: any
}

const basePrisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma

// Extend Prisma Client to run SET NAMES utf8mb4 on every query
// to fix encoding issues with databases set to tis620 character set.
export const prisma = basePrisma.$extends({
  query: {
    $allOperations: async ({ model, operation, args, query }: any) => {
      try {
        await basePrisma.$executeRawUnsafe('SET NAMES utf8mb4')
      } catch (e) {
        // Ignore or log error
      }
      
      const result = await query(args)

      try {
        const writeOperations = ['create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert']
        if (writeOperations.includes(operation)) {
          let actionType = 'UPDATE'
          if (operation.startsWith('create')) actionType = 'CREATE'
          else if (operation.startsWith('delete')) actionType = 'DELETE'

          const { logAudit } = await import('./audit')
          logAudit(
            actionType as any,
            model || 'prisma',
            `Operation: ${operation} | Args: ${JSON.stringify(args)}`
          ).catch(err => console.error('Prisma audit log failed:', err))
        }
      } catch (err) {
        console.error('Error in Prisma audit hook:', err)
      }

      return result
    }
  }
})
