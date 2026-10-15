/**
 * Environment variable validation
 * 
 * Import this module in your app's root layout or instrumentation file
 * to fail fast if critical environment variables are missing.
 * 
 * Fixes: Hardcoded fallback credentials that would be used if env vars missing.
 */

const requiredEnvVars = [
  'API_GATEWAY_URL',
  'API_GATEWAY_KEY',
  'MEMBER_SESSION_SECRET',
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
