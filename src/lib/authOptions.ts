import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน")
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username }
        })

        if (!user) {
          throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")
        }

        const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!isValidPassword) {
          throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")
        }

        return {
          id: user.id.toString(),
          name: user.username,
          email: user.email,
          role: user.role || "patient",
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 60, // 30 minutes
  },
  jwt: {
    maxAge: 30 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.username = user.name
        // Set token expiration to 30 mins from now
        token.accessTokenExpires = Date.now() + 30 * 60 * 1000
        // Set refresh token expiration to 8 hours from now
        token.refreshTokenExpires = Date.now() + 8 * 60 * 60 * 1000
      }

      // Check if access token is still valid
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token
      }

      // If access token has expired, check if refresh token is still valid
      if (Date.now() < (token.refreshTokenExpires as number)) {
        // Refresh the access token: Extend it for another 30 minutes
        token.accessTokenExpires = Date.now() + 30 * 60 * 1000
        return token
      }

      // If refresh token has also expired, token is invalid
      return {
        ...token,
        error: "RefreshTokenExpired"
      }
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).username = token.username;
        (session as any).error = token.error;
      }
      return session
    }
  },
  pages: {
    signIn: "/member/login",
    error: "/unauthorized",
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
