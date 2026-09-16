'use client'

import React from 'react'
import PRRequestForm, { RequesterInfo } from '@/components/pr-requests/PRRequestForm'
import '../page.css'

export default function NewPRRequestClient({ requester }: { requester: RequesterInfo }) {
  return <PRRequestForm mode="create" requester={requester} />
}
