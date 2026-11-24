import { NextRequest } from 'next/server'
import {
  handleSeamlessImportDelete,
  handleSeamlessImportGet,
  handleSeamlessImportPost,
} from '@/lib/clinical/rcmSeamlessImportRouteHelper'

export async function GET(req: NextRequest) {
  return handleSeamlessImportGet(req)
}

export async function DELETE(req: NextRequest) {
  return handleSeamlessImportDelete(req)
}

export async function POST(req: NextRequest) {
  return handleSeamlessImportPost(req)
}
