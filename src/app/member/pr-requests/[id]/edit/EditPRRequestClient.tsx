'use client'

import React, { useState } from 'react'
import { ArrowLeft, Check, AlertCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import '../../page.css'

interface RequesterInfo {
  id: number
  name: string | null
  department: string | null
  position: string | null
  username: string
}

interface RequestDetail {
  id: number
  title: string
  urgency: string
  orderDate: string
  targetDate: string
  jobType?: string[]
  jobTypeOther?: string | null
  details?: string | null
  channels?: string[]
  phone: string
  has_cost: number
}

export default function EditPRRequestClient({ 
  requester, 
  request 
}: { 
  requester: RequesterInfo
  request: RequestDetail 
}) {
  const router = useRouter()
  const isPrOfficer = requester.position && requester.position.includes('นักประชาสัมพันธ์')
  const backUrl = isPrOfficer ? '/member/approvals' : '/member/pr-requests'
  const [hasCost, setHasCost] = useState<boolean>(request.has_cost === 1)
  const [title, setTitle] = useState<string>(request.title)
  const [urgency, setUrgency] = useState<string>(request.urgency)
  const [orderDate, setOrderDate] = useState<string>(request.orderDate)
  const [targetDate, setTargetDate] = useState<string>(request.targetDate)
  
  // Job Types checkboxes initialization
  const initialJobTypes = request.jobType || []
  const posterItem = initialJobTypes.find(t => t.startsWith('โปสเตอร์ขนาด'))
  const initialPosterSize = posterItem ? posterItem.replace('โปสเตอร์ขนาด', '').trim() : ''
  
  const [jobTypes, setJobTypes] = useState<string[]>(initialJobTypes)
  const [posterSize, setPosterSize] = useState<string>(initialPosterSize)
  const [jobTypeOther, setJobTypeOther] = useState<string>(request.jobTypeOther || '')
  
  const [details, setDetails] = useState<string>(request.details || '')
  
  // Channels checkboxes initialization
  const initialChannels = request.channels || []
  const hospitalItem = initialChannels.find(c => c.startsWith('ในอาคารโรงพยาบาลบริเวณ'))
  const initialHospitalArea = hospitalItem ? hospitalItem.replace('ในอาคารโรงพยาบาลบริเวณ', '').trim() : ''
  
  const communityItem = initialChannels.find(c => c.startsWith('ในชุมชน'))
  const initialCommunityArea = communityItem ? communityItem.replace('ในชุมชน', '').trim() : ''
  
  const [channels, setChannels] = useState<string[]>(initialChannels)
  const [hospitalArea, setHospitalArea] = useState<string>(initialHospitalArea)
  const [communityArea, setCommunityArea] = useState<string>(initialCommunityArea)
  
  const [phone, setPhone] = useState<string>(request.phone)
  const [saving, setSaving] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const handleJobTypeChange = (type: string) => {
    if (jobTypes.includes(type)) {
      setJobTypes(jobTypes.filter(t => t !== type))
    } else {
      setJobTypes([...jobTypes, type])
    }
  }

  const handleChannelChange = (channel: string) => {
    if (channels.includes(channel)) {
      setChannels(channels.filter(c => c !== channel))
    } else {
      setChannels([...channels, channel])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (jobTypes.length === 0 && !jobTypeOther) {
      setError('กรุณาเลือกหรือระบุลักษณะงานอย่างน้อย 1 ประเภท')
      return
    }
    
    setSaving(true)
    setError(null)

    const payload = {
      id: request.id,
      title,
      urgency,
      orderDate,
      targetDate,
      jobType: jobTypes,
      jobTypeOther: jobTypeOther || null,
      details,
      channels,
      phone,
      hasCost
    }

    try {
      const res = await fetch('/api/pr-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (res.ok && data.success) {
        router.push(backUrl)
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
      }
    } catch (err) {
      console.error(err)
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="prRequestsContainer">
      <Link href={backUrl} className="backLink">
        <ArrowLeft size={16} />
        ย้อนกลับรายการทั้งหมด
      </Link>

      <div className="pageHeader">
        <div>
          <h1>แก้ไขเอกสารคำขอส่งผลิตสื่อประชาสัมพันธ์</h1>
          <p className="pageSubtitle">แก้ไขข้อมูลรายละเอียดคำขอ หมายเหตุ: การแก้ไขข้อมูลจะทำการรีเซ็ตประวัติการลงอนุมัติของเอกสารฉบับนี้</p>
        </div>
      </div>

      {error && (
        <div className="statusMessage statusError" style={{ marginBottom: '24px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="formCard">
        {/* Step 1: Select Type */}
        <div className="formGroup">
          <label style={{ fontSize: '16px', marginBottom: '16px', display: 'block', textAlign: 'center', color: '#0f172a' }}>
            ขั้นตอนแรก: เลือกประเภทการขอเบิกจ่าย
          </label>
          <div className="typeSelectorGrid">
            <div 
              className={`typeSelectCard ${!hasCost ? 'active' : ''}`}
              onClick={() => setHasCost(false)}
            >
              <h3>ไม่มีค่าใช้จ่าย (ทั่วไป)</h3>
              <p>เช่น งานออกแบบขึ้นเว็บ, วิดีโอ หรือสื่อดิจิทัลทั่วไป อนุมัติสั้นเพียง 1 ขั้นตอน</p>
            </div>
            <div 
              className={`typeSelectCard ${hasCost ? 'active' : ''}`}
              onClick={() => setHasCost(true)}
            >
              <h3>มีค่าใช้จ่าย (งบประมาณ)</h3>
              <p>เช่น งานไวนิล, ป้ายบอร์ดนิทรรศการ หรือสิ่งพิมพ์จ้างนอก อนุมัติ 4 ขั้นตอน</p>
            </div>
          </div>
        </div>

        {/* Step 2: Form Details */}
        <div className="formGrid">
          <div className="formGroup">
            <label>หัวข้อเรื่องสั่งงาน *</label>
            <input 
              type="text" 
              className="inputField"
              placeholder="เช่น ขอผลิตสื่อประชาสัมพันธ์โครงการส่งเสริมสุขภาพผู้สูงอายุ"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="rowGrid">
            <div className="formGroup">
              <label>ความเร่งด่วน *</label>
              <div className="radioGroup" style={{ marginTop: '8px' }}>
                {['ด่วนที่สุด', 'ด่วน', 'ไม่ด่วน'].map((urg) => (
                  <label key={urg} className="radioLabel">
                    <input 
                      type="radio" 
                      name="urgency" 
                      value={urg}
                      checked={urgency === urg}
                      onChange={(e) => setUrgency(e.target.value)}
                    />
                    {urg}
                  </label>
                ))}
              </div>
            </div>

            <div className="formGroup">
              <label>เบอร์โทรศัพท์ติดต่อแผนก *</label>
              <input 
                type="text" 
                className="inputField"
                placeholder="เช่น เบอร์โทรภายใน 321 หรือ มือถือ"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="rowGrid">
            <div className="formGroup">
              <label>วันที่สั่งงาน *</label>
              <input 
                type="date" 
                className="inputField"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                required
              />
            </div>

            <div className="formGroup">
              <label>วันที่ขอรับงาน *</label>
              <input 
                type="date" 
                className="inputField"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Job Types */}
          <div className="formGroup">
            <label>ลักษณะงานที่ขอผลิต (เลือกได้หลายรายการ) *</label>
            <div className="checkboxGroup">
              {['แผ่นพับ 3 พับ', 'บัตรพนักงาน', 'ตัดต่อวิดีโอ', 'AW ขึ้นเว็บไซต์', 'ป้ายประกาศ', 'Power Point', 'สติ๊กเกอร์'].map((type) => (
                <label key={type} className="checkboxLabel">
                  <input 
                    type="checkbox"
                    checked={jobTypes.includes(type)}
                    onChange={() => handleJobTypeChange(type)}
                  />
                  {type}
                </label>
              ))}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <label className="checkboxLabel" style={{ margin: 0 }}>
                  <input 
                    type="checkbox"
                    checked={jobTypes.some(t => t.startsWith('โปสเตอร์ขนาด'))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setJobTypes([...jobTypes, `โปสเตอร์ขนาด ${posterSize || ''}`])
                      } else {
                        setJobTypes(jobTypes.filter(t => !t.startsWith('โปสเตอร์ขนาด')))
                      }
                    }}
                  />
                  โปสเตอร์ขนาด
                </label>
                <input 
                  type="text" 
                  className="inputField" 
                  style={{ flex: '1', minWidth: '120px', padding: '4px 10px', fontSize: '14px' }}
                  placeholder="ระบุขนาด เช่น A3, 60x90 ซม."
                  value={posterSize}
                  onChange={(e) => {
                    const val = e.target.value
                    setPosterSize(val)
                    if (jobTypes.some(t => t.startsWith('โปสเตอร์ขนาด')) || val) {
                      const baseTypes = jobTypes.filter(t => !t.startsWith('โปสเตอร์ขนาด'))
                      setJobTypes([...baseTypes, `โปสเตอร์ขนาด ${val}`])
                    }
                  }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: '#0f172a' }}>อื่นๆ (ระบุ):</span>
                <input 
                  type="text" 
                  className="inputField" 
                  style={{ flex: '1', padding: '6px 12px' }}
                  placeholder="เช่น ป้ายบอร์ดนิทรรศการ"
                  value={jobTypeOther}
                  onChange={(e) => setJobTypeOther(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="formGroup">
            <label>รายละเอียดความต้องการเพิ่มเติม (โปรดระบุความต้องการให้ชัดเจน)</label>
            <textarea 
              className="textareaField"
              rows={4}
              placeholder="ระบุข้อความบนป้าย, สีโทนที่ต้องการ, ขนาดงาน หรือลิ้งค์รายละเอียดตัวอย่าง"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </div>

          {/* Channels */}
          <div className="formGroup">
            <label>ต้องการเผยแพร่ทางช่องทางใด (เลือกหรือไม่เลือกก็ได้)</label>
            <div className="checkboxGroup">
              {['สื่อโซเชียลของ รพ.', 'Page facebook'].map((ch) => (
                <label key={ch} className="checkboxLabel">
                  <input 
                    type="checkbox"
                    checked={channels.includes(ch)}
                    onChange={() => handleChannelChange(ch)}
                  />
                  {ch}
                </label>
              ))}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <label className="checkboxLabel" style={{ margin: 0 }}>
                  <input 
                    type="checkbox"
                    checked={channels.some(c => c.startsWith('ในอาคารโรงพยาบาลบริเวณ'))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setChannels([...channels, `ในอาคารโรงพยาบาลบริเวณ ${hospitalArea || ''}`])
                      } else {
                        setChannels(channels.filter(c => !c.startsWith('ในอาคารโรงพยาบาลบริเวณ')))
                      }
                    }}
                  />
                  ในอาคารโรงพยาบาลบริเวณ
                </label>
                <input 
                  type="text" 
                  className="inputField" 
                  style={{ flex: '1', minWidth: '120px', padding: '4px 10px', fontSize: '14px' }}
                  placeholder="ระบุบริเวณ เช่น หน้าห้องยา, หน้า OPD"
                  value={hospitalArea}
                  onChange={(e) => {
                    const val = e.target.value
                    setHospitalArea(val)
                    if (channels.some(c => c.startsWith('ในอาคารโรงพยาบาลบริเวณ')) || val) {
                      const baseChannels = channels.filter(c => !c.startsWith('ในอาคารโรงพยาบาลบริเวณ'))
                      setChannels([...baseChannels, `ในอาคารโรงพยาบาลบริเวณ ${val}`])
                    }
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <label className="checkboxLabel" style={{ margin: 0 }}>
                  <input 
                    type="checkbox"
                    checked={channels.some(c => c.startsWith('ในชุมชน'))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setChannels([...channels, `ในชุมชน ${communityArea || ''}`])
                      } else {
                        setChannels(channels.filter(c => !c.startsWith('ในชุมชน')))
                      }
                    }}
                  />
                  ในชุมชน
                </label>
                <input 
                  type="text" 
                  className="inputField" 
                  style={{ flex: '1', minWidth: '120px', padding: '4px 10px', fontSize: '14px' }}
                  placeholder="ระบุสถานที่ เช่น รพ.สต.บ้านเถิน"
                  value={communityArea}
                  onChange={(e) => {
                    const val = e.target.value
                    setCommunityArea(val)
                    if (channels.some(c => c.startsWith('ในชุมชน')) || val) {
                      const baseChannels = channels.filter(c => !c.startsWith('ในชุมชน'))
                      setChannels([...baseChannels, `ในชุมชน ${val}`])
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Prefilled Profile Area */}
          <div className="formGroup">
            <label>ข้อมูลผู้ขอส่งเอกสาร (ดึงอัตโนมัติจากระบบโปรไฟล์)</label>
            <div className="formPrefilledArea">
              <div className="prefilledItem">
                <span className="prefilledLabel">ชื่อผู้ส่งเอกสาร</span>
                <span className="prefilledVal">{requester.name || 'ไม่ได้ระบุ'}</span>
              </div>
              <div className="prefilledItem">
                <span className="prefilledLabel">กลุ่มงาน / แผนก</span>
                <span className="prefilledVal">{requester.department || 'ไม่ได้ระบุ'}</span>
              </div>
              <div className="prefilledItem">
                <span className="prefilledLabel">ตำแหน่งงาน</span>
                <span className="prefilledVal">{requester.position || 'ไม่ได้ระบุ'}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Form Actions */}
        <div className="formActions">
          <Link href={backUrl} className="submitBtn" style={{ background: '#64748b', boxShadow: 'none' }}>
            ยกเลิก
          </Link>
          <button type="submit" className="submitBtn" disabled={saving}>
            {saving ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 className="animate-spin" size={16} />
                กำลังบันทึกการแก้ไข...
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={16} />
                บันทึกการแก้ไข
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
