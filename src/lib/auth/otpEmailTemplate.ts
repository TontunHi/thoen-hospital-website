/**
 * OTP Email Template Generator for Thoen Hospital Member Portal
 * Designed with modern healthcare visual hierarchy, accessibility, and high contrast.
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
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #F4F7F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Sarabun', 'Prompt', sans-serif; -webkit-font-smoothing: antialiased; line-height: 1.6; color: #1E293B;">
  <!-- Preview Text for Email Clients -->
  <div style="display: none; font-size: 1px; color: #F4F7F5; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    รหัส OTP ของท่านคือ ${otp} (รหัสมีอายุการใช้งาน ${expiryMinutes} นาที) - ระบบบริการสมาชิก โรงพยาบาลเถิน
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F4F7F5; padding: 36px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8E4; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0D7446 0%, #064E3B 100%); padding: 32px 24px; text-align: center;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; padding: 4px 14px; background-color: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 20px; color: #FEF08A; font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 10px;">
                      THOEN HOSPITAL • โรงพยาบาลเถิน
                    </div>
                    <h1 style="margin: 0 0 6px 0; font-size: 24px; font-weight: 800; color: #FFFFFF; letter-spacing: 0.5px;">
                      รหัสยืนยันตัวตน (OTP)
                    </h1>
                    <p style="margin: 0; font-size: 13px; color: #A7F3D0; font-weight: 500;">
                      ระบบบริการบุคลากรและสมาชิก (Member Portal)
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">
                เรียน คุณ <strong style="color: #0F172A; font-size: 16px;">${displayName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                ท่านได้ทำรายการขอรหัสผ่านแบบใช้ครั้งเดียว (One-Time Password) เพื่อเข้าสู่ระบบสมาชิก โรงพยาบาลเถิน กรุณานำรหัสยืนยัน 6 หลักด้านล่างไปกรอกในหน้าต่างเข้าสู่ระบบ:
              </p>

              <!-- OTP Code Display Card -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
                <tr>
                  <td style="background-color: #F0FDF4; border: 2px dashed #0D7446; border-radius: 14px; padding: 24px 16px; text-align: center;">
                    <div style="font-size: 12px; font-weight: 700; color: #065F46; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px;">
                      รหัส OTP ของท่าน (OTP CODE)
                    </div>
                    
                    <!-- Prominent Copyable Code Box -->
                    <div style="background-color: #FFFFFF; border: 1.5px solid #86EFAC; border-radius: 10px; padding: 14px 24px; display: inline-block; box-shadow: 0 4px 12px rgba(13, 116, 70, 0.08); margin-bottom: 12px;">
                      <span style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #0D7446; line-height: 1; display: inline-block; user-select: all; -webkit-user-select: all;">
                        ${otp}
                      </span>
                    </div>

                    <!-- Quick Copy Hint -->
                    <div>
                      <span style="display: inline-block; background-color: #DCFCE7; border: 1px solid #86EFAC; color: #166534; font-size: 12px; font-weight: 600; padding: 4px 14px; border-radius: 20px;">
                        📋 ดับเบิลคลิกหรือแตะค้างที่ตัวเลขเพื่อคัดลอก (Ready to Copy)
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Expiry Alert -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background-color: #FEF3C7; border: 1px solid #FDE68A; border-radius: 10px; padding: 12px 16px;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="24" valign="top" style="font-size: 16px; line-height: 1.4;">⏱️</td>
                        <td style="font-size: 13.5px; color: #92400E; line-height: 1.5; padding-left: 8px;">
                          <strong>ระยะเวลาการใช้งาน:</strong> รหัสนี้มีอายุการใช้งาน <strong>${expiryMinutes} นาที</strong> (จะหมดอายุโดยอัตโนมัติ)
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8FAF9; border: 1px solid #E2E8E4; border-radius: 10px; padding: 16px; margin-bottom: 10px;">
                <tr>
                  <td>
                    <div style="font-size: 13px; font-weight: 700; color: #1E293B; margin-bottom: 8px;">
                      🔒 ข้อควรระวังด้านความปลอดภัย (Security Notice)
                    </div>
                    <ul style="margin: 0; padding-left: 18px; font-size: 12.5px; color: #64748B; line-height: 1.6;">
                      <li style="margin-bottom: 4px;"><strong>ห้ามเปิดเผยรหัส OTP ให้แก่ผู้อื่นทราบโดยเด็ดขาด</strong></li>
                      <li style="margin-bottom: 4px;">เจ้าหน้าที่โรงพยาบาลเถินไม่มีนโยบายโทรศัพท์หรือส่งข้อความเพื่อขอรหัส OTP จากท่านในทุกกรณี</li>
                      <li>หากท่านไม่ได้เป็นผู้ทำรายการนี้ โปรดเพิกเฉยต่ออีเมลฉบับนี้ หรือติดต่อศูนย์เทคโนโลยีสารสนเทศทันที</li>
                    </ul>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td style="background-color: #F8FAF9; border-top: 1px solid #E2E8E4; padding: 24px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #334155;">
                โรงพยาบาลเถิน (Thoen Hospital)
              </p>
              <p style="margin: 0 0 12px 0; font-size: 12px; color: #64748B; line-height: 1.5;">
                111 หมู่ 7 ถนนพหลโยธิน ต.ล้อมแรด อ.เถิน จ.ลำปาง 52160<br>
                โทรศัพท์: 054-291316-8 ต่อ งานเทคโนโลยีสารสนเทศ
              </p>
              <p style="margin: 0; font-size: 11.5px; color: #94A3B8;">
                * อีเมลนี้เป็นการแจ้งเตือนอัตโนมัติจากระบบ กรุณาอย่าตอบกลับ (This is an automated notification, please do not reply.)
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

  return `============================================================
              โรงพยาบาลเถิน (THOEN HOSPITAL)
       รหัสยืนยันตัวตน (OTP) สำหรับเข้าสู่ระบบสมาชิก
============================================================

เรียน คุณ ${displayName}

ท่านได้ทำรายการขอรหัสผ่านแบบใช้ครั้งเดียว (One-Time Password - OTP)
สำหรับเข้าสู่ระบบสมาชิก โรงพยาบาลเถิน

------------------------------------------------------------
>> รหัสยืนยัน OTP ของท่าน:  ${otp}  <<
------------------------------------------------------------
(คัดลอกรหัสตัวเลข 6 หลักด้านบน เพื่อนำไปกรอกในระบบ)

⏱️ ระยะเวลาการใช้งาน: รหัสนี้มีอายุการใช้งาน ${expiryMinutes} นาที
🔒 ความปลอดภัย: ห้ามเปิดเผยรหัส OTP ให้แก่บุคคลอื่นโดยเด็ดขาด
   เจ้าหน้าที่โรงพยาบาลไม่มีนโยบายติดต่อเพื่อขอรหัสนี้จากท่านในทุกกรณี

หากท่านไม่ได้เป็นผู้ทำรายการ โปรดติดต่อ:
ศูนย์เทคโนโลยีสารสนเทศ โรงพยาบาลเถิน
โทรศัพท์: 054-291316-8
============================================================
* อีเมลฉบับนี้เป็นการแจ้งเตือนอัตโนมัติจากระบบ กรุณาอย่าตอบกลับ`
}
