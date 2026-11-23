import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import type { OverdueNotificationResult } from './equipmentBorrowTypes'

export async function dispatchOverdueBorrowNotifications(
  db: any,
  queryExecutor: (sql: string, params?: any[]) => Promise<any[]>,
  telegramSender: (chatId: string | number, text: string, options?: any) => Promise<any>,
  options: { siteUrl?: string } = {}
): Promise<OverdueNotificationResult> {
  const siteUrl = (options.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://thlp.moph.go.th').replace(/\/$/, '')
  const detailUrl = `${siteUrl}/member/equipment-borrow`

  const result: OverdueNotificationResult = {
    success: true,
    totalOverdue: 0,
    sentCount: 0,
    skippedNoTelegramCount: 0,
    failedCount: 0,
    timestamp: new Date().toISOString(),
    details: [],
  }

  if (db?.equipmentBorrowRequest) {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const overdueRequests = await db.equipmentBorrowRequest.findMany({
      where: {
        status: { in: ['APPROVED', 'PARTIAL_RETURNED'] },
        expectedReturnDate: { lt: todayStart },
      },
      include: { items: true },
      orderBy: { expectedReturnDate: 'asc' },
    })

    result.totalOverdue = overdueRequests.length

    for (const req of overdueRequests) {
      const remainingItems = (req.items || []).filter(
        (it: any) => (Number(it.quantity || 0) - Number(it.returnedQty || 0)) > 0 && it.status !== 'CONSUMED'
      )
      if (remainingItems.length === 0) continue

      const expDate = req.expectedReturnDate ? new Date(req.expectedReturnDate) : todayStart
      const diffMs = todayStart.getTime() - expDate.getTime()
      const overdueDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)))

      let chatId: string | number | null = null
      if (db.memberTelegramLink) {
        const link = await db.memberTelegramLink.findFirst({ where: { memberId: req.requesterId } })
        chatId = link?.telegramChatId || null
      }

      if (!chatId) {
        result.skippedNoTelegramCount += 1
        result.details.push({
          requestId: req.id,
          requestNo: req.requestNo,
          requesterId: req.requesterId,
          requesterName: req.requesterName,
          requesterDept: req.requesterDept,
          overdueDays,
          expectedReturnDate: req.expectedReturnDate ? new Date(req.expectedReturnDate).toISOString().slice(0, 10) : '-',
          remainingItemsCount: remainingItems.length,
          status: 'SKIPPED_NO_TELEGRAM',
        })
        logger.warn(
          { requestId: req.id, requestNo: req.requestNo, requesterName: req.requesterName },
          'Overdue borrower has not linked Telegram, skipping alert'
        )
        continue
      }

      const formattedExpDate = !isNaN(expDate.getTime())
        ? expDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
        : '-'

      const itemsListHtml = remainingItems.map((it: any) => {
        const remQty = Number(it.quantity || 0) - Number(it.returnedQty || 0)
        const codePill = it.itemCode ? ` (รหัส: ${it.itemCode})` : ''
        return `• <b>${it.itemName}</b>${codePill} — คงค้าง <b>${remQty}</b> ชิ้น`
      }).join('\n')

      const messageHtml = [
        `⚠️ <b>แจ้งเตือน: เกินกำหนดส่งคืนอุปกรณ์/พัสดุ</b>`,
        `โรงพยาบาลเถิน จ.ลำปาง\n`,
        `เรียนคุณ: <b>${req.requesterName}</b> ${req.requesterDept ? `(${req.requesterDept})` : ''}`,
        `เลขที่คำขอ: <code>${req.requestNo}</code>`,
        `วัตถุประสงค์: ${req.purpose}\n`,
        `🔴 <b>สถานะ: เกินกำหนดส่งคืนแล้ว ${overdueDays} วัน</b>`,
        `📅 กำหนดส่งคืนเดิม: ${formattedExpDate}\n`,
        `📦 <b>รายการอุปกรณ์ที่ยังค้างส่งคืน:</b>`,
        itemsListHtml,
        `\nกรุณานำอุปกรณ์ดังกล่าวส่งคืน ณ งานประชาสัมพันธ์ โรงพยาบาลเถิน`,
        `🔗 ดูรายละเอียดคำขอ: <a href="${detailUrl}">${detailUrl}</a>`,
      ].join('\n')

      try {
        await telegramSender(chatId, messageHtml, { parseMode: 'HTML' })
        result.sentCount += 1
        result.details.push({
          requestId: req.id,
          requestNo: req.requestNo,
          requesterId: req.requesterId,
          requesterName: req.requesterName,
          requesterDept: req.requesterDept,
          overdueDays,
          expectedReturnDate: req.expectedReturnDate ? new Date(req.expectedReturnDate).toISOString().slice(0, 10) : '-',
          remainingItemsCount: remainingItems.length,
          status: 'SENT',
        })
      } catch (err: any) {
        result.failedCount += 1
        result.details.push({
          requestId: req.id,
          requestNo: req.requestNo,
          requesterId: req.requesterId,
          requesterName: req.requesterName,
          requesterDept: req.requesterDept,
          overdueDays,
          expectedReturnDate: req.expectedReturnDate ? new Date(req.expectedReturnDate).toISOString().slice(0, 10) : '-',
          remainingItemsCount: remainingItems.length,
          status: 'FAILED',
          error: err.message || String(err),
        })
        logger.error(
          { error: err, requestId: req.id, requestNo: req.requestNo },
          'Failed to dispatch Telegram overdue notification'
        )
      }
    }

    await logAudit(
      'SYSTEM',
      'equipment_borrow_requests',
      JSON.stringify({
        action: 'OVERDUE_NOTIFICATION_DISPATCH',
        totalOverdue: result.totalOverdue,
        sentCount: result.sentCount,
        skippedCount: result.skippedNoTelegramCount,
        failedCount: result.failedCount,
      }),
      { username: 'SYSTEM_CRON', email: 'system@hospital.local' }
    )
    return result
  }

  // Zero-DB Gateway implementation
  const overdueRequests = await queryExecutor(`
    SELECT 
      r.id, r.request_no, r.requester_id, r.requester_name, r.requester_dept,
      r.purpose, r.location, r.borrow_date, r.expected_return_date, r.phone,
      r.status, r.created_at,
      GREATEST(1, DATEDIFF(CURDATE(), r.expected_return_date)) AS overdue_days
    FROM equipment_borrow_requests r
    WHERE r.status IN ('APPROVED', 'PARTIAL_RETURNED')
      AND r.expected_return_date < CURDATE()
    ORDER BY r.expected_return_date ASC
  `)

  result.totalOverdue = overdueRequests.length

  for (const req of overdueRequests) {
    const itemRows = await queryExecutor(`
      SELECT id, item_type, asset_id, material_id, item_name, item_code, quantity, returned_qty, status
      FROM equipment_borrow_items
      WHERE request_id = ?
    `, [req.id])

    const remainingItems = (itemRows || []).filter(
      (it: any) => (Number(it.quantity || 0) - Number(it.returned_qty || 0)) > 0 && it.status !== 'CONSUMED'
    )
    if (remainingItems.length === 0) continue

    const overdueDays = Number(req.overdue_days || 1)
    const expDate = req.expected_return_date ? new Date(req.expected_return_date) : null
    const formattedExpDate = expDate && !isNaN(expDate.getTime())
      ? expDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
      : String(req.expected_return_date || '-')

    const linkRows = await queryExecutor(
      `SELECT telegram_chat_id FROM member_telegram_links WHERE member_id = ? LIMIT 1`,
      [req.requester_id]
    )
    const chatId = linkRows[0]?.telegram_chat_id

    if (!chatId) {
      result.skippedNoTelegramCount += 1
      result.details.push({
        requestId: req.id,
        requestNo: req.request_no,
        requesterId: req.requester_id,
        requesterName: req.requester_name,
        requesterDept: req.requester_dept,
        overdueDays,
        expectedReturnDate: req.expected_return_date ? String(req.expected_return_date).slice(0, 10) : '-',
        remainingItemsCount: remainingItems.length,
        status: 'SKIPPED_NO_TELEGRAM',
      })
      logger.warn(
        { requestId: req.id, requestNo: req.request_no, requesterName: req.requester_name },
        'Overdue borrower has not linked Telegram, skipping alert'
      )
      continue
    }

    const itemsListHtml = remainingItems.map((it: any) => {
      const remQty = Number(it.quantity || 0) - Number(it.returned_qty || 0)
      const codePill = it.item_code ? ` (รหัส: ${it.item_code})` : ''
      return `• <b>${it.item_name}</b>${codePill} — คงค้าง <b>${remQty}</b> ชิ้น`
    }).join('\n')

    const messageHtml = [
      `⚠️ <b>แจ้งเตือน: เกินกำหนดส่งคืนอุปกรณ์/พัสดุ</b>`,
      `โรงพยาบาลเถิน จ.ลำปาง\n`,
      `เรียนคุณ: <b>${req.requester_name}</b> ${req.requester_dept ? `(${req.requester_dept})` : ''}`,
      `เลขที่คำขอ: <code>${req.request_no}</code>`,
      `วัตถุประสงค์: ${req.purpose}\n`,
      `🔴 <b>สถานะ: เกินกำหนดส่งคืนแล้ว ${overdueDays} วัน</b>`,
      `📅 กำหนดส่งคืนเดิม: ${formattedExpDate}\n`,
      `📦 <b>รายการอุปกรณ์ที่ยังค้างส่งคืน:</b>`,
      itemsListHtml,
      `\nกรุณานำอุปกรณ์ดังกล่าวส่งคืน ณ งานประชาสัมพันธ์ โรงพยาบาลเถิน`,
      `🔗 ดูรายละเอียดคำขอ: <a href="${detailUrl}">${detailUrl}</a>`,
    ].join('\n')

    try {
      await telegramSender(chatId, messageHtml, { parseMode: 'HTML' })
      result.sentCount += 1
      result.details.push({
        requestId: req.id,
        requestNo: req.request_no,
        requesterId: req.requester_id,
        requesterName: req.requester_name,
        requesterDept: req.requester_dept,
        overdueDays,
        expectedReturnDate: req.expected_return_date ? String(req.expected_return_date).slice(0, 10) : '-',
        remainingItemsCount: remainingItems.length,
        status: 'SENT',
      })
    } catch (err: any) {
      result.failedCount += 1
      result.details.push({
        requestId: req.id,
        requestNo: req.request_no,
        requesterId: req.requester_id,
        requesterName: req.requester_name,
        requesterDept: req.requester_dept,
        overdueDays,
        expectedReturnDate: req.expected_return_date ? String(req.expected_return_date).slice(0, 10) : '-',
        remainingItemsCount: remainingItems.length,
        status: 'FAILED',
        error: err.message || String(err),
      })
      logger.error(
        { error: err, requestId: req.id, requestNo: req.request_no },
        'Failed to dispatch Telegram overdue notification'
      )
    }
  }

  await logAudit(
    'SYSTEM',
    'equipment_borrow_requests',
    JSON.stringify({
      action: 'OVERDUE_NOTIFICATION_DISPATCH',
      totalOverdue: result.totalOverdue,
      sentCount: result.sentCount,
      skippedCount: result.skippedNoTelegramCount,
      failedCount: result.failedCount,
    }),
    { username: 'SYSTEM_CRON', email: 'system@hospital.local' }
  )

  return result
}
