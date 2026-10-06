'use client'

import React, { useState, useEffect } from 'react'
import { Printer, ArrowLeft, ShieldCheck, Clock } from 'lucide-react'
import Link from 'next/link'

export default function PrintTaskClient({ taskId }: { taskId: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.body.classList.add('print-document-active')
    return () => {
      document.body.classList.remove('print-document-active')
    }
  }, [])

  useEffect(() => {
    fetch(`/api/member/inbox/${taskId}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setData(json.data)
        }
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false))
  }, [taskId])

  const handlePrint = () => {
    window.print()
  }

  const formatThaiDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    try {
      const cleanStr = dateStr.includes('T') ? dateStr : `${dateStr.replace(/-/g, '/')} 00:00:00`
      const d = new Date(cleanStr)
      if (isNaN(d.getTime())) {
        const fallbackD = new Date(dateStr)
        if (isNaN(fallbackD.getTime())) return dateStr
        return new Intl.DateTimeFormat('th-TH', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(fallbackD)
      }
      return new Intl.DateTimeFormat('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(d)
    } catch {
      return dateStr
    }
  }

  const formatThaiDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    try {
      const d = new Date(dateStr)
      return new Intl.DateTimeFormat('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
    } catch {
      return dateStr
    }
  }

  const formatStepName = (stepName: string | null) => {
    if (!stepName) return ''
    return stepName
      .replace(/\s*ตรวจสอบและมอบหมายงาน/g, '')
      .replace(/\s*ตรวจสอบและ/g, '')
      .replace(/\s*มอบหมายงาน/g, '')
      .trim()
  }

  if (loading) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Clock className="animate-spin text-teal-600 mb-3" size={36} />
        <p style={{ color: '#475569', fontSize: '0.95rem', fontWeight: 500 }}>กำลังเตรียมเอกสารสำหรับพิมพ์...</p>
      </div>
    )
  }

  if (!data?.task) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
        <p style={{ color: '#dc2626', fontWeight: 600 }}>ไม่พบข้อมูลเอกสาร</p>
        <Link href="/member/inbox" style={{ color: '#0d9488', fontSize: '0.9rem', textDecoration: 'underline' }}>
          กลับหน้ารายการ Inbox
        </Link>
      </div>
    )
  }

  const { task, steps, repairDetail } = data
  const isRepair = Boolean(repairDetail)
  const isMediaRequest = task.task_type === 'MEDIA_REQUEST'
  const mediaPrintSteps = isMediaRequest 
    ? steps.filter((st: any) => st.assigned_role !== 'นักประชาสัมพันธ์' && !st.step_name.includes('นักประชาสัมพันธ์'))
    : steps

  const getRepairTitleHeader = () => {
    if (task.task_type === 'IT_REPAIR') return 'ใบแจ้งซ่อมอุปกรณ์คอมพิวเตอร์'
    if (task.task_type === 'MEDICAL_REPAIR') return 'ใบแจ้งซ่อมเครื่องมือทางการแพทย์'
    return 'ใบแจ้งซ่อมอุปกรณ์ทั่วไป'
  }

  const getLearnedRecipient = () => {
    if (task.task_type === 'IT_REPAIR') return 'หัวหน้าศูนย์คอมพิวเตอร์'
    if (task.task_type === 'MEDICAL_REPAIR') return 'หัวหน้าศูนย์เครื่องมือแพทย์'
    return 'หัวหน้างานซ่อมบำรุง'
  }

  return (
    <div className="print-page-wrapper">
      {/* Screen toolbar (hidden when printing) & Global Navbar/Footer Suppressor */}
      <style>{`
        /* Hide global website navbar & footer on screen and print */
        body.print-document-active nav,
        body.print-document-active footer,
        body.print-document-active .navbar,
        body.print-document-active .site-footer,
        body.print-document-active .skip-to-content,
        body.print-document-active #navbar,
        body.print-document-active header.navbar {
          display: none !important;
        }

        @media screen {
          body.print-document-active {
            background-color: #f1f5f9 !important;
          }
          body.print-document-active main,
          body.print-document-active #main-content {
            padding: 0 !important;
            margin: 0 !important;
            min-height: auto !important;
            background-color: #f1f5f9 !important;
          }
          .print-page-wrapper {
            min-height: 100vh;
            background-color: #f1f5f9;
            padding-bottom: 3rem;
          }
        }

        @page {
          size: A4 portrait;
          margin: 0;
        }

        @media print {
          *,
          *::before,
          *::after {
            box-shadow: none !important;
            text-shadow: none !important;
          }

          html,
          body,
          body.print-document-active,
          main,
          #main-content,
          .print-page-wrapper {
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            min-height: 100% !important;
            height: 100% !important;
          }

          .no-print,
          nav,
          footer,
          .navbar,
          .site-footer,
          .skip-to-content,
          header.navbar {
            display: none !important;
          }

          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            min-height: 297mm !important;
            box-sizing: border-box !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background-color: #ffffff !important;
            background: #ffffff !important;
            padding: 12mm 15mm 10mm 15mm !important;
            margin: 0 !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="no-print" style={{ backgroundColor: '#0f172a', padding: '0.75rem 1.5rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href={`/member/inbox/${taskId}`} style={{ color: '#99f6e4', display: 'flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem' }}>
            <ArrowLeft size={16} />
            <span>กลับหน้ารายละเอียด</span>
          </Link>
          <span style={{ color: '#475569' }}>|</span>
          <span style={{ fontSize: '0.875rem', color: '#e2e8f0' }}>
            {isMediaRequest
              ? `แบบฟอร์มขอรับบริการสื่อประชาสัมพันธ์: ${task.task_no}`
              : isRepair
              ? `${getRepairTitleHeader()}: ${task.task_no}`
              : `แบบฟอร์มบันทึกข้อความ: ${task.task_no}`}
          </span>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          style={{ backgroundColor: '#0d9488', color: 'white', padding: '0.5rem 1.25rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.875rem', boxShadow: '0 2px 6px rgba(13,148,136,0.3)' }}
        >
          <Printer size={16} />
          <span>พิมพ์เอกสาร / บันทึก PDF</span>
        </button>
      </div>

      {/* Printable Sheet */}
      <div className="print-container" style={{ maxWidth: '800px', margin: '1.75rem auto', padding: '2rem 2.5rem', backgroundColor: '#ffffff', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', color: '#0f172a', fontFamily: 'Sarabun, "IBM Plex Sans Thai", system-ui, sans-serif' }}>
        
        {isMediaRequest ? (
          /* ── LAYOUT 3: OFFICIAL MEDIA REQUEST FORM (แบบฟอร์มขอรับบริการงานสื่อประชาสัมพันธ์) ── */
          <div>
            {/* Header: Official Hospital Emblem & Thai Formal Document Heading */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '0.65rem', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <img
                  src="/images/common/logo-website.webp"
                  alt="ตราสัญลักษณ์โรงพยาบาลเถิน"
                  style={{ width: '52px', height: '52px', objectFit: 'contain', flexShrink: 0 }}
                />
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    โรงพยาบาลเถิน อำเภอเถิน จังหวัดลำปาง
                  </h2>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0.15rem 0', color: '#0f766e' }}>
                    แบบฟอร์มขอรับบริการงานสื่อประชาสัมพันธ์
                  </h3>
                  <div style={{ fontSize: '0.825rem', color: '#475569', fontWeight: 500 }}>
                    กลุ่มงานดิจิทัลทางการแพทย์ โรงพยาบาลเถิน
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#334155', lineHeight: '1.55', flexShrink: 0, paddingLeft: '0.75rem' }}>
                <div>เลขที่คำขอ: <strong style={{ color: '#0f766e', fontSize: '0.925rem' }}>{task.task_no}</strong></div>
                <div>วันที่ยื่นคำขอ: <strong>{formatThaiDate(task.created_at)}</strong></div>
              </div>
            </div>

            {/* Recipient & Requester */}
            <div style={{ fontSize: '0.875rem', lineHeight: '1.75', marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>
                <strong>เรียน</strong> &nbsp;หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์
              </div>
              <div style={{ textIndent: '2.5rem', marginTop: '0.25rem' }}>
                ด้วยข้าพเจ้า <u>{task.requester_name}</u> &nbsp;กลุ่มงาน/หน่วยงาน <u>{task.requester_dept || 'โรงพยาบาลเถิน'}</u>
                {task.custom_payload?.phone && <span> &nbsp;เบอร์โทรศัพท์ติดต่อ <u>{task.custom_payload.phone}</u></span>}
              </div>
              <div style={{ textIndent: '2.5rem', marginTop: '0.15rem' }}>
                มีความประสงค์ขอความอนุเคราะห์ผลิต/จัดทำสื่อประชาสัมพันธ์ ดังมีรายละเอียดต่อไปนี้
              </div>
            </div>

            {/* Section 1: Subject, Urgency, Delivery Date, Cost Type */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                  <td style={{ padding: '0.45rem 0.5rem', fontWeight: 700, width: '18%', color: '#334155', backgroundColor: '#ffffff', whiteSpace: 'nowrap' }}>
                    เรื่อง / หัวข้องาน
                  </td>
                  <td style={{ padding: '0.45rem 0.5rem', fontWeight: 600, color: '#0f172a' }} colSpan={3}>
                    {task.title}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                  <td style={{ padding: '0.45rem 0.5rem', fontWeight: 700, width: '18%', color: '#334155', backgroundColor: '#ffffff', whiteSpace: 'nowrap' }}>
                    ระดับความเร่งด่วน
                  </td>
                  <td style={{ padding: '0.45rem 0.5rem', width: '44%', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span>[{task.urgency === 'NORMAL' ? ' ✓ ' : '   '}] ไม่ด่วน</span>
                      <span>[{task.urgency === 'URGENT' ? ' ✓ ' : '   '}] ด่วน</span>
                      <span>[{task.urgency === 'VERY_URGENT' ? ' ✓ ' : '   '}] ด่วนที่สุด</span>
                    </span>
                  </td>
                  <td style={{ padding: '0.45rem 0.5rem', fontWeight: 700, width: '18%', color: '#334155', backgroundColor: '#ffffff', whiteSpace: 'nowrap' }}>
                    วันที่ขอรับงานเสร็จ
                  </td>
                  <td style={{ padding: '0.45rem 0.5rem', width: '20%', fontWeight: 600, color: '#0f766e', whiteSpace: 'nowrap' }}>
                    {formatThaiDate(task.custom_payload?.deliveryDate)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                  <td style={{ padding: '0.45rem 0.5rem', fontWeight: 700, width: '18%', color: '#334155', backgroundColor: '#ffffff', whiteSpace: 'nowrap' }}>
                    รูปแบบค่าใช้จ่าย
                  </td>
                  <td style={{ padding: '0.45rem 0.5rem', width: '82%' }} colSpan={3}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2rem' }}>
                      <span>[{task.custom_payload?.costType === 'NO_COST' ? ' ✓ ' : '   '}] <strong>ไม่มีค่าใช้จ่าย</strong></span>
                      <span>[{task.custom_payload?.costType === 'HAS_COST' ? ' ✓ ' : '   '}] <strong>มีค่าใช้จ่าย</strong></span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Section 2: Work Characteristics & Channels */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem', fontSize: '0.825rem' }}>
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '0.35rem', padding: '0.6rem 0.75rem', backgroundColor: '#ffffff' }}>
                <strong style={{ display: 'block', marginBottom: '0.3rem', color: '#0f766e' }}>
                  1. ลักษณะงานที่ขอรับบริการ:
                </strong>
                <ul style={{ margin: 0, paddingLeft: '1.15rem', lineHeight: '1.5' }}>
                  {task.custom_payload?.workTypes && Array.isArray(task.custom_payload.workTypes) && task.custom_payload.workTypes.length > 0 ? (
                    task.custom_payload.workTypes.map((wt: any, idx: number) => (
                      <li key={idx}>
                        <strong>{wt.label}</strong>
                        {wt.customDetail && <span> ({wt.customDetail})</span>}
                      </li>
                    ))
                  ) : (
                    <li>-</li>
                  )}
                </ul>
              </div>

              <div style={{ border: '1px solid #cbd5e1', borderRadius: '0.35rem', padding: '0.6rem 0.75rem', backgroundColor: '#ffffff' }}>
                <strong style={{ display: 'block', marginBottom: '0.3rem', color: '#0f766e' }}>
                  2. ช่องทางที่ต้องการเผยแพร่:
                </strong>
                <ul style={{ margin: 0, paddingLeft: '1.15rem', lineHeight: '1.5' }}>
                  {task.custom_payload?.channels && Array.isArray(task.custom_payload.channels) && task.custom_payload.channels.length > 0 ? (
                    task.custom_payload.channels.map((ch: any, idx: number) => (
                      <li key={idx}>
                        <strong>{ch.label}</strong>
                        {ch.customDetail && <span> ({ch.customDetail})</span>}
                      </li>
                    ))
                  ) : (
                    <li>-</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Section 3: Detailed Specifications */}
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '0.35rem', padding: '0.6rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.825rem', backgroundColor: '#ffffff' }}>
              <strong style={{ display: 'block', marginBottom: '0.3rem', color: '#334155' }}>
                3. รายละเอียดและข้อความที่ต้องการระบุในสื่อ:
              </strong>
              <div style={{ whiteSpace: 'pre-line', lineHeight: '1.5', color: '#1e293b' }}>
                {task.description || '-'}
              </div>
            </div>

            {/* Requester Signature */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '0.75rem 0' }}>
              <div style={{ width: '280px', textAlign: 'center', fontSize: '0.85rem', lineHeight: '1.5' }}>
                {task.requester_signature_path ? (
                  <div style={{ marginBottom: '0.15rem' }}>
                    <div style={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img
                        src={`/api/signatures/image?path=${encodeURIComponent(task.requester_signature_path)}`}
                        alt="ลายเซ็นผู้ยื่นคำขอ"
                        style={{ maxHeight: '42px', maxWidth: '130px', objectFit: 'contain' }}
                      />
                    </div>
                    <div>ลงชื่อ ................................................................</div>
                  </div>
                ) : (
                  <div>ลงชื่อ ................................................................</div>
                )}
                <div style={{ marginTop: '0.15rem' }}>ผู้ยื่นคำขอ</div>
                <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '0.1rem' }}>({task.requester_name})</div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.1rem' }}>วันที่ {formatThaiDate(task.created_at)}</div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1.5px solid #0f172a', margin: '0.75rem 0' }} />

            {/* Section 4: Approval Chains (Digital Signatures - Right Aligned & Clean) */}
            <div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '0 0 0.4rem 0', color: '#0f172a' }}>
                การพิจารณาและลายมือชื่ออิเล็กทรอนิกส์
              </h4>

              {mediaPrintSteps.length === 1 ? (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.35rem' }}>
                  {mediaPrintSteps.map((st: any) => (
                    <div
                      key={st.id}
                      style={{
                        width: '280px',
                        textAlign: 'center',
                        fontSize: '0.825rem',
                        lineHeight: '1.45'
                      }}
                    >
                      {st.comment && st.comment !== 'อนุมัติเรียบร้อย' && st.comment !== 'อนุมัติ/เห็นชอบ' && st.comment !== 'อนุมัติ' && (
                        <div style={{ fontStyle: 'italic', color: '#475569', marginBottom: '0.2rem', fontSize: '0.75rem' }}>
                          "{st.comment}"
                        </div>
                      )}

                      <div style={{ minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0' }}>
                        {st.signature_path ? (
                          <img
                            src={`/api/signatures/image?path=${encodeURIComponent(st.signature_path)}`}
                            alt="ลายเซ็น"
                            style={{ maxHeight: '42px', maxWidth: '130px', objectFit: 'contain' }}
                          />
                        ) : st.status === 'COMPLETED' ? (
                          <div style={{ color: '#0d9488', fontWeight: 700, fontSize: '0.75rem' }}>
                            [ลงนามอิเล็กทรอนิกส์แล้ว]
                          </div>
                        ) : (
                          <div style={{ color: '#94a3b8', borderBottom: '1px dotted #cbd5e1', width: '80%', margin: '0 auto' }}>
                            (รอดำเนินการลงนาม)
                          </div>
                        )}
                      </div>

                      <div>ลงชื่อ ................................................................</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '0.1rem' }}>
                        ({st.action_by_name || st.assigned_to_name || '...................................................'})
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.1rem' }}>
                        {st.assigned_role || st.assigned_to_position || '-'}
                      </div>
                      {st.action_at && (
                        <div style={{ color: '#0d9488', fontSize: '0.725rem', marginTop: '0.1rem', fontWeight: 500 }}>
                          ลงนาม: {formatThaiDateTime(st.action_at)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: mediaPrintSteps.length === 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                  gap: '1rem',
                  marginTop: '0.35rem'
                }}>
                  {mediaPrintSteps.map((st: any) => (
                    <div
                      key={st.id}
                      style={{
                        textAlign: 'center',
                        fontSize: '0.825rem',
                        lineHeight: '1.45'
                      }}
                    >
                      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.2rem' }}>
                        {formatStepName(st.step_name)}
                      </div>
                      {st.comment && st.comment !== 'อนุมัติเรียบร้อย' && st.comment !== 'อนุมัติ/เห็นชอบ' && st.comment !== 'อนุมัติ' && (
                        <div style={{ fontStyle: 'italic', color: '#475569', marginBottom: '0.2rem', fontSize: '0.75rem' }}>
                          "{st.comment}"
                        </div>
                      )}

                      <div style={{ minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.15rem 0' }}>
                        {st.signature_path ? (
                          <img
                            src={`/api/signatures/image?path=${encodeURIComponent(st.signature_path)}`}
                            alt="ลายเซ็น"
                            style={{ maxHeight: '42px', maxWidth: '130px', objectFit: 'contain' }}
                          />
                        ) : st.status === 'COMPLETED' ? (
                          <div style={{ color: '#0d9488', fontWeight: 700, fontSize: '0.75rem' }}>
                            [ลงนามอิเล็กทรอนิกส์แล้ว]
                          </div>
                        ) : (
                          <div style={{ color: '#94a3b8', borderBottom: '1px dotted #cbd5e1', width: '80%', margin: '0 auto' }}>
                            (รอดำเนินการลงนาม)
                          </div>
                        )}
                      </div>

                      <div>ลงชื่อ ................................................................</div>
                      <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '0.1rem' }}>
                        ({st.action_by_name || st.assigned_to_name || '...................................................'})
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.1rem' }}>
                        {st.assigned_role || st.assigned_to_position || '-'}
                      </div>
                      {st.action_at && (
                        <div style={{ color: '#0d9488', fontSize: '0.725rem', marginTop: '0.1rem', fontWeight: 500 }}>
                          ลงนาม: {formatThaiDateTime(st.action_at)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : isRepair ? (
          /* ── LAYOUT 1: HOSPITAL REPAIR FORM (EXACTLY MATCHING document.pdf) ── */
          <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                {getRepairTitleHeader()}
              </h2>
              <div style={{ textAlign: 'right', fontSize: '0.9rem', lineHeight: '1.5' }}>
                <div>ใบแจ้งซ่อมเลขที่ <strong>{task.task_no}</strong></div>
                <div>วันที่ส่งซ่อม <strong>{formatThaiDateTime(task.created_at)}</strong></div>
              </div>
            </div>

            {/* Recipient */}
            <div style={{ fontSize: '1rem', marginBottom: '0.85rem' }}>
              <strong>เรียน</strong> {getLearnedRecipient()}
            </div>

            {/* Section 1: Request Details */}
            <div style={{ fontSize: '0.95rem', lineHeight: '1.9', textIndent: '2.5rem', marginBottom: '1rem' }}>
              ด้วยหน่วยงาน <u>{task.requester_dept || 'โรงพยาบาลเถิน'}</u> สถานที่ <u>{repairDetail?.location_full_name || '-'}</u>
              <br />
              <span style={{ textIndent: 0, display: 'inline-block' }}>
                มีความประสงค์ที่จะทำการซ่อม : <u>{repairDetail?.item_category === 'EQUIPMENT' ? (repairDetail.equipment_name || 'ตามรายการครุภัณฑ์') : (repairDetail?.non_equipment_item || task.title)}</u>
              </span>
              <br />
              <span style={{ textIndent: 0, display: 'inline-block' }}>
                ครุภัณฑ์เลขที่ : <u>{repairDetail?.equipment_number || '-'}</u>
              </span>
              <br />
              <span style={{ textIndent: 0, display: 'inline-block' }}>
                ชื่อครุภัณฑ์ : <u>{repairDetail?.equipment_name || '-'}</u>
              </span>
              <br />
              <span style={{ textIndent: 0, display: 'inline-block' }}>
                สาเหตุ / หรืออาการ : <u>{repairDetail?.symptom_detail || task.description || '-'}</u>
              </span>
            </div>

            {/* Signatures of Requester & Head */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', marginBottom: '1rem' }}>
              <div style={{ width: '280px', textAlign: 'center', fontSize: '0.85rem', lineHeight: '1.5' }}>
                {task.requester_signature_path ? (
                  <div style={{ marginBottom: '0.15rem' }}>
                    <div style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img
                        src={`/api/signatures/image?path=${encodeURIComponent(task.requester_signature_path)}`}
                        alt="ลายเซ็นผู้แจ้งซ่อม"
                        style={{ maxHeight: '46px', maxWidth: '140px', objectFit: 'contain' }}
                      />
                    </div>
                    <div>ลงชื่อ ................................................................</div>
                  </div>
                ) : (
                  <div>ลงชื่อ ................................................................</div>
                )}
                <div style={{ marginTop: '0.15rem' }}>ผู้แจ้งซ่อม</div>
                <div style={{ color: '#334155', fontWeight: 600 }}>({task.requester_name})</div>
                <div style={{ marginTop: '0.85rem' }}>ลงชื่อ ................................................................</div>
                <div style={{ marginTop: '0.15rem' }}>หัวหน้างาน</div>
                <div style={{ color: '#64748b' }}>(................................................................)</div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #94a3b8', margin: '1rem 0 0.75rem 0' }} />

            {/* Section 2: Technician Notes */}
            <div style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>หมายเหตุ</div>
              <div style={{ display: 'flex', gap: '2rem', marginBottom: '0.5rem' }}>
                <div>
                  [{repairDetail?.repair_nature === 'NORMAL' ? ' ✓ ' : '   '}] ส่งซ่อมปกติ
                </div>
                <div>
                  [{repairDetail?.repair_nature === 'RETROACTIVE' ? ' ✓ ' : '   '}] ส่งซ่อมย้อนหลัง ช่างดำเนินการซ่อมให้ก่อน
                </div>
              </div>

              <div style={{ fontWeight: 700, margin: '0.4rem 0' }}>บันทึกงานซ่อม</div>
              <div style={{ display: 'flex', gap: '2rem', marginBottom: '0.4rem' }}>
                <div>
                  ({repairDetail?.cost_type === 'NO_COST' ? ' • ' : '   '}) ไม่มีค่าใช้จ่าย
                </div>
                <div>
                  ({repairDetail?.cost_type === 'HAS_COST' ? ' • ' : '   '}) มีค่าใช้จ่าย มูลค่า : <u>{repairDetail?.cost_amount ? Number(repairDetail.cost_amount).toLocaleString() : '........................'}</u> บาท
                </div>
              </div>

              <div style={{ marginTop: '0.4rem' }}>
                <strong>ปัญหาที่พบในระหว่างการซ่อม :</strong> {repairDetail?.found_problem || '...................................................................................................................................................................'}
              </div>
              <div style={{ marginTop: '0.3rem' }}>
                <strong>กระบวนการ/แนวทางแก้ไข :</strong> {repairDetail?.solution_step || (repairDetail?.is_external_repair ? `ส่งซ่อมภายนอก (${repairDetail?.external_vendor_name || 'ร้านค้าภายนอก'})` : '...................................................................................................................................................................')}
              </div>
            </div>

            {/* Signatures of Technician & Head of Tech */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ textAlign: 'center', width: '45%', fontSize: '0.85rem', lineHeight: '1.5' }}>
                <div>
                  ลงชื่อ ................................................................
                </div>
                <div style={{ marginTop: '0.15rem' }}>ผู้รับซ่อม</div>
                <div style={{ color: '#0f172a', fontWeight: 600, marginTop: '0.15rem' }}>
                  ({repairDetail?.assigned_technician_name || '................................................................'})
                </div>
                {repairDetail?.co_workers && repairDetail.co_workers.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                    ผู้ร่วมงาน: {repairDetail.co_workers.map((cw: any) => cw.name).join(', ')}
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'center', width: '45%', fontSize: '0.85rem', lineHeight: '1.5' }}>
                <div>
                  ลงชื่อ ................................................................
                </div>
                <div style={{ marginTop: '0.15rem' }}>หัวหน้าผู้รับซ่อม</div>
                <div style={{ color: '#64748b', marginTop: '0.15rem' }}>
                  (................................................................)
                </div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #94a3b8', margin: '1.5rem 0 1rem 0' }} />

            {/* Section 3: General Administration & Director Approval */}
            <div style={{ fontSize: '0.9rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>บันทึกฝ่ายบริหารทั่วไป</div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                <div style={{ width: '45%', textAlign: 'center', paddingTop: '3.5rem' }}>
                  <div>ลงชื่อ ................................................................</div>
                  <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>(น.ส.พิณญาดา ดวงสาร)</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>นักจัดการงานทั่วไปปฏิบัติการ</div>
                </div>

                <div style={{ width: '50%', textAlign: 'left', paddingLeft: '1.5rem' }}>
                  <div style={{ marginBottom: '0.35rem' }}>เรียน ผู้อำนวยการโรงพยาบาลเถิน</div>
                  <div style={{ display: 'flex', gap: '1.5rem', margin: '0.35rem 0' }}>
                    <div>[   ] อนุมัติ</div>
                    <div>[   ] ไม่อนุมัติ</div>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <div>ลงชื่อ ................................................................</div>
                    <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>(น.ส.นฤนาท จอมภาปิน)</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>ผู้อำนวยการโรงพยาบาลเถิน</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        ) : (
          /* ── LAYOUT 2: STANDARD MEMO FOR OTHER TASKS ── */
          <div>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>โรงพยาบาลเถิน จังหวัดลำปาง</h2>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#334155', margin: '0.35rem 0' }}>
                บันทึกข้อความ / ใบเสนอความเห็นและลงนามอนุมัติคำร้อง
              </h3>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                เลขที่อ้างอิง: <strong>{task.task_no}</strong> | ประเภท: <strong>{task.task_type}</strong> | วันที่: <strong>{formatThaiDate(task.created_at)}</strong>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem', fontSize: '0.95rem', lineHeight: '1.7' }}>
              <div><strong>เรื่อง:</strong> {task.title}</div>
              <div><strong>เรียน:</strong> ผู้อำนวยการโรงพยาบาลเถิน</div>
              <div><strong>ผู้เสนอคำขอ:</strong> {task.requester_name} ({task.requester_dept || 'บุคลากรโรงพยาบาลเถิน'})</div>
              <div style={{ marginTop: '0.75rem', textIndent: '2.5rem', textAlign: 'justify' }}>
                {task.description || 'ตามที่ข้าพเจ้าได้ยื่นคำร้องผ่านระบบสารสนเทศภายในโรงพยาบาลเถิน ดังปรากฏรายละเอียดข้างต้น จึงใคร่ขอความอนุเคราะห์พิจารณาดำเนินการตามความเหมาะสม'}
              </div>
            </div>

            <div style={{ marginTop: '2.5rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid #cbd5e1', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
                บันทึกการพิจารณาและลายมือชื่ออิเล็กทรอนิกส์ (e-Signature Stamp)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                {steps.map((st: any) => (
                  <div key={st.id} style={{ padding: '0.5rem', textAlign: 'center', backgroundColor: '#ffffff' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', minHeight: '30px' }}>
                      {st.step_name}
                    </div>
                    {st.comment && (
                      <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: '#475569', margin: '0.25rem 0' }}>
                        "{st.comment}"
                      </div>
                    )}
                    <div style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.25rem 0' }}>
                      {st.signature_path ? (
                        <img
                          src={`/api/signatures/image?path=${encodeURIComponent(st.signature_path)}`}
                          alt="Signature"
                          style={{ maxHeight: '44px', maxWidth: '130px', objectFit: 'contain' }}
                        />
                      ) : st.status === 'COMPLETED' ? (
                        <div style={{ color: '#16a34a', fontSize: '0.75rem', fontWeight: 600 }}>
                          [อนุมัติแล้วในระบบ]
                        </div>
                      ) : (
                        <div style={{ color: '#94a3b8', fontSize: '0.75rem', borderBottom: '1px dotted #cbd5e1', width: '80%', margin: '0 auto' }}>
                          (ยังไม่ถึงคิวลงนาม)
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '0.825rem', marginBottom: '0.15rem' }}>
                      ลงชื่อ ................................................................
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>
                      ({st.action_by_name || st.assigned_to_name || '...................................................'})
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>
                      {st.assigned_to_position || st.assigned_role || 'เจ้าหน้าที่ผู้รับผิดชอบ'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
