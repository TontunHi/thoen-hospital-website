import type { RequestOptions } from './gatewayTypes'

export interface SalaryHttpClient {
  get: <T = unknown>(path: string, options?: RequestOptions) => Promise<T>
  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
  put: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
  delete: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>
}

export function createSalaryNamespace(client: SalaryHttpClient) {
  return {
    verifyLogin: (username: string, password: string) => {
      return client.post<{
        user: { username: string; name: string; status: string }
      }>('/api/v1/salary/verify-login', { username, password })
    },

    getRecords: (username: string) => {
      return client.get<{
        salary: Array<Record<string, unknown>>
        ot: Array<Record<string, unknown>>
      }>(`/api/v1/salary/records/${encodeURIComponent(username)}`)
    },

    getPeriods: () => {
      return client.get<Array<{ id: number; type: string; datein: string; notesalary: string | null }>>(
        '/api/v1/salary/periods'
      )
    },

    getCalendar: () => {
      return client.get<Array<{ id: number; type: string; datein: string; notesalary: string | null }>>(
        '/api/v1/salary/calendar'
      )
    },

    createPeriod: (period: { type?: string; datein: string; notesalary: string }) => {
      return client.post<{ insertId: number }>('/api/v1/salary/periods', period)
    },

    updatePeriod: (id: string | number, period: { type?: string; datein: string; notesalary?: string | null }) => {
      return client.put<{ success: boolean; affectedRows: number }>(`/api/v1/salary/periods/${id}`, period)
    },

    deletePeriod: (id: string | number) => {
      return client.delete<{ deletedId: string }>(`/api/v1/salary/periods/${id}`)
    },

    getUsers: () => {
      return client.get<Array<{ user_name: string; user_pass: string }>>('/api/v1/salary/users')
    },

    uploadBatch: (targetTable: 'salary' | 'ot', rows: Record<string, unknown>[]) => {
      return client.post<{ insertedCount: number }>('/api/v1/salary/upload-batch', { targetTable, rows })
    },

    getLatestBatchSummary: (type: 'salary' | 'ot') => {
      return client.get<{ summary: { tableName: 'salary' | 'ot'; date: string; count: number } | null }>(
        `/api/v1/salary/batch/summary/${type}`
      )
    },

    deleteLatestBatch: (type: 'salary' | 'ot', confirmedDate: string) => {
      return client.delete<{ deletedCount: number; deletedDate: string; tableName: 'salary' | 'ot' }>(
        `/api/v1/salary/batch/latest/${type}`,
        { confirmedDate }
      )
    },

    lookupMember: (target: string) => {
      return client.get<{
        id: number
        username: string
        email: string | null
        name: string | null
        department: string | null
        position: string | null
        salary_user: string | null
      } | null>(`/api/v1/salary/member-lookup?target=${encodeURIComponent(target)}`)
    },

    getMemberCredentials: (username: string, email: string) => {
      return client.post<{
        salary_user: string | null
        salary_pass: string | null
      } | null>('/api/v1/salary/member-credentials', { username, email })
    },

    verifyFinanceAccess: (username: string, email: string) => {
      return client.post<{ allowed: boolean; error?: string; status?: number }>(
        '/api/v1/salary/verify-finance-access',
        { username, email }
      )
    },

    getFeatureEnabled: () => {
      return client.get<{ enabled: boolean }>('/api/v1/salary/feature-enabled')
    },

    query: async <T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> => {
      const res = await client.post<{ data: T[]; count: number }>('/api/v1/salary/query', { sql, params })
      return Array.isArray(res) ? res : res.data || []
    },

    /**
     * @deprecated Disabled on Gateway (HTTP 410 Gone). Use named salary methods instead (uploadBatch, deleteLatestBatch, etc.).
     */
    execute: (sql: string, params: unknown[] = []) => {
      return client.post<{ affectedRows: number; insertId: number | null }>('/api/v1/salary/execute', { sql, params })
    },
  }
}
