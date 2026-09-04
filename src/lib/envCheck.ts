/**
 * Environment variable validation
 * 
 * Import this module in your app's root layout or instrumentation file
 * to fail fast if critical environment variables are missing.
 * 
 * Fixes: Hardcoded fallback credentials that would be used if env vars missing.
 */

const requiredEnvVars = [
  'DATABASE_URL',
  'ADMIN_SECRET',
  'SALARY_DB_HOST',
  'SALARY_DB_USER',
  'SALARY_DB_PASSWORD',
  'SALARY_DB_NAME',
  'ER_DB_HOST',
  'ER_DB_USER',
  'ER_DB_PASSWORD',
  'ER_DB_NAME',
  'MEMBER_DB_HOST',
  'MEMBER_DB_USER',
  'MEMBER_DB_PASSWORD',
  'MEMBER_DB_NAME',
  'MEMBER_OTP_EMAIL_USER',
  'MEMBER_OTP_EMAIL_PASS',
  'MEMBER_SESSION_SECRET',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
] as const

/**
 * Validates that all required environment variables are set.
 * Logs warnings for missing vars in development, throws in production.
 */
export function validateEnv(): void {
  const missing: string[] = []

  for (const key of requiredEnvVars) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    const message = `❌ Missing required environment variables:\n${missing.map(k => `  - ${k}`).join('\n')}\n\nPlease set them in your .env file. See .env.example for reference.`

    if (process.env.NODE_ENV === 'production') {
      throw new Error(message)
    } else {
      console.warn(`\n⚠️  WARNING: ${message}\n`)
    }
  }
}

// To use: import { validateEnv } from '@/lib/envCheck' and call validateEnv()
// Recommended: call in instrumentation.ts or server-side layout
