'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft, Check, X, Shield, Loader2, AlertCircle,
  User, Building2, Calendar, ShieldCheck, Eye, Printer,
  Clock, CheckCircle2, XCircle, History, Inbox
} from 'lucide-react'
import Link from 'next/link'
import { useReactToPrint } from 'react-to-print'
import './page.css'

interface ApprovalTicket {
  id: number
  source_system: string
  source_id: number
  step_number: number
  assigned_position: string
  status: string
  comment: string | null
  approved_at: string | null
  created_at: string
  req_title: string
  req_urgency: string
  req_created_at: string
  requester_name: string
  requester_dept: string
  has_cost: number
}

interface PRDetail {
  id: number
  title: string
  urgency: string
  order_date: string
  target_date: string
  job_type: string | null
  job_type_other: string | null
  details: string | null
  channels: string | null
  phone: string
  has_cost: number
  status: string
  created_at: string
  requester_name: string
  requester_position: string
  requester_dept: string
  department: string
}

interface ApprovalStep {
  id: number
  step_number: number
  assigned_position: string
  current_approver_id: number | null
  status: string
  comment: string | null
  signature_path: string | null
  approved_at: string | null
  approver_name: string | null
}

type TabType = 'pending' | 'history'

export default function ApprovalsInboxClient() {
  const [tickets, setTickets] = useState<ApprovalTicket[]>([])
  const [history, setHistory] = useState<ApprovalTicket[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [comments, setComments] = useState<Record<number, string>>({})
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedDetail, setSelectedDetail] = useState<PRDetail | null>(null)
  const [detailApprovals, setDetailApprovals] = useState<ApprovalStep[]>([])

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `ใบสั่งงานผลิตสื่อ-PR-${selectedDetail?.id?.toString().padStart(4, '0') ?? ''}`,
    pageStyle: `
      @page { size: A4 portrait; margin: 12mm; }
      body { font-family: 'TH Sarabun New', 'THSarabunNew', 'Sarabun', sans-serif; color: #000; background: #fff !important; }
    `,
  })

  useEffect(() => { fetchApprovals() }, [])

  const fetchApprovals = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/approvals')
      const data = await res.json()
      if (data.success) {
        setTickets(data.tickets || [])
        setHistory(data.history || [])
      }
    } catch (err) {
      console.error(err)
      showStatus('error', 'ไม่สามารถเชื่อมต่อข้อมูลรายการได้')
    } finally {
      setLoading(false)
    }
  }

  const openDetail = async (sourceId: number) => {
    setIsDetailOpen(true)
    setDetailLoading(true)
    setSelectedDetail(null)
    setDetailApprovals([])
    try {
      const res = await fetch(`/api/pr-requests/detail?id=${sourceId}`)
      const data = await res.json()
      if (data.success) {
        setSelectedDetail(data.request)
        setDetailApprovals(data.approvals || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDetailLoading(false)
    }
  }

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatusMsg({ type, message })
    setTimeout(() => setStatusMsg(null), 5000)
  }

  const handleAction = async (ticketId: number, status: 'APPROVED' | 'REJECTED') => {
    if (processingId) return
    if (status === 'REJECTED' && !comments[ticketId]?.trim()) {
      showStatus('error', 'กรุณาระบุความคิดเห็น / เหตุผลกรณีปฏิเสธการอนุมัติ')
      return
    }
    const actionText = status === 'APPROVED' ? 'อนุมัติ' : 'ปฏิเสธ'
    if (!confirm(`ยืนยันว่าต้องการ "${actionText}" รายการนี้ใช่หรือไม่?`)) return

    try {
      setProcessingId(ticketId)
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, status, comment: comments[ticketId] || null }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showStatus('success', `ดำเนินการ${actionText}และประทับตราลายเซ็นเรียบร้อยแล้ว`)
        // Move ticket from pending to history list
        const acted = tickets.find(t => t.id === ticketId)
        if (acted) {
          setHistory(prev => [
            { ...acted, status, approved_at: new Date().toISOString() },
            ...prev,
          ])
        }
        setTickets(prev => prev.filter(t => t.id !== ticketId))
        if (isDetailOpen) setIsDetailOpen(false)
      } else {
        showStatus('error', data.error || 'การดำเนินการไม่สำเร็จ')
      }
    } catch (err) {
      console.error(err)
      showStatus('error', 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setProcessingId(null)
    }
  }

  const handleCommentChange = (ticketId: number, val: string) =>
    setComments(prev => ({ ...prev, [ticketId]: val }))

  const getUrgencyClass = (urgency: string) => {
    if (urgency === 'ด่วนที่สุด') return 'critical'
    if (urgency === 'ด่วน') return 'urgent'
    return 'normal'
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  const formatDateShort = (dateStr: string | null) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear() + 543}`
  }

  const parseJsonList = (jsonStr: string | null): string[] => {
    if (!jsonStr) return []
    try { return JSON.parse(jsonStr) } catch { return [] }
  }

  // ---- Pending Card ----
  const renderPendingCard = (t: ApprovalTicket) => {
    const urgencyClass = getUrgencyClass(t.req_urgency)
    return (
      <div key={t.id} className="approvalItemCard">
        <div className={`cardBand ${urgencyClass}`} />
        <div className="cardBody">
          <div className="approvalMetaHeader">
            <span className="positionTag"><Shield size={10} />{t.assigned_position}</span>
            <span className="stepTag">ขั้นที่ {t.step_number}</span>
            <span className={`urgencyBadge ${urgencyClass}`}>{t.req_urgency}</span>
            <span className={`costBadge ${t.has_cost ? 'hasCost' : 'noCost'}`}>
              {t.has_cost ? '● มีค่าใช้จ่าย' : '● ไม่มีค่าใช้จ่าย'}
            </span>
          </div>
          <h3 className="approvalTitle">{t.req_title}</h3>
          <div className="approvalMeta">
            <span className="metaItem"><User size={13} className="metaIcon" />ผู้ขอ: <strong>{t.requester_name}</strong></span>
            <span className="metaItem"><Building2 size={13} className="metaIcon" />หน่วยงาน: <strong>{t.requester_dept || '—'}</strong></span>
          </div>
          <div className="approvalDate">
            <Calendar size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            ส่งคำขอเมื่อ: {formatDate(t.req_created_at)}
          </div>
          <div className="commentSection">
            <div className="commentLabel">
              ความคิดเห็น / หมายเหตุ
              <span className="commentRequired">* จำเป็นเมื่อปฏิเสธ</span>
            </div>
            <input
              type="text"
              className="commentInput"
              placeholder="ระบุเหตุผลหรือหมายเหตุเพิ่มเติม..."
              value={comments[t.id] || ''}
              onChange={(e) => handleCommentChange(t.id, e.target.value)}
            />
          </div>
        </div>
        <div className="cardFooter">
          <button className="detailBtn" onClick={() => openDetail(t.source_id)}>
            <Eye size={14} />ดูรายละเอียด
          </button>
          <div className="actionBtns">
            <button onClick={() => handleAction(t.id, 'REJECTED')} disabled={processingId !== null} className="rejectBtn">
              <X size={15} />ปฏิเสธ
            </button>
            <button onClick={() => handleAction(t.id, 'APPROVED')} disabled={processingId !== null} className="approveBtn">
              {processingId === t.id ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}
              ลงนามอนุมัติ
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---- History Card ----
  const renderHistoryCard = (t: ApprovalTicket) => {
    const isApproved = t.status === 'APPROVED'
    const urgencyClass = getUrgencyClass(t.req_urgency)
    return (
      <div key={t.id} className={`historyCard ${isApproved ? 'histApproved' : 'histRejected'}`}>
        <div className="histCardLeft">
          <div className={`histStatusIcon ${isApproved ? 'approved' : 'rejected'}`}>
            {isApproved ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
          </div>
        </div>
        <div className="histCardBody">
          <div className="histMetaRow">
            <span className="positionTag"><Shield size={10} />{t.assigned_position}</span>
            <span className="stepTag">ขั้นที่ {t.step_number}</span>
            <span className={`urgencyBadge ${urgencyClass}`}>{t.req_urgency}</span>
            <span className={`histStatusBadge ${isApproved ? 'approved' : 'rejected'}`}>
              {isApproved ? '✓ อนุมัติแล้ว' : '✕ ปฏิเสธ'}
            </span>
          </div>
          <div className="histTitle">{t.req_title}</div>
          <div className="histMeta">
            <span className="metaItem"><User size={12} className="metaIcon" />ผู้ขอ: <strong>{t.requester_name}</strong></span>
            <span className="metaItem"><Building2 size={12} className="metaIcon" />หน่วยงาน: <strong>{t.requester_dept || '—'}</strong></span>
          </div>
          {t.comment && (
            <div className="histComment">
              <span className="histCommentLabel">ความเห็น:</span> {t.comment}
            </div>
          )}
        </div>
        <div className="histCardRight">
          <div className="histDate">
            <Clock size={11} />
            {t.approved_at ? formatDate(t.approved_at) : '—'}
          </div>
          <button className="detailBtn" style={{ marginTop: '8px' }} onClick={() => openDetail(t.source_id)}>
            <Eye size={13} />ดูเอกสาร
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="approvalsContainer">
      <Link href="/member" className="backLink">
        <ArrowLeft size={14} />กลับหน้าหลักสมาชิก
      </Link>

      <div className="pageHeader">
        <div className="pageHeaderText">
          <h1>กล่องงานอนุมัติ</h1>
          <p className="pageSubtitle">รายการเอกสารที่รอลายเซ็นดิจิทัลของคุณ</p>
        </div>
        {!loading && tickets.length > 0 && (
          <div className="ticketCount">
            <ShieldCheck size={14} />
            รอดำเนินการ {tickets.length} รายการ
          </div>
        )}
      </div>

      {statusMsg && (
        <div className={`statusMessage ${statusMsg.type === 'success' ? 'statusSuccess' : 'statusError'}`}>
          {statusMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{statusMsg.message}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="tabBar">
        <button
          className={`tabBtn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <Inbox size={15} />
          รออนุมัติ
          {tickets.length > 0 && <span className="tabBadge">{tickets.length}</span>}
        </button>
        <button
          className={`tabBtn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={15} />
          ประวัติการดำเนินการ
          {history.length > 0 && <span className="tabBadge neutral">{history.length}</span>}
        </button>
      </div>

      {loading ? (
        <div className="loadingWrap">
          <Loader2 className="animate-spin" size={36} style={{ color: '#0d9488' }} />
          <span>กำลังโหลดรายการ...</span>
        </div>
      ) : activeTab === 'pending' ? (
        tickets.length > 0 ? (
          <div className="approvalsList">{tickets.map(renderPendingCard)}</div>
        ) : (
          <div className="emptyState">
            <div className="emptyIconWrap"><Shield size={32} /></div>
            <h3>ไม่มีเอกสารรออนุมัติ</h3>
            <p>กล่องงานอนุมัติว่างเปล่า ขณะนี้ไม่มีรายการที่รอการลงนามของคุณ</p>
          </div>
        )
      ) : (
        history.length > 0 ? (
          <div className="historyList">{history.map(renderHistoryCard)}</div>
        ) : (
          <div className="emptyState">
            <div className="emptyIconWrap" style={{ background: '#f8fafc' }}>
              <History size={32} style={{ color: '#64748b' }} />
            </div>
            <h3>ยังไม่มีประวัติการดำเนินการ</h3>
            <p>รายการที่คุณอนุมัติหรือปฏิเสธแล้วจะแสดงที่นี่</p>
          </div>
        )
      )}

      {/* ===== Detail Modal ===== */}
      {isDetailOpen && (
        <div className="detailOverlay" onClick={() => setIsDetailOpen(false)}>
          <div className="detailModal" onClick={(e) => e.stopPropagation()}>
            <div className="detailModalHeader">
              <div>
                <h2>รายละเอียดคำขอ</h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>ตรวจสอบข้อมูลก่อนลงนาม</p>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {selectedDetail && (
                  <button className="printDetailBtn" onClick={() => handlePrint()}>
                    <Printer size={15} />พิมพ์
                  </button>
                )}
                <button className="detailCloseBtn" onClick={() => setIsDetailOpen(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="detailModalBody">
              {detailLoading ? (
                <div className="loadingWrap">
                  <Loader2 className="animate-spin" size={32} style={{ color: '#0d9488' }} />
                  <span>กำลังโหลดข้อมูล...</span>
                </div>
              ) : selectedDetail ? (
                <div className="printTemplate" ref={printRef}>
                  <div className="docHeader">
                    <div className="docHeaderLeft">
                      <img src="/images/common/logo-website.webp" alt="โลโก้โรงพยาบาลเถิน" className="docHospitalLogo" />
                      <div>
                        <div className="docHospitalName">โรงพยาบาลเถิน</div>
                        <div className="docHospitalSub">กลุ่มงานดิจิทัลทางการแพทย์ · จังหวัดลำปาง</div>
                      </div>
                    </div>
                    <div className="docHeaderRight">
                      <div className="docDocTitle">ใบสั่งงานผลิตสื่อประชาสัมพันธ์</div>
                      <div className="docDocId">เลขที่: PR-{String(selectedDetail.id).padStart(4, '0')}</div>
                      <div className="docDocDate">วันที่: {formatDateShort(selectedDetail.created_at)}</div>
                    </div>
                  </div>
                  <div className="docDividerThick"></div>
                  <div className="docMetaRow">
                    <div className="docUrgencyGroup">
                      <span className="docFieldLabel">ระดับความเร่งด่วน:</span>
                      {['ด่วนที่สุด', 'ด่วน', 'ไม่ด่วน'].map(u => (
                        <span key={u} className={`docCheckItem ${selectedDetail.urgency === u ? 'checked' : ''}`}>
                          <span className="docCheckBox">{selectedDetail.urgency === u ? '✓' : ''}</span> {u}
                        </span>
                      ))}
                    </div>
                    <div className={`docCostTag ${selectedDetail.has_cost ? 'cost' : 'free'}`}>
                      {selectedDetail.has_cost ? '● มีค่าใช้จ่าย' : '● ไม่มีค่าใช้จ่าย'}
                    </div>
                  </div>
                  <div className="docSection">
                    <div className="docSectionLabel">เรื่อง</div>
                    <div className="docSectionContent docSubjectText">{selectedDetail.title}</div>
                  </div>
                  <div className="docTwoCol">
                    <div className="docSection">
                      <div className="docSectionLabel">วันที่สั่งงาน</div>
                      <div className="docSectionContent">{formatDateShort(selectedDetail.order_date)}</div>
                    </div>
                    <div className="docSection">
                      <div className="docSectionLabel">วันที่ขอรับงาน</div>
                      <div className="docSectionContent">{formatDateShort(selectedDetail.target_date)}</div>
                    </div>
                  </div>
                  <div className="docDivider"></div>
                  <div className="docSection">
                    <div className="docSectionLabel">ลักษณะงานที่ขอผลิต</div>
                    <div className="docCheckGrid">
                      {['แผ่นพับ 3 พับ', 'บัตรพนักงาน', 'ตัดต่อวิดีโอ', 'AW ขึ้นเว็บไซต์', 'ป้ายประกาศ', 'Power Point', 'สติ๊กเกอร์'].map(type => {
                        const isChecked = parseJsonList(selectedDetail.job_type).includes(type)
                        return (
                          <span key={type} className={`docCheckItem ${isChecked ? 'checked' : ''}`}>
                            <span className="docCheckBox">{isChecked ? '✓' : ''}</span> {type}
                          </span>
                        )
                      })}
                      {(() => {
                        const list = parseJsonList(selectedDetail.job_type)
                        const item = list.find(t => t.startsWith('โปสเตอร์ขนาด'))
                        const isChecked = !!item
                        const size = item ? item.replace('โปสเตอร์ขนาด', '').trim() : ''
                        return (
                          <span className={`docCheckItem ${isChecked ? 'checked' : ''}`}>
                            <span className="docCheckBox">{isChecked ? '✓' : ''}</span>
                            โปสเตอร์ขนาด{isChecked ? ` ${size}` : ''}
                          </span>
                        )
                      })()}
                      {selectedDetail.job_type_other && (
                        <span className="docCheckItem checked">
                          <span className="docCheckBox">✓</span> อื่นๆ: {selectedDetail.job_type_other}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="docSection">
                    <div className="docSectionLabel">รายละเอียดความต้องการ</div>
                    <div className="docDetailsBox">{selectedDetail.details || 'ไม่ได้ระบุ'}</div>
                  </div>
                  <div className="docDivider"></div>
                  <div className="docSection">
                    <div className="docSectionLabel">ช่องทางเผยแพร่</div>
                    <div className="docCheckGrid">
                      {['สื่อโซเชียลของ รพ.', 'Page facebook'].map(ch => {
                        const isChecked = parseJsonList(selectedDetail.channels).includes(ch)
                        return (
                          <span key={ch} className={`docCheckItem ${isChecked ? 'checked' : ''}`}>
                            <span className="docCheckBox">{isChecked ? '✓' : ''}</span> {ch}
                          </span>
                        )
                      })}
                      {(() => {
                        const list = parseJsonList(selectedDetail.channels)
                        const item = list.find(c => c.startsWith('ในอาคารโรงพยาบาลบริเวณ'))
                        const isChecked = !!item
                        const val = item ? item.replace('ในอาคารโรงพยาบาลบริเวณ', '').trim() : ''
                        return (
                          <span className={`docCheckItem ${isChecked ? 'checked' : ''}`}>
                            <span className="docCheckBox">{isChecked ? '✓' : ''}</span>
                            ในอาคารโรงพยาบาลบริเวณ{isChecked ? ` ${val}` : ''}
                          </span>
                        )
                      })()}
                      {(() => {
                        const list = parseJsonList(selectedDetail.channels)
                        const item = list.find(c => c.startsWith('ในชุมชน'))
                        const isChecked = !!item
                        const val = item ? item.replace('ในชุมชน', '').trim() : ''
                        return (
                          <span className={`docCheckItem ${isChecked ? 'checked' : ''}`}>
                            <span className="docCheckBox">{isChecked ? '✓' : ''}</span>
                            ในชุมชน{isChecked ? ` ${val}` : ''}
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                  <div className="docDivider"></div>
                  <div className="docThreeCol">
                    <div className="docSection">
                      <div className="docSectionLabel">ผู้ขอส่งงาน</div>
                      <div className="docSectionContent">{selectedDetail.requester_name || '—'}</div>
                    </div>
                    <div className="docSection">
                      <div className="docSectionLabel">กลุ่มงาน / หน่วยงาน</div>
                      <div className="docSectionContent">{selectedDetail.requester_dept || selectedDetail.department || '—'}</div>
                    </div>
                    <div className="docSection">
                      <div className="docSectionLabel">เบอร์โทรติดต่อ</div>
                      <div className="docSectionContent">{selectedDetail.phone || '—'}</div>
                    </div>
                  </div>
                  <div className="docDividerThick"></div>
                  <div className="docSigTitle">การลงนามอนุมัติ</div>
                  <div className="docSignatureRow">
                    {detailApprovals.map((step, idx) => {
                      const isSigned = step.status === 'APPROVED' && step.signature_path
                      const isRejected = step.status === 'REJECTED'
                      const isPending = step.status === 'PENDING'
                      return (
                        <div key={step.id} className={`docSigBox ${isSigned ? 'signed' : ''} ${isRejected ? 'rejected' : ''}`}>
                          <div className="docSigImageArea">
                            {isSigned ? (
                              <img src={`/api/signatures/image?userId=${step.current_approver_id}&t=${Date.now()}`} alt="ลายเซ็น" className="docSigImage" />
                            ) : isRejected ? (
                              <div className="docSigRejected">✕ ไม่อนุมัติ</div>
                            ) : isPending ? (
                              <div className="docSigPending"><Clock size={20} style={{ color: '#94a3b8' }} /></div>
                            ) : (
                              <div className="docSigEmpty"></div>
                            )}
                          </div>
                          <div className="docSigLine"></div>
                          <div className="docSigName">
                            {step.approver_name ? `( ${step.approver_name} )` : '(............................................)'}
                          </div>
                          <div className="docSigPosition">ตำแหน่ง {step.assigned_position}</div>
                          {step.approved_at && <div className="docSigDate">วันที่: {formatDateShort(step.approved_at)}</div>}
                          {isPending && <div className="docSigPendingLabel">รอลงนาม</div>}
                        </div>
                      )
                    })}
                  </div>
                  <div className="docFooterNotes">
                    <div className="docNotesTitle">หมายเหตุ :</div>
                    <ol className="docNotesList">
                      <li>งานที่สั่งจะดำเนินการให้ตามลำดับคิวก่อนหลัง</li>
                      <li>กรุณากรอกแบบฟอร์มรายละเอียดให้ครบถ้วนเพื่อความรวดเร็วในการผลิต</li>
                    </ol>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
