'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Plus, ArrowLeft, Image, Clock, CheckCircle, X, Printer, Loader2, Info, Edit } from 'lucide-react'
import Link from 'next/link'
import './page.css'

interface PRRequest {
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
  approved_steps: number
  total_steps: number
  requester_name?: string
  requester_position?: string
  requester_signature_path?: string | null
  requester_id?: number
  department?: string
  attachments?: { url: string; filename: string }[]
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
  approver_position: string | null
}

export default function PRRequestsDashboard() {
  const [requests, setRequests] = useState<PRRequest[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [selectedRequest, setSelectedRequest] = useState<PRRequest | null>(null)
  const [approvals, setApprovals] = useState<ApprovalStep[]>([])
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `ใบสั่งงานผลิตสื่อ-PR-${selectedRequest?.id?.toString().padStart(4, '0') ?? ''}`,
    pageStyle: `
      @page { size: A4 portrait; margin: 12mm 12mm 12mm 12mm; }
      body { font-family: 'TH Sarabun New', 'THSarabunNew', 'Sarabun', sans-serif; color: #000; background: #fff !important; }
      @media print {
        .printTemplate {
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          margin: 0 !important;
          width: 100% !important;
          min-height: auto !important;
          height: auto !important;
        }
        .no-print {
          display: none !important;
        }
        .only-print {
          display: block !important;
        }
        .only-print-block {
          display: block !important;
        }
      }
    `,
  })


  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/pr-requests')
      const data = await res.json()
      if (data.success) {
        setRequests(data.requests || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetails = async (req: PRRequest) => {
    try {
      setSelectedRequest(req)
      setLoadingDetail(true)
      setIsModalOpen(true)
      const res = await fetch(`/api/pr-requests/detail?id=${req.id}`)
      const data = await res.json()
      if (data.success) {
        setApprovals(data.approvals || [])
        setSelectedRequest(data.request)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingDetail(false)
    }
  }



  const parseJsonList = (jsonStr: any): string[] => {
    if (!jsonStr) return []
    if (Array.isArray(jsonStr)) return jsonStr
    try {
      return typeof jsonStr === 'string' ? JSON.parse(jsonStr) : []
    } catch {
      return []
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  }

  const getUrgencyClass = (urgency: string) => {
    if (urgency === 'ด่วนที่สุด') return 'critical'
    if (urgency === 'ด่วน') return 'urgent'
    return 'normal'
  }

  const getStatusText = (status: string) => {
    if (status === 'APPROVED') return 'อนุมัติเรียบร้อย'
    if (status === 'REJECTED') return 'ถูกปฏิเสธ'
    return 'รออนุมัติ'
  }

  return (
    <div className="prRequestsContainer">
      <Link href="/member" className="backLink">
        <ArrowLeft size={16} />
        กลับหน้าหลักสมาชิก
      </Link>

      <div className="pageHeader">
        <div>
          <h1>ระบบร้องขอผลิตสื่อประชาสัมพันธ์</h1>
          <p className="pageSubtitle">ส่งคำขอผลิตสื่อประเภทต่างๆ และติดตามขั้นตอนการเซ็นอนุมัติเอกสารออนไลน์</p>
        </div>
        <Link href="/member/pr-requests/new" className="newRequestBtn">
          <Plus size={18} />
          ส่งคำขอผลิตสื่อใหม่
        </Link>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <Loader2 className="animate-spin" size={36} style={{ color: '#0d9488' }} />
        </div>
      ) : requests.length > 0 ? (
        <div className="requestsGrid">
          {requests.map((req) => (
            <div key={req.id} className="requestItemCard">
              <div className="requestInfo">
                <div className="requestMetaHeader">
                  <span className={`urgencyBadge ${getUrgencyClass(req.urgency)}`}>
                    {req.urgency}
                  </span>
                  <span className={`costBadge ${req.has_cost ? '' : 'free'}`}>
                    {req.has_cost ? 'มีค่าใช้จ่าย' : 'ไม่มีค่าใช้จ่าย'}
                  </span>
                </div>
                <h3 className="requestTitle">{req.title}</h3>
                <div className="requestDate">
                  สั่งเมื่อ: {formatDate(req.created_at)} | วันที่รับงาน: {formatDate(req.target_date)}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="requestProgress">
                <span className="progressText">
                  ลงนามแล้ว {req.approved_steps}/{req.total_steps} ขั้นตอน
                </span>
                <div className="progressTrack">
                  <div 
                    className="progressBar" 
                    style={{ width: `${(req.approved_steps / req.total_steps) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <span className={`requestStatusTag ${req.status}`}>
                  {getStatusText(req.status)}
                </span>
              </div>

              <div className="requestActions">
                {req.status === 'PENDING' && (
                  <Link 
                    href={`/member/pr-requests/${req.id}/edit`} 
                    className="actionBtn editBtn"
                    title="แก้ไขใบคำขอ"
                  >
                    <Edit size={18} />
                  </Link>
                )}
                <button 
                  onClick={() => handleViewDetails(req)} 
                  className="actionBtn viewBtn"
                  title="ดูรายละเอียดใบคำขอ"
                >
                  <Info size={18} />
                </button>
                <button 
                  onClick={() => handleViewDetails(req)} 
                  className="actionBtn printBtn"
                  title="พิมพ์เอกสารออกรายงาน"
                >
                  <Printer size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="emptyState">
          <Image size={48} className="emptyIcon" />
          <h3>ไม่พบรายการส่งขอผลิตสื่อ</h3>
          <p>คุณยังไม่ได้ส่งใบคำขอผลิตสื่อประชาสัมพันธ์ในระบบขณะนี้</p>
        </div>
      )}

              {/* Details / Print Modal */}
      {isModalOpen && selectedRequest && (
        <div className="modalOverlay">
          <div className="modalContentCard">
            <div className="modalHeader">
              <div>
                <h2>ตัวอย่างเอกสารใบสั่งงาน</h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>ตรวจสอบข้อมูลก่อนสั่งพิมพ์</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button className="printModalBtn" onClick={handlePrint} disabled={loadingDetail}>
                  <Printer size={16} />
                  พิมพ์ / PDF
                </button>
                <button className="closeBtn" onClick={() => setIsModalOpen(false)}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="modalBody">
              {loadingDetail ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                  <Loader2 className="animate-spin" size={32} style={{ color: '#0d9488' }} />
                </div>
              ) : (
                <div className="printTemplate" ref={printRef}>
                  {/* Document Header */}
                  <div className="docHeader">
                    <div className="docHeaderLeft">
                      <img
                        src="/images/common/logo-website.webp"
                        alt="โลโก้โรงพยาบาลเถิน"
                        className="docHospitalLogo"
                      />
                      <div>
                        <div className="docHospitalName">โรงพยาบาลเถิน</div>
                        <div className="docHospitalSub">กลุ่มงานดิจิทัลทางการแพทย์ · จังหวัดลำปาง</div>
                      </div>
                    </div>
                    <div className="docHeaderRight">
                      <div className="docDocTitle">ใบสั่งงานผลิตสื่อประชาสัมพันธ์</div>
                      <div className="docDocId">เลขที่: PR-{String(selectedRequest.id).padStart(4, '0')}</div>
                      <div className="docDocDate">วันที่: {formatDate(selectedRequest.created_at)}</div>
                    </div>
                  </div>

                  <div className="docDividerThick"></div>

                  {/* Urgency + Cost badges */}
                  <div className="docMetaRow">
                    <div className="docUrgencyGroup">
                      <span className="docFieldLabel">ระดับความเร่งด่วน:</span>
                      {['ด่วนที่สุด', 'ด่วน', 'ไม่ด่วน'].map(u => (
                        <span key={u} className={`docCheckItem ${selectedRequest.urgency === u ? 'checked' : ''}`}>
                          <span className="docCheckBox">{selectedRequest.urgency === u ? '✓' : ''}</span> {u}
                        </span>
                      ))}
                    </div>
                    <div className={`docCostTag ${selectedRequest.has_cost ? 'cost' : 'free'}`}>
                      {selectedRequest.has_cost ? '● มีค่าใช้จ่าย' : '● ไม่มีค่าใช้จ่าย'}
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="docSection">
                    <div className="docSectionLabel">เรื่อง</div>
                    <div className="docSectionContent docSubjectText">{selectedRequest.title}</div>
                  </div>

                  {/* Dates */}
                  <div className="docTwoCol">
                    <div className="docSection">
                      <div className="docSectionLabel">วันที่สั่งงาน</div>
                      <div className="docSectionContent">{selectedRequest.order_date ? formatDate(selectedRequest.order_date) : '—'}</div>
                    </div>
                    <div className="docSection">
                      <div className="docSectionLabel">วันที่ขอรับงาน</div>
                      <div className="docSectionContent">{selectedRequest.target_date ? formatDate(selectedRequest.target_date) : '—'}</div>
                    </div>
                  </div>

                  <div className="docDivider"></div>

                  {/* Job types */}
                  <div className="docSection">
                    <div className="docSectionLabel">ลักษณะงานที่ขอผลิต</div>
                    <div className="docCheckGrid">
                      {['แผ่นพับ 3 พับ', 'บัตรพนักงาน', 'ตัดต่อวิดีโอ', 'AW ขึ้นเว็บไซต์', 'ป้ายประกาศ', 'Power Point', 'สติ๊กเกอร์'].map(type => {
                        const isChecked = parseJsonList(selectedRequest.job_type).includes(type)
                        return (
                          <span key={type} className={`docCheckItem ${isChecked ? 'checked' : ''}`}>
                            <span className="docCheckBox">{isChecked ? '✓' : ''}</span> {type}
                          </span>
                        )
                      })}
                      {(() => {
                        const jobTypeList = parseJsonList(selectedRequest.job_type)
                        const posterItem = jobTypeList.find(t => t.startsWith('โปสเตอร์ขนาด'))
                        const isChecked = !!posterItem
                        const displaySize = posterItem ? posterItem.replace('โปสเตอร์ขนาด', '').trim() : ''
                        return (
                          <span className={`docCheckItem ${isChecked ? 'checked' : ''}`}>
                            <span className="docCheckBox">{isChecked ? '✓' : ''}</span> โปสเตอร์ขนาด{isChecked ? ` ${displaySize}` : ''}
                          </span>
                        )
                      })()}
                      {selectedRequest.job_type_other && (
                        <span className="docCheckItem checked">
                          <span className="docCheckBox">✓</span> อื่นๆ: {selectedRequest.job_type_other}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="docSection">
                    <div className="docSectionLabel">รายละเอียดความต้องการ</div>
                    <div className="docDetailsBox">{selectedRequest.details || 'ไม่ได้ระบุรายละเอียดเพิ่มเติม'}</div>
                  </div>

                  {selectedRequest.attachments && selectedRequest.attachments.length > 0 && (
                    <div className="docSection no-print" style={{ marginTop: '8px' }}>
                      <div className="docSectionLabel">ไฟล์แนบเพิ่มเติม</div>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        marginTop: '4px',
                        padding: '10px 14px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px'
                      }}>
                        {selectedRequest.attachments.map((file, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
                            <span>{file.filename.endsWith('.pdf') ? '📄' : '🖼️'}</span>
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: '#0d9488',
                                textDecoration: 'underline',
                                fontWeight: 600,
                              }}
                            >
                              {file.filename}
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="docDivider"></div>

                  {/* Channels */}
                  <div className="docSection">
                    <div className="docSectionLabel">ช่องทางเผยแพร่</div>
                    <div className="docCheckGrid">
                      {['สื่อโซเชียลของ รพ.', 'Page facebook'].map(ch => {
                        const isChecked = parseJsonList(selectedRequest.channels).includes(ch)
                        return (
                          <span key={ch} className={`docCheckItem ${isChecked ? 'checked' : ''}`}>
                            <span className="docCheckBox">{isChecked ? '✓' : ''}</span> {ch}
                          </span>
                        )
                      })}
                      {(() => {
                        const channelList = parseJsonList(selectedRequest.channels)
                        const hospitalItem = channelList.find(c => c.startsWith('ในอาคารโรงพยาบาลบริเวณ'))
                        const isChecked = !!hospitalItem
                        const val = hospitalItem ? hospitalItem.replace('ในอาคารโรงพยาบาลบริเวณ', '').trim() : ''
                        return (
                          <span className={`docCheckItem ${isChecked ? 'checked' : ''}`}>
                            <span className="docCheckBox">{isChecked ? '✓' : ''}</span> ในอาคารโรงพยาบาลบริเวณ{isChecked ? ` ${val}` : ''}
                          </span>
                        )
                      })()}
                      {(() => {
                        const channelList = parseJsonList(selectedRequest.channels)
                        const communityItem = channelList.find(c => c.startsWith('ในชุมชน'))
                        const isChecked = !!communityItem
                        const val = communityItem ? communityItem.replace('ในชุมชน', '').trim() : ''
                        return (
                          <span className={`docCheckItem ${isChecked ? 'checked' : ''}`}>
                            <span className="docCheckBox">{isChecked ? '✓' : ''}</span> ในชุมชน{isChecked ? ` ${val}` : ''}
                          </span>
                        )
                      })()}
                    </div>
                  </div>

                  <div className="docDivider"></div>

                  {/* Requester info */}
                  <div className="docThreeCol">
                    <div className="docSection">
                      <div className="docSectionLabel">ผู้ขอสั่งผลิต</div>
                      <div className="docSectionContent">{selectedRequest.requester_name || '—'}</div>
                    </div>
                    <div className="docSection">
                      <div className="docSectionLabel">กลุ่มงาน / หน่วยงาน</div>
                      <div className="docSectionContent">{selectedRequest.department || '—'}</div>
                    </div>
                    <div className="docSection">
                      <div className="docSectionLabel">เบอร์โทรติดต่อ</div>
                      <div className="docSectionContent">{selectedRequest.phone || '—'}</div>
                    </div>
                  </div>

                  <div className="docDividerThick"></div>

                  {/* Signature section */}
                  <div className="docSigTitle">การลงนามอนุมัติ</div>
                  <div className="docSignatureRow">
                    {approvals
                      .filter(step => !step.assigned_position.includes('นักประชาสัมพันธ์'))
                      .map((step, idx) => {
                      const isApproved = step.status === 'APPROVED'
                      const isSigned = isApproved && step.signature_path
                      const isRejected = step.status === 'REJECTED'
                      return (
                        <div key={step.id} className={`docSigBox ${isSigned ? 'signed' : ''} ${isRejected ? 'rejected' : ''}`}>
                          <div className="docSigImageArea">
                            {isSigned ? (
                              <img
                                src={`/api/signatures/image?userId=${step.current_approver_id}&t=${Date.now()}`}
                                alt="ลายเซ็น"
                                className="docSigImage"
                              />
                            ) : isApproved ? (
                              <div className="docSigApproved">✓ อนุมัติแล้ว</div>
                            ) : isRejected ? (
                              <div className="docSigRejected">✕ ไม่อนุมัติ</div>
                            ) : (
                              <div className="docSigEmpty"></div>
                            )}
                          </div>
                          <div className="docSigLine"></div>
                          <div className="docSigName">
                            {step.approver_name ? `( ${step.approver_name} )` : '(...........................)'}
                          </div>
                          <div
                            className="docSigPosition"
                            style={step.assigned_position === 'ผู้อำนวยการโรงพยาบาลเถิน' ? { whiteSpace: 'nowrap', wordBreak: 'keep-all' } : {}}
                          >
                            ตำแหน่ง {step.assigned_position}
                          </div>
                          {step.approved_at && (
                            <div className="docSigDate">วันที่: {formatDate(step.approved_at)}</div>
                          )}
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
              )}
            </div>

            <div className="modalFooter">
              <button className="modalCloseBtn" onClick={() => setIsModalOpen(false)}>
                ปิดหน้าต่าง
              </button>
              <button className="modalPrintBtn" onClick={handlePrint} disabled={loadingDetail}>
                <Printer size={16} />
                สั่งพิมพ์ / บันทึก PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
