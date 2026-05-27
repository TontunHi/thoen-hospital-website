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
    $allOperations: async ({ query, args }: any) => {
      try {
        await basePrisma.$executeRawUnsafe('SET NAMES utf8mb4')
      } catch (e) {
        // Ignore or log error
      }
      return query(args)
    }
  }
})
