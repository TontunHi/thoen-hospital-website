import { NextRequest } from 'next/server'
import {
  handleKpiIndicatorsDelete,
  handleKpiIndicatorsGet,
  handleKpiIndicatorsPost,
  handleKpiIndicatorsPut,
} from '@/lib/kpi/kpiIndicatorsRouteHelper'

export async function GET(req: NextRequest) {
  return handleKpiIndicatorsGet(req)
}

export async function POST(req: NextRequest) {
  return handleKpiIndicatorsPost(req)
}

export async function PUT(req: NextRequest) {
  return handleKpiIndicatorsPut(req)
}

export async function DELETE(req: NextRequest) {
  return handleKpiIndicatorsDelete(req)
}
