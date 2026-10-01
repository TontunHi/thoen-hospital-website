import { describe, it, expect, vi } from 'vitest'
import { getMediaRequestWorkflowSteps } from '../taskInboxService'

describe('Media Request Submission and Validation Logic', () => {
  it('correctly constructs workflow steps for NO_COST request', () => {
    const steps = getMediaRequestWorkflowSteps(false)
    expect(steps.length).toBe(3)
    expect(steps.map((s) => s.assignedRole)).toEqual([
      'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์',
      'เจ้าหน้าที่พัสดุ',
      'หัวหน้าเจ้าหน้าที่พัสดุ',
    ])
  })

  it('correctly constructs workflow steps for HAS_COST request including Director', () => {
    const steps = getMediaRequestWorkflowSteps(true)
    expect(steps.length).toBe(4)
    expect(steps.map((s) => s.assignedRole)).toEqual([
      'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์',
      'เจ้าหน้าที่พัสดุ',
      'หัวหน้าเจ้าหน้าที่พัสดุ',
      'ผู้อำนวยการโรงพยาบาลเถิน',
    ])
  })
})
