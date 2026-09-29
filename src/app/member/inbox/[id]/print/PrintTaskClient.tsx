'use client'

import React, { useState, useEffect } from 'react'
import { Printer, ArrowLeft, ShieldCheck, Clock } from 'lucide-react'
import Link from 'next/link'

export default function PrintTaskClient({ taskId }: { taskId: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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
      const d = new Date(dateStr)
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

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <Clock className="animate-spin mx-auto text-blue-600 mb-2" size={32} />
        <p>กำลังเตรียมเอกสารสำหรับพิมพ์...</p>
      </div>
    )
  }

  if (!data?.task) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>ไม่พบข้อมูลเอกสาร</div>
  }

  const { task, steps, repairDetail } = data
  const isRepair = Boolean(repairDetail)

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
    <div>
      {/* Screen toolbar (hidden when printing) */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background-color: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
        @page {
          size: A4 portrait;
          margin: 1.5cm;
        }
      `}</style>

      <div className="no-print" style={{ backgroundColor: '#1e293b', padding: '0.75rem 1.5rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href={`/member/inbox/${taskId}`} style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}>
            <ArrowLeft size={16} />
            กลับหน้ารายละเอียด
          </Link>
          <span style={{ color: '#94a3b8' }}>|</span>
          <span style={{ fontSize: '0.9rem' }}>
            {isRepair ? `${getRepairTitleHeader()}: ${task.task_no}` : `แบบฟอร์มบันทึกข้อความ: ${task.task_no}`}
          </span>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          style={{ backgroundColor: '#2563eb', color: 'white', padding: '0.5rem 1.25rem', borderRadius: '0.35rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
        >
          <Printer size={16} />
          สั่งพิมพ์เอกสาร (Print / PDF)
        </button>
      </div>

      {/* Printable Sheet */}
      <div className="print-container" style={{ maxWidth: '800px', margin: '2rem auto', padding: '2.5rem', backgroundColor: 'white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', color: '#0f172a', fontFamily: 'Sarabun, "IBM Plex Sans Thai", system-ui, sans-serif' }}>
        
        {isRepair ? (
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ width: '300px', textAlign: 'center', fontSize: '0.9rem', lineHeight: '1.8' }}>
                <div>ลงชื่อ ................................................................ ผู้แจ้งซ่อม</div>
                <div style={{ color: '#334155' }}>({task.requester_name})</div>
                <div style={{ marginTop: '1.5rem' }}>ลงชื่อ ................................................................ หัวหน้างาน</div>
                <div style={{ color: '#64748b' }}>(................................................................)</div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #94a3b8', margin: '1.5rem 0 1rem 0' }} />

            {/* Section 2: Technician Notes */}
            <div style={{ fontSize: '0.9rem', lineHeight: '1.7' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>หมายเหตุ</div>
              <div style={{ display: 'flex', gap: '2rem', marginBottom: '0.75rem' }}>
                <div>
                  [{repairDetail?.repair_nature === 'NORMAL' ? ' ✓ ' : '   '}] ส่งซ่อมปกติ
                </div>
                <div>
                  [{repairDetail?.repair_nature === 'RETROACTIVE' ? ' ✓ ' : '   '}] ส่งซ่อมย้อนหลัง ช่างดำเนินการซ่อมให้ก่อน
                </div>
              </div>

              <div style={{ fontWeight: 700, margin: '0.5rem 0' }}>บันทึกงานซ่อม</div>
              <div style={{ display: 'flex', gap: '2rem', marginBottom: '0.5rem' }}>
                <div>
                  ({repairDetail?.cost_type === 'NO_COST' ? ' • ' : '   '}) ไม่มีค่าใช้จ่าย
                </div>
                <div>
                  ({repairDetail?.cost_type === 'HAS_COST' ? ' • ' : '   '}) มีค่าใช้จ่าย มูลค่า : <u>{repairDetail?.cost_amount ? Number(repairDetail.cost_amount).toLocaleString() : '........................'}</u> บาท
                </div>
              </div>

              <div style={{ marginTop: '0.5rem' }}>
                <strong>ปัญหาที่พบในระหว่างการซ่อม :</strong> {repairDetail?.found_problem || '...................................................................................................................................................................'}
              </div>
              <div style={{ marginTop: '0.35rem' }}>
                <strong>กระบวนการ/แนวทางแก้ไข :</strong> {repairDetail?.solution_step || (repairDetail?.is_external_repair ? `ส่งซ่อมภายนอก (${repairDetail?.external_vendor_name || 'ร้านค้าภายนอก'})` : '...................................................................................................................................................................')}
              </div>
            </div>

            {/* Signatures of Technician & Head of Tech */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '2.5rem', marginBottom: '1.5rem' }}>
              <div style={{ textAlign: 'center', width: '45%', fontSize: '0.9rem' }}>
                <div>
                  ลงชื่อ ................................................................ ผู้รับซ่อม
                </div>
                <div style={{ color: '#0f172a', fontWeight: 600, marginTop: '0.35rem' }}>
                  ({repairDetail?.assigned_technician_name || '................................................................'})
                </div>
                {repairDetail?.co_workers && repairDetail.co_workers.length > 0 && (
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                    ผู้ร่วมงาน: {repairDetail.co_workers.map((cw: any) => cw.name).join(', ')}
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'center', width: '45%', fontSize: '0.9rem' }}>
                <div>
                  ลงชื่อ ................................................................ หัวหน้าผู้รับซ่อม
                </div>
                <div style={{ color: '#64748b', marginTop: '0.35rem' }}>
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
                  <div key={st.id} style={{ border: '1px solid #cbd5e1', borderRadius: '0.35rem', padding: '1rem', textAlign: 'center', backgroundColor: '#ffffff' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', minHeight: '38px' }}>
                      {st.step_name}
                    </div>
                    {st.comment && (
                      <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: '#475569', margin: '0.5rem 0' }}>
                        "{st.comment}"
                      </div>
                    )}
                    <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0.5rem 0' }}>
                      {st.signature_path ? (
                        <img
                          src={`/api/signatures/image?path=${encodeURIComponent(st.signature_path)}`}
                          alt="Signature"
                          style={{ maxHeight: '60px', maxWidth: '140px', objectFit: 'contain' }}
                        />
                      ) : st.status === 'COMPLETED' ? (
                        <div style={{ color: '#16a34a', fontSize: '0.8rem', fontWeight: 600 }}>
                          [อนุมัติแล้วในระบบ]
                        </div>
                      ) : (
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', borderBottom: '1px dotted #cbd5e1', width: '80%' }}>
                          (ยังไม่ถึงคิวลงนาม)
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      ({st.action_by_name || st.assigned_to_name || '...................................................'})
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                      ตำแหน่ง {st.assigned_to_position || st.assigned_role || 'เจ้าหน้าที่ผู้รับผิดชอบ'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer Security Stamp */}
        <div style={{ marginTop: '3rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
          <div>ระบบสารสนเทศและบริหารงานซ่อมบำรุง โรงพยาบาลเถิน (Thoen Hospital System)</div>
          <div>พิมพ์เมื่อ: {formatThaiDateTime(new Date().toISOString())}</div>
        </div>

      </div>
    </div>
  )
}
