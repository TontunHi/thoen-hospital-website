import NextAuth from "next-auth"
import { authOptions } from "@/lib/authOptions"
import { checkRateLimit } from "@/lib/rateLimit"

const handler = NextAuth(authOptions)

async function rateLimitedHandler(request: Request) {
  if (request.method === "POST") {
    const rateCheck = await checkRateLimit({
      key: "auth-login",
      maxAttempts: 5,
      windowSeconds: 900,
    })
    if (!rateCheck.allowed) {
      return rateCheck.response!
    }
  }
  return handler(request)
}

export { rateLimitedHandler as GET, rateLimitedHandler as POST }
