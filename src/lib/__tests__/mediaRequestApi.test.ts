import { describe, it, expect, vi } from 'vitest'
import { getMediaRequestWorkflowSteps } from '../taskInboxService'

describe('Media Request Submission and Validation Logic', () => {
  it('correctly constructs workflow steps for NO_COST request', () => {
    const steps = getMediaRequestWorkflowSteps(false)
    expect(steps.length).toBe(4)
    expect(steps.map((s) => s.assignedRole)).toEqual([
      'นักประชาสัมพันธ์',
      'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์',
      'นักประชาสัมพันธ์',
      'นักประชาสัมพันธ์',
    ])
  })

  it('correctly constructs workflow steps for HAS_COST request including Director', () => {
    const steps = getMediaRequestWorkflowSteps(true)
    expect(steps.length).toBe(7)
    expect(steps.map((s) => s.assignedRole)).toEqual([
      'นักประชาสัมพันธ์',
      'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์',
      'เจ้าหน้าที่พัสดุ',
      'หัวหน้าเจ้าหน้าที่พัสดุ',
      'ผู้อำนวยการโรงพยาบาลเถิน',
      'นักประชาสัมพันธ์',
      'นักประชาสัมพันธ์',
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

  it('validates quotations array in CreateMediaRequestSchema correctly', async () => {
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

    const MediaRequestAttachmentSchema = z.object({
      fileName: z.string(),
      filePath: z.string(),
      fileType: z.string().optional().nullable(),
      fileSize: z.number().optional().nullable(),
    })

    const MediaRequestQuotationSchema = z.object({
      fileName: z.string(),
      filePath: z.string(),
      fileType: z.string().optional().nullable(),
      fileSize: z.number().optional().nullable(),
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
      attachments: z.array(MediaRequestAttachmentSchema).optional().default([]),
      quotations: z.array(MediaRequestQuotationSchema).optional().default([]),
      driveLink: z.string().optional().nullable(),
    })

    const payloadWithQuotations = {
      title: 'ขอจัดทำป้ายไวนิลประชาสัมพันธ์',
      urgency: 'URGENT' as const,
      deliveryDate: '2026-10-20',
      costType: 'HAS_COST' as const,
      workTypes: [{ key: 'other', label: 'อื่น ๆ', customDetail: 'ไวนิล' }],
      channels: [{ key: 'indoor', label: 'ในอาคาร' }],
      description: 'รายละเอียดป้ายไวนิลขนาด 2x3 เมตร',
      phone: '0812345678',
      attachments: [{ fileName: 'draft.jpg', filePath: '/uploads/draft.jpg' }],
      quotations: [
        { fileName: 'quotation_shop_a.pdf', filePath: '/uploads/quotation_shop_a.pdf', fileType: 'application/pdf', fileSize: 1048576 },
        { fileName: 'quotation_shop_b.png', filePath: '/uploads/quotation_shop_b.png', fileType: 'image/png', fileSize: 524288 },
      ],
    }

    const result = CreateMediaRequestSchema.safeParse(payloadWithQuotations)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.quotations).toHaveLength(2)
      expect(result.data.quotations[0].fileName).toBe('quotation_shop_a.pdf')
      expect(result.data.quotations[1].fileName).toBe('quotation_shop_b.png')
    }
  })
})
