/**
 * OTP Email Template Generator for Thoen Hospital Member Portal
 * Designed with modern, minimalist visual hierarchy, high contrast, and easy tap-to-copy OTP.
 */

export interface OtpEmailTemplateOptions {
  otp: string
  username: string
  name?: string | null
  expiryMinutes?: number
}

/**
 * Mask citizen ID / username according to hospital PDPA privacy guidelines
 * (Masks all except the last 4 characters if it's a citizen ID)
 */
export function formatMaskedCitizenId(citizenId: string): string {
  if (!citizenId) return '-'
  const clean = citizenId.replace(/\D/g, '')
  if (clean.length === 13) {
    return `x-xxxx-xxxxx-${clean.slice(9, 11)}-${clean.slice(11, 13)}`
  }
  if (citizenId.length > 4) {
    return '•'.repeat(citizenId.length - 4) + citizenId.slice(-4)
  }
  return citizenId
}

/**
 * Generate formatted HTML email content for OTP delivery
 */
export function renderOtpEmailHtml({
  otp,
  username,
  name,
  expiryMinutes = 5,
}: OtpEmailTemplateOptions): string {
  const maskedId = formatMaskedCitizenId(username)
  const displayName = name ? `${name} (${maskedId})` : maskedId

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>รหัสยืนยัน OTP - โรงพยาบาลเถิน</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Sarabun', 'Prompt', sans-serif; -webkit-font-smoothing: antialiased; line-height: 1.6; color: #1E293B;">
  <!-- Preview Text for Email Clients -->
  <div style="display: none; font-size: 1px; color: #F8FAFC; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    รหัส OTP ของท่านคือ ${otp} (ใช้งานได้ใน ${expiryMinutes} นาที) - โรงพยาบาลเถิน
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 36px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04); overflow: hidden;">
          
          <!-- Top Accent Bar -->
          <tr>
            <td style="height: 4px; background: #059669;"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 28px 28px 16px 28px;">
              <div style="font-size: 12px; font-weight: 700; color: #059669; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 6px;">
                THOEN HOSPITAL • โรงพยาบาลเถิน
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #0F172A; letter-spacing: -0.02em;">
                รหัสยืนยันตัวตน (OTP)
              </h1>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 0 28px 24px 28px;">
              <p style="margin: 0 0 12px 0; font-size: 14.5px; color: #475569;">
                เรียน คุณ <strong style="color: #0F172A;">${displayName}</strong>
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #64748B; line-height: 1.55;">
                กรุณาใช้รหัสยืนยัน 6 หลักด้านล่างนี้เพื่อเข้าสู่ระบบสมาชิก โรงพยาบาลเถิน
              </p>

              <!-- Modern Prominent OTP Box -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td align="center" style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 22px 16px;">
                    <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #065F46; line-height: 1; user-select: all; -webkit-user-select: all;">
                      ${otp}
                    </div>
                    <div style="margin-top: 10px; font-size: 12px; color: #059669; font-weight: 600;">
                      แตะหรือดับเบิลคลิกเพื่อคัดลอก (Ready to Copy)
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Expiry & Security Notes -->
              <div style="background-color: #F8FAF9; border: 1px solid #E2E8E4; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px;">
                <div style="font-size: 13px; color: #334155; margin-bottom: 6px;">
                  • รหัสนี้มีอายุการใช้งาน <strong>${expiryMinutes} นาที</strong>
                </div>
                <div style="font-size: 12.5px; color: #64748B; line-height: 1.5;">
                  • <strong>ห้ามเปิดเผยรหัส OTP ให้แก่ผู้อื่นทราบโดยเด็ดขาด</strong> เจ้าหน้าที่ไม่มีนโยบายสอบถามรหัสนี้จากท่าน
                </div>
              </div>

              <p style="margin: 0; font-size: 12px; color: #94A3B8; line-height: 1.5;">
                หากท่านไม่ได้เป็นผู้ทำรายการ สามารถเพิกเฉยต่ออีเมลนี้ได้ บัญชีของท่านยังคงปลอดภัย
              </p>
            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td style="background-color: #F8FAF9; border-top: 1px solid #E2E8E4; padding: 18px 28px; text-align: center;">
              <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 700; color: #475569;">
                โรงพยาบาลเถิน (Thoen Hospital)
              </p>
              <p style="margin: 0; font-size: 11px; color: #94A3B8;">
                อีเมลนี้เป็นการแจ้งเตือนอัตโนมัติจากระบบ กรุณาอย่าตอบกลับ
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Generate formatted Plain Text fallback email content for OTP delivery
 */
export function renderOtpEmailText({
  otp,
  username,
  name,
  expiryMinutes = 5,
}: OtpEmailTemplateOptions): string {
  const maskedId = formatMaskedCitizenId(username)
  const displayName = name ? `${name} (${maskedId})` : maskedId

  return `โรงพยาบาลเถิน (THOEN HOSPITAL)
รหัสยืนยันตัวตน (OTP) สำหรับเข้าสู่ระบบสมาชิก

เรียน คุณ ${displayName}

รหัส OTP ของท่านคือ: ${otp}

- รหัสมีอายุการใช้งาน ${expiryMinutes} นาที
- ห้ามเปิดเผยรหัส OTP ให้แก่ผู้อื่นทราบโดยเด็ดขาด เจ้าหน้าที่ไม่มีนโยบายติดต่อเพื่อขอรหัสนี้จากท่าน

หากท่านไม่ได้ทำรายการนี้ สามารถเพิกเฉยต่ออีเมลนี้ได้
ติดต่อสอบถาม: โทรศัพท์ 054-291316-8
------------------------------------------------------------
* อีเมลนี้เป็นการแจ้งเตือนอัตโนมัติจากระบบ กรุณาอย่าตอบกลับ`
}
