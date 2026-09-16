export type PRStatus = 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface PRFormData {
  order_date?: string
  orderDate?: string
  target_date?: string
  targetDate?: string
  job_type?: string
  jobType?: string
  job_type_other?: string
  jobTypeOther?: string
  details?: string
  channels?: string[]
  phone?: string
  urgency?: 'NORMAL' | 'URGENT' | 'VERY_URGENT'
}

export interface PRRequest {
  id: number
  requester_id: number
  requester_name?: string
  requester_position?: string
  requester_dept?: string
  requester_signature_path?: string | null
  status: PRStatus
  form_data?: string | PRFormData
  order_date?: string
  target_date?: string
  job_type?: string
  job_type_other?: string
  details?: string
  channels?: string[]
  phone?: string
  urgency?: string
  created_at: string
  updated_at?: string
  attachments?: string[]
}

export type TicketStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WAITING'

export interface ApprovalTicket {
  id: number
  source_system: string
  source_id: number
  step_number: number
  step_name: string
  current_approver_id?: number
  approver_name?: string
  approver_position?: string
  status: TicketStatus
  signature_path?: string | null
  comment?: string | null
  signed_at?: string | null
  created_at: string
}

export interface WorkAssignee {
  id: number
  user_id: number
  name: string
  position: string
  role: 'primary' | 'secondary'
}

export interface WorkRequest {
  id: number
  request_no: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'review' | 'cancelled'
  created_by: number
  creator_name?: string
  creator_position?: string
  creator_department?: string
  assignees?: WorkAssignee[] | string
  attachments?: string[] | string
  status_history?: any[]
  progress_notes?: any[]
  completion?: any
  review?: any
  created_at: string
  updated_at: string
}
