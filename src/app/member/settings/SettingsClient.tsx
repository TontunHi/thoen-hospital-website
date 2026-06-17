'use client'

import { useState } from 'react'

interface SettingsClientProps {
  initialSettings: Record<string, string>
}

export default function SettingsClient({ initialSettings }: SettingsClientProps) {
  const [featureSignature, setFeatureSignature] = useState(initialSettings['feature_signature'] !== '0')
  const [featureSalary, setFeatureSalary] = useState(initialSettings['feature_salary'] !== '0')
  const [featurePrRequests, setFeaturePrRequests] = useState(initialSettings['feature_pr_requests'] !== '0')
  const [featureApprovals, setFeatureApprovals] = useState(initialSettings['feature_approvals'] !== '0')

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        feature_signature: featureSignature ? '1' : '0',
        feature_salary: featureSalary ? '1' : '0',
        feature_pr_requests: featurePrRequests ? '1' : '0',
        feature_approvals: featureApprovals ? '1' : '0'
      }
      const res = await fetch('/api/member/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการบันทึก')
      notify('บันทึกการตั้งค่าสิทธิ์เข้าใช้งานเรียบร้อยแล้ว')
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  return (
    <div className="settingsClient">
      {message && (
        <div className={`notificationAlert ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="card settingsCard">
        <h3 className="settingsSectionHeading">
          สิทธิ์การเข้าใช้งานบริการของสมาชิกทั่วไป (Member Access Controls)
        </h3>
        
        <form onSubmit={handleSaveSettings}>
          <div className="settingsSection">
            {/* Toggle: Digital Signature */}
            <div className="toggleRow">
              <div className="toggleLabelInfo">
                <span className="toggleLabelText">จัดการลายเซ็นดิจิทัล</span>
                <span className="toggleDescriptionText">อนุญาตให้สมาชิกทั่วไปลงทะเบียนและจัดการลายเซ็นดิจิทัล</span>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={featureSignature} 
                  onChange={(e) => setFeatureSignature(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>

            {/* Toggle: Salary Slip */}
            <div className="toggleRow">
              <div className="toggleLabelInfo">
                <span className="toggleLabelText">ระบบสลิปเงินเดือนออนไลน์</span>
                <span className="toggleDescriptionText">อนุญาตให้สมาชิกทั่วไปเรียกดูสลิปเงินเดือนออนไลน์</span>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={featureSalary} 
                  onChange={(e) => setFeatureSalary(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>

            {/* Toggle: PR Media Request */}
            <div className="toggleRow">
              <div className="toggleLabelInfo">
                <span className="toggleLabelText">ร้องขอผลิตสื่อประชาสัมพันธ์</span>
                <span className="toggleDescriptionText">อนุญาตให้สมาชิกทั่วไปยื่นคำขอผลิตสื่อประชาสัมพันธ์</span>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={featurePrRequests} 
                  onChange={(e) => setFeaturePrRequests(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>

            {/* Toggle: Approvals Inbox */}
            <div className="toggleRow">
              <div className="toggleLabelInfo">
                <span className="toggleLabelText">กล่องงานรอการอนุมัติ</span>
                <span className="toggleDescriptionText">อนุญาตให้สมาชิกทั่วไปเข้าใช้งานกล่องงานรออนุมัติ</span>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={featureApprovals} 
                  onChange={(e) => setFeatureApprovals(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>

          <div className="formActions" style={{ marginTop: '28px' }}>
            <button type="submit" className="btn btn-primary">บันทึกการตั้งค่าระบบ</button>
          </div>
        </form>
      </div>
    </div>
  )
}
