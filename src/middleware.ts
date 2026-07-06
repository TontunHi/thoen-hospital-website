import { NextResponse } from 'next/server'

export function middleware() {
  return NextResponse.next()
}

export const config = {
  // Empty matcher so it does not intercept any routes (no request logs)
  matcher: [],
}
