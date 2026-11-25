'use client'

import React from 'react'
import { RefreshCw, FileText, Plus, MapPin } from 'lucide-react'
import type { BorrowRequestRecord } from './equipmentBorrowTypes'

interface EquipmentMyRequestsTabProps {
  myRequests: BorrowRequestRecord[]
  loading: boolean
  onRefresh: () => void
  onOpenBorrowModal: () => void
  renderStatusBadge: (status: string) => React.ReactNode
}

export function EquipmentMyRequestsTab({
  myRequests,
  loading,
  onRefresh,
  onOpenBorrowModal,
  renderStatusBadge,
}: EquipmentMyRequestsTabProps) {
  return (
    <section>
      <div className="toolbarRow">
        <h2 className="sectionHeading">
          ประวัติและสถานะคำขอยืมของฉัน ({myRequests.length})
        </h2>
        <button type="button" onClick={onRefresh} className="secondaryButton">
          <RefreshCw size={16} strokeWidth={1.5} className={loading ? 'animate-spin' : ''} /> รีเฟรช
        </button>
      </div>

      <div className="tableContainer">
        {myRequests.length === 0 ? (
          <div className="emptyState">
            <FileText size={44} strokeWidth={1.5} className="emptyStateIcon" />
            <p>คุณยังไม่มีประวัติการยื่นคำขอยืมอุปกรณ์</p>
            <button type="button" onClick={onOpenBorrowModal} className="primaryButton emptyStateCta">
              <Plus size={16} strokeWidth={1.5} /> ยื่นคำขอยืมตอนนี้
            </button>
          </div>
        ) : (
          <table className="styledTable">
            <thead>
              <tr>
                <th>เลขที่คำขอ</th>
                <th>วัตถุประสงค์ / สถานที่</th>
                <th>รายการอุปกรณ์ที่ยืม</th>
                <th>วันที่เริ่มยืม</th>
                <th>กำหนดส่งคืน</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {myRequests.map((req) => (
                <tr key={req.id}>
                  <td className="fontSemibold detailMetaValueHighlight tabularNums">{req.requestNo}</td>
                  <td>
                    <div className="fontMedium">{req.purpose}</div>
                    {req.location && (
                      <div className="tableSubMeta inlineIconRow">
                        <MapPin size={12} strokeWidth={1.5} /> {req.location}
                      </div>
                    )}
                  </td>
                  <td>
                    <ul className="tableItemList">
                      {req.items.map((it) => (
                        <li key={it.id}>
                          {it.itemName} × {it.quantity}
                          {it.returnedQty > 0 && <span className="textSuccess returnedInlineTag">(คืนแล้ว {it.returnedQty})</span>}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="tabularNums">{new Date(req.borrowDate).toLocaleDateString('th-TH')}</td>
                  <td className="tabularNums">
                    {req.expectedReturnDate ? (
                      <span className={new Date(req.expectedReturnDate) < new Date() && req.status !== 'RETURNED' ? 'textDanger fontSemibold' : ''}>
                        {new Date(req.expectedReturnDate).toLocaleDateString('th-TH')}
                      </span>
                    ) : (
                      <span className="textMuted">-</span>
                    )}
                  </td>
                  <td>
                    {renderStatusBadge(req.status)}
                    {req.rejectReason && (
                      <div className="rejectReasonText">
                        เหตุผล: {req.rejectReason}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
