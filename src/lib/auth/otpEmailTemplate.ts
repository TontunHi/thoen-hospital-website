/**
 * OTP Email Template Generator for Thoen Hospital Member Portal
 * Modern, calming hospital design (unslop), clear visual hierarchy, accessible, and high inbox compatibility.
 */

export interface OtpEmailTemplateOptions {
  otp: string
  username: string
  name?: string | null
  expiryMinutes?: number
}

/**
 * Mask citizen ID / username according to hospital PDPA privacy guidelines
 * (Masks all except the last 4 characters if it's a 13-digit Thai National ID)
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
 * Compatible with desktop & mobile email clients (Outlook, Gmail, Apple Mail)
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
  <title>รหัสยืนยัน OTP - โรงพยาบาลเถิน</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; line-height: 1.5; color: #1e293b;">
  <!-- Preview text for inbox preview -->
  <div style="display: none; font-size: 1px; color: #f8fafc; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    รหัสยืนยัน OTP คือ ${otp} (ใช้งานได้ใน ${expiryMinutes} นาที) - โรงพยาบาลเถิน
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 36px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 460px; background-color: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);">
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              <!-- Quiet Brand Header -->
              <div style="font-size: 13px; font-weight: 600; color: #0D7446; letter-spacing: 0.3px; margin-bottom: 6px;">
                โรงพยาบาลเถิน
              </div>
              <h1 style="margin: 0 0 16px 0; font-size: 21px; font-weight: 600; color: #0f172a; letter-spacing: -0.01em;">
                รหัสยืนยันเข้าสู่ระบบ
              </h1>
              <p style="margin: 0 0 22px 0; font-size: 14.5px; color: #475569; line-height: 1.6;">
                เรียน คุณ ${displayName}<br>
                กรุณาใช้รหัสยืนยันตัวตน (OTP) ด้านล่างนี้เพื่อเข้าสู่ระบบสมาชิก
              </p>

              <!-- Raised Calm OTP Surface -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 22px;">
                <tr>
                  <td align="center" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 22px 16px;">
                    <div style="font-family: ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace; font-size: 34px; font-weight: 600; letter-spacing: 7px; color: #0D7446; line-height: 1; user-select: all; -webkit-user-select: all;">
                      ${otp}
                    </div>
                    <div style="margin-top: 8px; font-size: 12.5px; color: #15803d; font-weight: 500;">
                      รหัสมีอายุการใช้งาน ${expiryMinutes} นาที
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Notice and Security Notes -->
              <div style="margin-bottom: 22px; font-size: 13px; color: #64748b; line-height: 1.6;">
                <div style="margin-bottom: 5px;">• <strong>ห้ามเปิดเผยรหัส OTP ให้แก่ผู้อื่นทราบโดยเด็ดขาด</strong> เจ้าหน้าที่ไม่มีนโยบายสอบถามรหัสนี้จากท่าน</div>
                <div>• หากท่านไม่ได้เป็นผู้ทำรายการ สามารถละเว้นอีเมลนี้ได้ บัญชีของท่านยังคงปลอดภัย</div>
              </div>

              <!-- Quiet Hairline Divider -->
              <div style="height: 1px; background-color: #e2e8f0; margin-bottom: 18px;"></div>

              <!-- Footer -->
              <div style="font-size: 12px; color: #64748b; line-height: 1.55;">
                กลุ่มงานประกันสุขภาพ ยุทธศาสตร์และสารสนเทศทางการแพทย์ โรงพยาบาลเถิน<br>
                โทรศัพท์ 054-291316-8
              </div>
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

  return `โรงพยาบาลเถิน
รหัสยืนยันเข้าสู่ระบบ

เรียน คุณ ${displayName}

รหัส OTP ของท่านคือ:
${otp}

• รหัสนี้มีอายุการใช้งาน ${expiryMinutes} นาที
• ห้ามเปิดเผยรหัส OTP ให้แก่ผู้อื่นทราบโดยเด็ดขาด เจ้าหน้าที่ไม่มีนโยบายสอบถามรหัสนี้จากท่าน
• หากท่านไม่ได้ทำรายการ สามารถละเว้นอีเมลนี้ได้

กลุ่มงานประกันสุขภาพ ยุทธศาสตร์และสารสนเทศทางการแพทย์ โรงพยาบาลเถิน
โทรศัพท์ 054-291316-8`
}
