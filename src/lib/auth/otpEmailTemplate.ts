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
  <title>รหัสยืนยัน OTP - โรงพยาบาลเถิน</title>
</head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; line-height: 1.5; color: #171717;">
  <!-- Preview text for inbox preview -->
  <div style="display: none; font-size: 1px; color: #fafafa; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    รหัสยืนยัน OTP คือ ${otp} (ใช้งานได้ใน ${expiryMinutes} นาที) - โรงพยาบาลเถิน
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fafafa; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 460px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e5e5;">
          <tr>
            <td style="padding: 32px 32px 28px 32px;">
              <div style="font-size: 13px; color: #737373; margin-bottom: 8px;">
                โรงพยาบาลเถิน
              </div>
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 500; color: #171717; letter-spacing: -0.01em;">
                รหัสยืนยันเข้าสู่ระบบ
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #525252; line-height: 1.6;">
                เรียน คุณ ${displayName}<br>
                กรุณาใช้รหัสยืนยันตัวตนด้านล่างนี้เพื่อเข้าสู่ระบบสมาชิก
              </p>

              <!-- Raised OTP Surface -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center" style="background-color: #f4f4f5; border: 1px solid #e5e5e5; border-radius: 8px; padding: 24px 16px;">
                    <div style="font-family: ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace; font-size: 34px; font-weight: 500; letter-spacing: 6px; color: #171717; line-height: 1; user-select: all; -webkit-user-select: all;">
                      ${otp}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Notice and Security Notes -->
              <div style="margin-bottom: 24px; font-size: 13px; color: #737373; line-height: 1.6;">
                <div style="margin-bottom: 4px;">• รหัสนี้มีอายุการใช้งาน ${expiryMinutes} นาที</div>
                <div style="margin-bottom: 4px;">• ห้ามเปิดเผยรหัส OTP ให้แก่ผู้อื่นทราบโดยเด็ดขาด เจ้าหน้าที่ไม่มีนโยบายสอบถามรหัสนี้จากท่าน</div>
                <div>• หากท่านไม่ได้ทำรายการ สามารถละเว้นอีเมลนี้ได้</div>
              </div>

              <!-- Quiet Divider -->
              <div style="height: 1px; background-color: #e5e5e5; margin-bottom: 20px;"></div>

              <!-- Footer -->
              <div style="font-size: 12px; color: #737373; line-height: 1.5;">
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
