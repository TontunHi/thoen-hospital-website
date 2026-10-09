import { z } from 'zod'

export const vehicleItemSchema = z.object({
  platePrefix: z.string().trim().min(1, 'กรุณาระบุหมวดอักษร เช่น กข'),
  plateNumber: z.string().trim().min(1, 'กรุณาระบุเลขทะเบียน เช่น 1234'),
  province: z.string().trim().min(1, 'กรุณาเลือกจังหวัด'),
})

export type VehicleItem = z.infer<typeof vehicleItemSchema>

export const registrationSchema = z
  .object({
    // Step 1: Personal Info
    citizenId: z
      .string({ error: 'กรุณากรอกเลขบัตรประชาชน' })
      .trim()
      .regex(/^\d{13}$/, 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก'),
    title: z.string({ error: 'กรุณาเลือกคำนำหน้า' }).trim().min(1, 'กรุณาระบุคำนำหน้า'),
    firstNameTh: z
      .string({ error: 'กรุณากรอกชื่อภาษาไทย' })
      .trim()
      .min(1, 'กรุณากรอกชื่อภาษาไทย')
      .max(100, 'ชื่อภาษาไทยยาวเกิน 100 ตัวอักษร'),
    lastNameTh: z
      .string({ error: 'กรุณากรอกนามสกุลภาษาไทย' })
      .trim()
      .min(1, 'กรุณากรอกนามสกุลภาษาไทย')
      .max(100, 'นามสกุลภาษาไทยยาวเกิน 100 ตัวอักษร'),
    firstNameEn: z.string().trim().max(100, 'ชื่อภาษาอังกฤษยาวเกิน 100 ตัวอักษร').optional().nullable(),
    lastNameEn: z.string().trim().max(100, 'นามสกุลภาษาอังกฤษยาวเกิน 100 ตัวอักษร').optional().nullable(),
    nickname: z.string().trim().max(50, 'ชื่อเล่นยาวเกิน 50 ตัวอักษร').optional().nullable(),
    licenseNo: z.string().trim().max(100).optional().nullable(),
    birthDate: z.string({ error: 'กรุณาระบุวันเดือนปีเกิด' }).trim().min(1, 'กรุณาระบุวันเดือนปีเกิด'),

    // Step 2: Work & Position
    startDate: z.string({ error: 'กรุณาระบุวันที่เริ่มปฏิบัติงาน' }).trim().min(1, 'กรุณาระบุวันที่เริ่มปฏิบัติงาน'),
    containDate: z.string().trim().optional().nullable(),
    department: z.string({ error: 'กรุณาเลือกกลุ่มงาน' }).trim().min(1, 'กรุณาเลือกกลุ่มงาน'),
    position: z.string({ error: 'กรุณาเลือกตำแหน่ง' }).trim().min(1, 'กรุณาเลือกตำแหน่ง'),
    level: z.string({ error: 'กรุณาเลือกระดับงาน' }).trim().min(1, 'กรุณาเลือกระดับงาน'),
    personnelGroup: z.string({ error: 'กรุณาเลือกกลุ่มบุคคล' }).trim().min(1, 'กรุณาเลือกกลุ่มบุคคล'),
    personnelGroupOther: z.string().trim().optional().nullable(),

    // Step 3: Contact & HOSxP
    hasHosxp: z.boolean().default(false),
    hosxpUser: z.string().trim().optional().nullable(),
    hosxpPass: z.string().trim().optional().nullable(),
    email: z
      .string({ error: 'กรุณากรอกอีเมล' })
      .trim()
      .max(100, 'อีเมลยาวเกิน 100 ตัวอักษร')
      .email('รูปแบบอีเมลไม่ถูกต้อง'),
    phone: z
      .string({ error: 'กรุณากรอกเบอร์โทรศัพท์' })
      .trim()
      .min(9, 'เบอร์โทรศัพท์ต้องมีอย่างน้อย 9-10 หลัก')
      .max(50, 'เบอร์โทรศัพท์ยาวเกินกำหนด'),
    lineId: z.string().trim().max(100).optional().nullable(),

    // Step 4: Housing & Vehicles
    inHospitalHousing: z.boolean().default(false),
    housingLocation: z.string().trim().optional().nullable(),
    hasVehicle: z.boolean().default(false),
    vehicles: z.array(vehicleItemSchema).optional().nullable(),

    // Step 5: Consent
    consentPolicy: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.hasHosxp) {
      if (!data.hosxpUser || data.hosxpUser.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['hosxpUser'],
          message: 'กรุณากรอกชื่อผู้ใช้งาน HOSxP',
        })
      }
      if (!data.hosxpPass || data.hosxpPass.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['hosxpPass'],
          message: 'กรุณากรอกรหัสผ่านผู้ใช้งาน HOSxP',
        })
      }
    }

    if (data.inHospitalHousing) {
      if (!data.housingLocation || data.housingLocation.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['housingLocation'],
          message: 'กรุณาเลือกบ้านพัก/แฟลตที่พักอาศัย',
        })
      }
    }

    if (data.hasVehicle) {
      if (!data.vehicles || data.vehicles.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['vehicles'],
          message: 'กรุณาระบุข้อมูลรถยนต์อย่างน้อย 1 คัน',
        })
      }
    }
  })

export type RegistrationFormData = z.infer<typeof registrationSchema>
