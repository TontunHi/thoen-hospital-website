import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { redirect } from 'next/navigation'
import EditPRRequestClient from './EditPRRequestClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditPRRequestPage({ params }: PageProps) {
  const session = await verifyMemberSession()

  if (!session) {
    redirect('/member/login')
  }

  const { id } = await params

  // Get member details
  const members = await queryMemberDb(
    'SELECT id, name, department, position, username FROM members WHERE username = ? AND email = ? LIMIT 1',
    [session.username, session.email]
  )

  if (members.length === 0) {
    redirect('/member/login')
  }

  const requester = members[0]

  // Get the request details
  const requests = await queryMemberDb(
    'SELECT * FROM pr_requests WHERE id = ? LIMIT 1',
    [id]
  )

  if (requests.length === 0) {
    redirect('/member/pr-requests')
  }

  const request = requests[0]

  // Verify ownership or PR Officer (นักประชาสัมพันธ์) access
  const isPrOfficer = requester.position && requester.position.includes('นักประชาสัมพันธ์')
  if (request.requester_id !== requester.id && !isPrOfficer) {
    redirect('/member/pr-requests')
  }

  // Verify status is PENDING
  if (request.status !== 'PENDING') {
    redirect('/member/pr-requests')
  }

  // Parse form_data JSON if exists
  let parsedRequest = { ...request }
  if (request.form_data) {
    try {
      const formData = typeof request.form_data === 'string' ? JSON.parse(request.form_data) : request.form_data
      parsedRequest = {
        ...parsedRequest,
        ...formData
      }
    } catch (e) {
      console.error('Failed to parse form_data JSON on edit page load', e)
    }
  }

  // Remove form_data raw key before passing to client component
  delete parsedRequest.form_data

  // Normalize both snake_case and camelCase to prevent data loss in components
  const orderDate = parsedRequest.orderDate || parsedRequest.order_date
  const targetDate = parsedRequest.targetDate || parsedRequest.target_date
  const jobType = parsedRequest.jobType || parsedRequest.job_type || []
  const jobTypeOther = parsedRequest.jobTypeOther || parsedRequest.job_type_other || null
  const details = parsedRequest.details
  const channels = parsedRequest.channels || []
  const phone = parsedRequest.phone

  // Normalize date fields to string 'YYYY-MM-DD'
  const formatDate = (val: any) => {
    if (!val) return ''
    if (val instanceof Date) return val.toISOString().split('T')[0]
    if (typeof val === 'string') return val.split('T')[0]
    return String(val)
  }

  parsedRequest.orderDate = formatDate(orderDate)
  parsedRequest.targetDate = formatDate(targetDate)
  parsedRequest.jobType = Array.isArray(jobType) ? jobType : []
  parsedRequest.jobTypeOther = jobTypeOther
  parsedRequest.channels = Array.isArray(channels) ? channels : []
  parsedRequest.details = details
  parsedRequest.phone = phone

  return <EditPRRequestClient requester={requester} request={parsedRequest} />
}
