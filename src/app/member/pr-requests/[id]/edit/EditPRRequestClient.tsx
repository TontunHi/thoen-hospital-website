'use client'

import React from 'react'
import PRRequestForm, { RequesterInfo, PRRequestInitialData } from '@/components/pr-requests/PRRequestForm'
import '../../page.css'

export default function EditPRRequestClient({
  requester,
  request,
}: {
  requester: RequesterInfo
  request: PRRequestInitialData
}) {
  return <PRRequestForm mode="edit" requester={requester} initialData={request} />
}
