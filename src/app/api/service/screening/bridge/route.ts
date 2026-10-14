import { NextResponse } from 'next/server'

/**
 * Smart Card Bridge proxy notification
 * Client hardware bridges (USB Smart Card) run on the client's PC and must be
 * contacted directly from the browser at http://localhost:8084 or http://127.0.0.1:8084.
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      message:
        'Client-side hardware bridge must be accessed directly from browser at http://localhost:8084 or http://127.0.0.1:8084',
    },
    { status: 400 }
  )
}
