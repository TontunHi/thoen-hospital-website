import { defineConfig } from 'vitest/config'
import path from 'path'

const DOM_TEST_TS_FILES = [
  'src/app/api/departments/members/upload/__tests__/route.test.ts',
  'src/app/api/member/outgoing-document/__tests__/outgoingDocApi.test.ts',
  'src/app/api/service/dashboard-rcm/t1dm-import/__tests__/route.test.ts',
  'src/app/api/v2/oauth2/auth/__tests__/fallbackRoute.test.ts',
  'src/components/seasonal/__tests__/HalloweenScene.test.ts',
  'src/hooks/__tests__/useRcmDateRange.test.ts',
  'src/lib/clinical/__tests__/dmRemissionDomain.test.ts',
  'src/lib/clinical/__tests__/rcmExcelExport.test.ts',
  'src/lib/events/__tests__/eventTimeUtils.test.ts',
  'src/lib/events/__tests__/hospitalEventService.test.ts',
  'src/lib/__tests__/audit.test.ts',
  'src/lib/__tests__/cache.test.ts',
  'src/lib/__tests__/rateLimit.test.ts',
]

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    globals: true,
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: DOM_TEST_TS_FILES,
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          pool: 'vmThreads',
          setupFiles: ['./src/lib/__tests__/setup.ts'],
          include: ['src/**/*.test.tsx', ...DOM_TEST_TS_FILES],
        },
      },
    ],
  },
})
