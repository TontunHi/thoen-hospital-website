import { NextRequest } from 'next/server'
import {
  handleT1dmImportDelete,
  handleT1dmImportGet,
  handleT1dmImportPost,
} from '@/lib/clinical/rcmT1dmImportRouteHelper'

export async function GET(req: NextRequest) {
  return handleT1dmImportGet(req)
}

export async function POST(req: NextRequest) {
  return handleT1dmImportPost(req)
}

export async function DELETE(req: NextRequest) {
  return handleT1dmImportDelete(req)
}
