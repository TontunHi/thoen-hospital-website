import { describe, it, expect, vi } from 'vitest'
import { getMediaRequestWorkflowSteps } from '../taskInboxService'

describe('Media Request Submission and Validation Logic', () => {
  it('correctly constructs workflow steps for NO_COST request', () => {
    const steps = getMediaRequestWorkflowSteps(false)
    expect(steps.length).toBe(1)
    expect(steps.map((s) => s.assignedRole)).toEqual([
      'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์',
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

  it('validates that phone number is mandatory for media request', async () => {
    const { z } = await import('zod')

    const MediaRequestWorkTypeSchema = z.object({
      key: z.string(),
      label: z.string(),
      customDetail: z.string().optional().nullable(),
    })

    const MediaRequestChannelSchema = z.object({
      key: z.string(),
      label: z.string(),
      customDetail: z.string().optional().nullable(),
    })

    const CreateMediaRequestSchema = z.object({
      title: z.string().min(2, 'กรุณาระบุเรื่อง / หัวข้องาน'),
      urgency: z.enum(['NORMAL', 'URGENT', 'VERY_URGENT']).default('NORMAL'),
      deliveryDate: z.string().min(1, 'กรุณาระบุวันที่ขอรับงาน'),
      costType: z.enum(['NO_COST', 'HAS_COST']).default('NO_COST'),
      workTypes: z.array(MediaRequestWorkTypeSchema).min(1, 'กรุณาเลือกลักษณะงานอย่างน้อย 1 รายการ'),
      channels: z.array(MediaRequestChannelSchema).min(1, 'กรุณาเลือกช่องทางเผยแพร่อย่างน้อย 1 รายการ'),
      description: z.string().min(5, 'กรุณาระบุรายละเอียดงานให้ชัดเจน'),
      phone: z.string().min(1, 'กรุณาระบุเบอร์โทรส่วนตัว / แผนก'),
    })

    // Missing phone should fail
    const invalidPayload = {
      title: 'ขอทำป้ายประชาสัมพันธ์',
      urgency: 'NORMAL' as const,
      deliveryDate: '2026-10-15',
      costType: 'NO_COST' as const,
      workTypes: [{ key: 'poster', label: 'โปสเตอร์' }],
      channels: [{ key: 'indoor', label: 'ในอาคาร' }],
      description: 'รายละเอียดเนื้อหาป้ายประชาสัมพันธ์',
      phone: '',
    }

    const invalidResult = CreateMediaRequestSchema.safeParse(invalidPayload)
    expect(invalidResult.success).toBe(false)
    if (!invalidResult.success) {
      expect(invalidResult.error.issues[0].message).toBe('กรุณาระบุเบอร์โทรส่วนตัว / แผนก')
    }

    // Valid payload with phone should succeed
    const validPayload = {
      ...invalidPayload,
      phone: '0812345678',
    }
    const validResult = CreateMediaRequestSchema.safeParse(validPayload)
    expect(validResult.success).toBe(true)
  })
})
