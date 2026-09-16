import React from 'react'

interface Attachment {
  url: string
  filename: string
}

export interface PRVoucherDetail {
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
  attachments?: Attachment[]
}

export interface VoucherApprovalStep {
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

interface PrintablePRVoucherProps {
  detail: PRVoucherDetail
  approvals: VoucherApprovalStep[]
  printRef: React.RefObject<HTMLDivElement | null>
  formatDateShort: (d: string | null) => string
  parseJsonList: (v: any) => string[]
}

export default function PrintablePRVoucher({
  detail,
  approvals,
  printRef,
  formatDateShort,
  parseJsonList,
}: PrintablePRVoucherProps) {
  return (
    <div className="printTemplate" ref={printRef}>
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
          <div className="docDocId">เลขที่: PR-{String(detail.id).padStart(4, '0')}</div>
          <div className="docDocDate">วันที่: {formatDateShort(detail.created_at)}</div>
        </div>
      </div>
      <div className="docDividerThick"></div>
      <div className="docMetaRow">
        <div className="docUrgencyGroup">
          <span className="docFieldLabel">ระดับความเร่งด่วน:</span>
          {['ด่วนที่สุด', 'ด่วน', 'ไม่ด่วน'].map((u) => (
            <span key={u} className={`docCheckItem ${detail.urgency === u ? 'checked' : ''}`}>
              <span className="docCheckBox">{detail.urgency === u ? '✓' : ''}</span> {u}
            </span>
          ))}
        </div>
        <div className={`docCostTag ${detail.has_cost ? 'cost' : 'free'}`}>
          {detail.has_cost ? '● มีค่าใช้จ่าย' : '● ไม่มีค่าใช้จ่าย'}
        </div>
      </div>
      <div className="docSection">
        <div className="docSectionLabel">เรื่อง</div>
        <div className="docSectionContent docSubjectText">{detail.title}</div>
      </div>
      <div className="docTwoCol">
        <div className="docSection">
          <div className="docSectionLabel">วันที่สั่งงาน</div>
          <div className="docSectionContent">{formatDateShort(detail.order_date)}</div>
        </div>
        <div className="docSection">
          <div className="docSectionLabel">วันที่ขอรับงาน</div>
          <div className="docSectionContent">{formatDateShort(detail.target_date)}</div>
        </div>
      </div>
      <div className="docDivider"></div>
      <div className="docSection">
        <div className="docSectionLabel">ลักษณะงานที่ขอผลิต</div>
        <div className="docCheckGrid">
          {[
            'แผ่นพับ 3 พับ',
            'บัตรพนักงาน',
            'ตัดต่อวิดีโอ',
            'AW ขึ้นเว็บไซต์',
            'ป้ายประกาศ',
            'Power Point',
            'สติ๊กเกอร์',
          ].map((type) => {
            const isChecked = parseJsonList(detail.job_type).includes(type)
            return (
              <span key={type} className={`docCheckItem ${isChecked ? 'checked' : ''}`}>
                <span className="docCheckBox">{isChecked ? '✓' : ''}</span> {type}
              </span>
            )
          })}
          {(() => {
            const list = parseJsonList(detail.job_type)
            const item = list.find((t) => t.startsWith('โปสเตอร์ขนาด'))
            const isChecked = !!item
            const size = item ? item.replace('โปสเตอร์ขนาด', '').trim() : ''
            return (
              <span className={`docCheckItem ${isChecked ? 'checked' : ''}`}>
                <span className="docCheckBox">{isChecked ? '✓' : ''}</span>
                โปสเตอร์ขนาด{isChecked ? ` ${size}` : ''}
              </span>
            )
          })()}
          {detail.job_type_other && (
            <span className="docCheckItem checked">
              <span className="docCheckBox">✓</span> อื่นๆ: {detail.job_type_other}
            </span>
          )}
        </div>
      </div>
      <div className="docSection">
        <div className="docSectionLabel">รายละเอียดความต้องการ</div>
        <div className="docDetailsBox">{detail.details || 'ไม่ได้ระบุ'}</div>
      </div>

      {detail.attachments && detail.attachments.length > 0 && (
        <div className="docSection no-print" style={{ marginTop: '8px' }}>
          <div className="docSectionLabel">ไฟล์แนบเพิ่มเติม</div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              marginTop: '4px',
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
            }}
          >
            {detail.attachments.map((file, idx) => (
              <div
                key={idx}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}
              >
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
      <div className="docSection">
        <div className="docSectionLabel">ช่องทางเผยแพร่</div>
        <div className="docCheckGrid">
          {['สื่อโซเชียลของ รพ.', 'Page facebook'].map((ch) => {
            const isChecked = parseJsonList(detail.channels).includes(ch)
            return (
              <span key={ch} className={`docCheckItem ${isChecked ? 'checked' : ''}`}>
                <span className="docCheckBox">{isChecked ? '✓' : ''}</span> {ch}
              </span>
            )
          })}
          {(() => {
            const list = parseJsonList(detail.channels)
            const item = list.find((c) => c.startsWith('ในอาคารโรงพยาบาลบริเวณ'))
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
            const list = parseJsonList(detail.channels)
            const item = list.find((c) => c.startsWith('ในชุมชน'))
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
          <div className="docSectionLabel">ผู้ขอสั่งผลิต</div>
          <div className="docSectionContent">{detail.requester_name || '—'}</div>
        </div>
        <div className="docSection">
          <div className="docSectionLabel">กลุ่มงาน / หน่วยงาน</div>
          <div className="docSectionContent">
            {detail.requester_dept || detail.department || '—'}
          </div>
        </div>
        <div className="docSection">
          <div className="docSectionLabel">เบอร์โทรติดต่อ</div>
          <div className="docSectionContent">{detail.phone || '—'}</div>
        </div>
      </div>
      <div className="docDividerThick"></div>
      <div className="docSigTitle">การลงนามอนุมัติ</div>
      <div className="docSignatureRow">
        {approvals
          .filter((step) => !step.assigned_position.includes('นักประชาสัมพันธ์'))
          .map((step) => {
            const isApproved = step.status === 'APPROVED'
            const isSigned = isApproved && step.signature_path
            const isRejected = step.status === 'REJECTED'
            return (
              <div
                key={step.id}
                className={`docSigBox ${isSigned ? 'signed' : ''} ${isRejected ? 'rejected' : ''}`}
              >
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
                  style={
                    step.assigned_position === 'ผู้อำนวยการโรงพยาบาลเถิน'
                      ? { whiteSpace: 'nowrap', wordBreak: 'keep-all' }
                      : {}
                  }
                >
                  ตำแหน่ง {step.assigned_position}
                </div>
                {step.approved_at && (
                  <div className="docSigDate">วันที่: {formatDateShort(step.approved_at)}</div>
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
  )
}
