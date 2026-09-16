export type HospitalRole = 'admin' | 'editor' | 'patient' | 'doctor' | 'nurse' | 'hr' | 'member'

export interface Member {
  id: number
  username: string
  name: string
  email: string
  role: HospitalRole
  department?: string
  position?: string
  phone?: string
  signature_path?: string | null
  profile_path?: string | null
  salary_user?: string | null
  created_at?: string
  updated_at?: string
}

export interface MemberSession {
  username: string
  email: string
  role: string
  name?: string
  department?: string
  position?: string
  salary_user?: string | null
}

export interface PositionPermission {
  id?: number
  permission_key: string
  position_name: string
  created_at?: string
}
