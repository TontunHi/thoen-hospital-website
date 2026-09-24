/**
 * Compatibility adapter forwarding to the unified clinical database module.
 * @deprecated Use `queryClinicalDb` from `@/lib/clinicalDb` instead.
 */
import { queryClinicalDb } from './clinicalDb'

export async function queryAppointmentDb(sql: string, params: any[] = []) {
  return queryClinicalDb(sql, params)
}
