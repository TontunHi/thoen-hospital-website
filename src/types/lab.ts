export interface LabItem {
  formName: string
  itemName: string
  result?: string | null
  refValue?: string | null
  isOutLab?: 'Y' | 'N'
}

export interface LabDetailResponse {
  success: boolean
  hn: string
  patientName: string
  reported: LabItem[]
  pending: LabItem[]
}

export interface PatientVisit {
  hn: string
  vn?: string
  an?: string
  ptname: string
  cc?: string
  status_name?: string
  clab?: number | null
  clab2?: number | null
}
