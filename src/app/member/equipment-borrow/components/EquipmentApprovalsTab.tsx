'use client'

import React from 'react'
import {
  Clock,
  RotateCcw,
  FileText,
  Search,
  RefreshCw,
  CheckCircle2,
  Phone,
  MapPin,
  Check,
  X,
  Package,
  Eye,
} from 'lucide-react'
import type { BorrowRequestRecord } from './equipmentBorrowTypes'

interface EquipmentApprovalsTabProps {
  approvalsSubTab: 'pending' | 'active' | 'all'
  onSubTabChange: (tab: 'pending' | 'active' | 'all') => void
  pendingRequests: BorrowRequestRecord[]
  activeLoans: BorrowRequestRecord[]
  allRequests: BorrowRequestRecord[]
  approvalSearch: string
  onApprovalSearchChange: (val: string) => void
  allRequestsStatusFilter: string
  onAllRequestsStatusFilterChange: (val: string) => void
  loading: boolean
  onRefreshPending: () => void
  onRefreshActive: () => void
  onRefreshAll: () => void
  onApproveRequest: (id: number) => void
  onOpenRejectModal: (data: { id: number; requestNo: string }) => void
  onOpenReturnInspectionModal: (req: BorrowRequestRecord) => void
  onOpenViewDetailModal: (req: BorrowRequestRecord) => void
  renderStatusBadge: (status: string) => React.ReactNode
}

export function EquipmentApprovalsTab({
  approvalsSubTab,
  onSubTabChange,
  pendingRequests,
  activeLoans,
  allRequests,
  approvalSearch,
  onApprovalSearchChange,
  allRequestsStatusFilter,
  onAllRequestsStatusFilterChange,
  loading,
  onRefreshPending,
  onRefreshActive,
  onRefreshAll,
  onApproveRequest,
  onOpenRejectModal,
  onOpenReturnInspectionModal,
  onOpenViewDetailModal,
  renderStatusBadge,
}: EquipmentApprovalsTabProps) {
  return (
    <section>
      {/* Subtabs Bar */}
      <div className="approvalsNavPills">
        <button
          type="button"
          onClick={() => onSubTabChange('pending')}
          className={`approvalsNavPill ${approvalsSubTab === 'pending' ? 'active' : ''}`}
        >
          <Clock size={15} strokeWidth={1.5} />
          <span>รายการรออนุมัติ</span>
          <span className={`pillCount ${pendingRequests.length > 0 ? 'pillCountUrgent' : ''}`}>
            {pendingRequests.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onSubTabChange('active')}
          className={`approvalsNavPill ${approvalsSubTab === 'active' ? 'active' : ''}`}
        >
          <RotateCcw size={15} strokeWidth={1.5} />
          <span>รายการกำลังยืม & ตรวจรับคืน</span>
          <span className={`pillCount ${activeLoans.length > 0 ? 'pillCountInfo' : ''}`}>
            {activeLoans.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onSubTabChange('all')}
          className={`approvalsNavPill ${approvalsSubTab === 'all' ? 'active' : ''}`}
        >
          <FileText size={15} strokeWidth={1.5} />
          <span>ประวัติทุกคำขอ</span>
          <span className="pillCount">{allRequests.length}</span>
        </button>
      </div>

      <div className="toolbarRow">
        <div className="searchBox">
          <Search size={18} strokeWidth={1.5} className="searchIconMuted" />
          <input
            type="text"
            placeholder="ค้นหาเลขที่คำขอ, ชื่อผู้ขอ, วัตถุประสงค์…"
            value={approvalSearch}
            onChange={(e) => onApprovalSearchChange(e.target.value)}
          />
        </div>
        {approvalsSubTab === 'all' && (
          <select
            value={allRequestsStatusFilter}
            onChange={(e) => onAllRequestsStatusFilterChange(e.target.value)}
            className="selectInput filterSelectAuto"
          >
            <option value="ALL">ทุกสถานะ</option>
            <option value="PENDING">รออนุมัติ</option>
            <option value="APPROVED">กำลังยืม</option>
            <option value="PARTIAL_RETURNED">คืนบางส่วน</option>
            <option value="RETURNED">ส่งคืนครบแล้ว</option>
            <option value="REJECTED">ไม่อนุมัติ</option>
          </select>
        )}
        <button
          type="button"
          onClick={approvalsSubTab === 'pending' ? onRefreshPending : approvalsSubTab === 'active' ? onRefreshActive : onRefreshAll}
          className="secondaryButton"
        >
          <RefreshCw size={16} strokeWidth={1.5} className={loading ? 'animate-spin' : ''} /> รีเฟรช
        </button>
      </div>

      <div className="tableContainer">
        {approvalsSubTab === 'pending' ? (
          pendingRequests.length === 0 ? (
            <div className="emptyState">
              <CheckCircle2 size={44} strokeWidth={1.5} className="emptyStateSuccessIcon" />
              <p>ไม่มีคำขอยืมที่รออนุมัติในขณะนี้</p>
            </div>
          ) : (
            <table className="styledTable">
              <thead>
                <tr>
                  <th>เลขที่คำขอ</th>
                  <th>ผู้ขอยืม / แผนก</th>
                  <th>รายการอุปกรณ์</th>
                  <th>วัตถุประสงค์ & สถานที่</th>
                  <th>วันที่ยืม - กำหนดคืน</th>
                  <th className="textRight">ดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map((req) => (
                  <tr key={req.id}>
                    <td className="fontSemibold detailMetaValueHighlight tabularNums">{req.requestNo}</td>
                    <td>
                      <div className="fontMedium">{req.requesterName}</div>
                      <div className="tableSubMeta">{req.requesterDept || '-'}</div>
                      {req.phone && (
                        <div className="tableSubMeta textSuccess inlineIconRow tabularNums">
                          <Phone size={12} strokeWidth={1.5} /> {req.phone}
                        </div>
                      )}
                    </td>
                    <td>
                      <ul className="tableItemList">
                        {req.items.map((it) => (
                          <li key={it.id}>
                            {it.itemName} × {it.quantity}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <div className="fontMedium">{req.purpose}</div>
                      {req.location && (
                        <div className="tableSubMeta inlineIconRow">
                          <MapPin size={12} strokeWidth={1.5} /> {req.location}
                        </div>
                      )}
                    </td>
                    <td className="tabularNums">
                      <div>เริ่ม: {new Date(req.borrowDate).toLocaleDateString('th-TH')}</div>
                      <div className="tableSubMeta">
                        คืน: {req.expectedReturnDate ? new Date(req.expectedReturnDate).toLocaleDateString('th-TH') : '-'}
                      </div>
                    </td>
                    <td className="textRight">
                      <div className="inlineActions">
                        <button
                          type="button"
                          onClick={() => onApproveRequest(req.id)}
                          className="actionBtn actionBtnApprove"
                        >
                          <Check size={14} strokeWidth={1.5} /> อนุมัติ & จ่ายของ
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenRejectModal({ id: req.id, requestNo: req.requestNo })}
                          className="actionBtn actionBtnReject"
                        >
                          <X size={14} strokeWidth={1.5} /> ปฏิเสธ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : approvalsSubTab === 'active' ? (
          activeLoans.length === 0 ? (
            <div className="emptyState">
              <Package size={44} strokeWidth={1.5} className="emptyStateIcon" />
              <p>ไม่มีรายการอุปกรณ์ที่กำลังถูกยืมในขณะนี้</p>
            </div>
          ) : (
            <table className="styledTable">
              <thead>
                <tr>
                  <th>เลขที่คำขอ</th>
                  <th>ผู้ขอยืม</th>
                  <th>รายการอุปกรณ์ (ยืม/คืนแล้ว)</th>
                  <th>กำหนดส่งคืน</th>
                  <th>สถานะ</th>
                  <th className="textRight">ดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {activeLoans.map((req) => {
                  const isOverdue = req.expectedReturnDate && new Date(req.expectedReturnDate) < new Date()
                  return (
                    <tr key={req.id}>
                      <td className="fontSemibold detailMetaValueHighlight tabularNums">{req.requestNo}</td>
                      <td>
                        <div className="fontMedium">{req.requesterName}</div>
                        {req.phone && (
                          <div className="tableSubMeta inlineIconRow tabularNums">
                            <Phone size={12} strokeWidth={1.5} />
                            {req.phone}
                          </div>
                        )}
                      </td>
                      <td>
                        <ul className="tableItemList">
                          {req.items.map((it) => (
                            <li key={it.id}>
                              {it.itemName} : ยืม {it.quantity} (คืนแล้ว {it.returnedQty})
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="tabularNums">
                        <div className={isOverdue ? 'textDanger fontSemibold' : ''}>
                          {req.expectedReturnDate ? new Date(req.expectedReturnDate).toLocaleDateString('th-TH') : '-'}
                        </div>
                        {isOverdue && <span className="statusBadge statusOverdue">เกินกำหนด</span>}
                      </td>
                      <td>{renderStatusBadge(req.status)}</td>
                      <td className="textRight">
                        <button
                          type="button"
                          onClick={() => onOpenReturnInspectionModal(req)}
                          className="actionBtn actionBtnReturn"
                        >
                          <RotateCcw size={14} strokeWidth={1.5} /> ตรวจรับคืนของ
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        ) : (
          allRequests.length === 0 ? (
            <div className="emptyState">
              <FileText size={44} strokeWidth={1.5} className="emptyStateIcon" />
              <p>ไม่พบประวัติคำขอยืมตามเงื่อนไขที่เลือก</p>
            </div>
          ) : (
            <table className="styledTable">
              <thead>
                <tr>
                  <th>เลขที่คำขอ</th>
                  <th>ผู้ขอยืม / แผนก</th>
                  <th>รายการอุปกรณ์</th>
                  <th>วัตถุประสงค์ & สถานที่</th>
                  <th>วันที่ยืม - กำหนดคืน</th>
                  <th>วันที่คืนจริง</th>
                  <th>สถานะ</th>
                  <th className="textRight">ดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {allRequests.map((req) => (
                  <tr key={req.id}>
                    <td className="fontSemibold detailMetaValueHighlight tabularNums">{req.requestNo}</td>
                    <td>
                      <div className="fontMedium">{req.requesterName}</div>
                      <div className="tableSubMeta">{req.requesterDept || '-'}</div>
                      {req.phone && (
                        <div className="tableSubMeta inlineIconRow tabularNums">
                          <Phone size={12} strokeWidth={1.5} />
                          {req.phone}
                        </div>
                      )}
                    </td>
                    <td>
                      <ul className="tableItemList">
                        {req.items.map((it) => (
                          <li key={it.id}>
                            {it.itemName} : ยืม {it.quantity} (คืนแล้ว {it.returnedQty})
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <div className="fontMedium">{req.purpose}</div>
                      {req.location && (
                        <div className="tableSubMeta inlineIconRow">
                          <MapPin size={12} strokeWidth={1.5} /> {req.location}
                        </div>
                      )}
                    </td>
                    <td className="tabularNums">
                      <div>เริ่ม: {new Date(req.borrowDate).toLocaleDateString('th-TH')}</div>
                      <div className="tableSubMeta">
                        คืน: {req.expectedReturnDate ? new Date(req.expectedReturnDate).toLocaleDateString('th-TH') : '-'}
                      </div>
                    </td>
                    <td className="tabularNums">
                      {req.actualReturnDate ? (
                        <span className="textSuccess inlineIconRow">
                          <CheckCircle2 size={14} strokeWidth={1.5} /> {new Date(req.actualReturnDate).toLocaleDateString('th-TH')}
                        </span>
                      ) : (
                        <span className="textMuted">-</span>
                      )}
                    </td>
                    <td>{renderStatusBadge(req.status)}</td>
                    <td className="textRight">
                      <button
                        type="button"
                        onClick={() => onOpenViewDetailModal(req)}
                        className="secondaryButton compactActionBtn"
                      >
                        <Eye size={14} strokeWidth={1.5} /> ดูรายละเอียด
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </section>
  )
}
