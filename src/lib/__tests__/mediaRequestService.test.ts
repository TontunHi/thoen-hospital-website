import { describe, it, expect } from 'vitest'
import {
  getMediaRequestWorkflowSteps,
  REGISTERED_TASK_TYPES,
  MEDIA_REQUEST_ROLES,
} from '../taskInboxService'

describe('MEDIA_REQUEST Workflow Configuration', () => {
  it('registers MEDIA_REQUEST task type with PR prefix', () => {
    const config = REGISTERED_TASK_TYPES.MEDIA_REQUEST
    expect(config).toBeDefined()
    expect(config.titlePrefix).toBe('PR')
    expect(config.name).toBe('งานขอสื่อประชาสัมพันธ์')
  })

  it('generates 2 steps when hasCost is false (NO_COST)', () => {
    const steps = getMediaRequestWorkflowSteps(false)
    expect(steps).toHaveLength(2)

    expect(steps[0].stepNo).toBe(1)
    expect(steps[0].assignedRole).toBe(MEDIA_REQUEST_ROLES.PR_OFFICER)
    expect(steps[0].stepName).toContain('นักประชาสัมพันธ์')

    expect(steps[1].stepNo).toBe(2)
    expect(steps[1].assignedRole).toBe(MEDIA_REQUEST_ROLES.DIGITAL_HEAD)
    expect(steps[1].stepName).toContain('หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์')
  })

  it('generates 5 steps including PR, Digital Head, Procurement and Hospital Director when hasCost is true (HAS_COST)', () => {
    const steps = getMediaRequestWorkflowSteps(true)
    expect(steps).toHaveLength(5)

    expect(steps[0].assignedRole).toBe(MEDIA_REQUEST_ROLES.PR_OFFICER)
    expect(steps[1].assignedRole).toBe(MEDIA_REQUEST_ROLES.DIGITAL_HEAD)
    expect(steps[2].assignedRole).toBe(MEDIA_REQUEST_ROLES.PROCUREMENT_OFFICER)
    expect(steps[3].assignedRole).toBe(MEDIA_REQUEST_ROLES.PROCUREMENT_HEAD)

    expect(steps[4].stepNo).toBe(5)
    expect(steps[4].assignedRole).toBe(MEDIA_REQUEST_ROLES.DIRECTOR)
    expect(steps[4].stepName).toContain('ผู้อำนวยการโรงพยาบาลเถิน')
  })

  it('generates unique cryptographic signature stamp hash for approver', async () => {
    const { generateSignatureStampHash } = await import('../taskInboxService')
    const hash = generateSignatureStampHash({
      taskId: 'pr-task-1',
      stepNo: 1,
      signerId: 15,
      timestamp: '2026-09-30T13:00:00Z',
    })
    expect(hash).toBeDefined()
    expect(hash.length).toBe(64)
  })

  it('exports media request telegram notification functions', async () => {
    const {
      notifyMediaRequestCreatedRequesterOnTelegram,
      notifyMediaRequestStepApprovedOnTelegram,
      notifyMediaRequestRejectedOrSentBackOnTelegram,
    } = await import('../taskInboxService')

    expect(typeof notifyMediaRequestCreatedRequesterOnTelegram).toBe('function')
    expect(typeof notifyMediaRequestStepApprovedOnTelegram).toBe('function')
    expect(typeof notifyMediaRequestRejectedOrSentBackOnTelegram).toBe('function')
  })
})
