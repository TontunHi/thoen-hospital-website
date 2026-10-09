'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Inbox,
  CheckCircle2,
  Palette,
  Wrench,
  Coins,
  Layers,
  Pill,
  Save,
  RefreshCw,
} from 'lucide-react'

export interface SystemModulesViewProps {
  initialSettings: Record<string, string>
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void
  onDirtyChange?: (isDirty: boolean) => void
  onSaveSuccess?: () => void
}

export default function SystemModulesView({
  initialSettings,
  addToast,
  onDirtyChange,
  onSaveSuccess,
}: SystemModulesViewProps) {
  // Feature Toggles state
  const [featureInbox, setFeatureInbox] = useState(initialSettings['feature_inbox'] !== '0')
  const [featureSignature, setFeatureSignature] = useState(
    initialSettings['feature_signature'] !== '0'
  )
  const [featureSalary, setFeatureSalary] = useState(initialSettings['feature_salary'] !== '0')
  const [featureIta, setFeatureIta] = useState(initialSettings['feature_ita'] !== '0')
  const [featureRdu, setFeatureRdu] = useState(initialSettings['feature_rdu'] !== '0')
  const [featureRepair, setFeatureRepair] = useState(initialSettings['feature_repair'] !== '0')
  const [featureMediaRequest, setFeatureMediaRequest] = useState(
    initialSettings['feature_media_request'] !== '0'
  )

  const [initialFeatureState, setInitialFeatureState] = useState({
    featureInbox: initialSettings['feature_inbox'] !== '0',
    featureSignature: initialSettings['feature_signature'] !== '0',
    featureSalary: initialSettings['feature_salary'] !== '0',
    featureIta: initialSettings['feature_ita'] !== '0',
    featureRdu: initialSettings['feature_rdu'] !== '0',
    featureRepair: initialSettings['feature_repair'] !== '0',
    featureMediaRequest: initialSettings['feature_media_request'] !== '0',
  })

  const [isSavingSettings, setIsSavingSettings] = useState(false)

  const isFeaturesDirty = useMemo(() => {
    return (
      featureInbox !== initialFeatureState.featureInbox ||
      featureSignature !== initialFeatureState.featureSignature ||
      featureSalary !== initialFeatureState.featureSalary ||
      featureIta !== initialFeatureState.featureIta ||
      featureRdu !== initialFeatureState.featureRdu ||
      featureRepair !== initialFeatureState.featureRepair ||
      featureMediaRequest !== initialFeatureState.featureMediaRequest
    )
  }, [
    featureInbox,
    featureSignature,
    featureSalary,
    featureIta,
    featureRdu,
    featureRepair,
    featureMediaRequest,
    initialFeatureState,
  ])

  useEffect(() => {
    onDirtyChange?.(isFeaturesDirty)
  }, [isFeaturesDirty, onDirtyChange])

  // Feature Toggles Save
  const handleSaveFeatures = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setIsSavingSettings(true)
    try {
      const payload = {
        feature_inbox: featureInbox ? '1' : '0',
        feature_signature: featureSignature ? '1' : '0',
        feature_salary: featureSalary ? '1' : '0',
        feature_ita: featureIta ? '1' : '0',
        feature_rdu: featureRdu ? '1' : '0',
        feature_repair: featureRepair ? '1' : '0',
        feature_media_request: featureMediaRequest ? '1' : '0',
      }
      const res = await fetch('/api/member/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการบันทึก')

      setInitialFeatureState({
        featureInbox,
        featureSignature,
        featureSalary,
        featureIta,
        featureRdu,
        featureRepair,
        featureMediaRequest,
      })
      addToast('บันทึกการตั้งค่าเปิด/ปิดโมดูลระบบเรียบร้อยแล้ว', 'success')
      onSaveSuccess?.()
    } catch (err: any) {
      addToast(err.message || 'เกิดข้อผิดพลาดในการบันทึก', 'error')
    } finally {
      setIsSavingSettings(false)
    }
  }

  return (
    <div className="featureTogglesContainer">
      <div className="featureTogglesHeader">
        <div className="headerLeft">
          <h2>สวิตช์ควบคุมการเปิด/ปิดโมดูลระบบบริการ</h2>
          <p>
            เปิดหรือปิดการแสดงผลโมดูลบริการหลักสำหรับบุคลากรในพอร์ทัลสมาชิก
            เมื่อปิดการใช้งาน เมนูดังกล่าวจะไม่แสดงบนหน้าแดชบอร์ด
          </p>
        </div>
        <div className="headerRight">
          <button
            type="button"
            onClick={handleSaveFeatures}
            disabled={!isFeaturesDirty || isSavingSettings}
            className={`saveFeaturesBtn ${isFeaturesDirty ? 'dirty' : ''}`}
          >
            {isSavingSettings ? (
              <RefreshCw size={16} className="spinIcon" />
            ) : (
              <Save size={16} />
            )}
            <span>{isSavingSettings ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าโมดูล'}</span>
          </button>
        </div>
      </div>

      <div className="featureCardsGrid">
        {/* Inbox */}
        <div className={`featureCard ${featureInbox ? 'active' : ''}`}>
          <div className="featureCardIconBox iconTeal">
            <Inbox size={24} />
          </div>
          <div className="featureCardContent">
            <div className="featureCardTitleRow">
              <h3>กล่องงานและระบบสายการอนุมัติ (Task Inbox)</h3>
              <label className="switchToggle">
                <input
                  type="checkbox"
                  checked={featureInbox}
                  onChange={(e) => setFeatureInbox(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <p>
              ระบบกล่องงานกลางสำหรับรับ-ส่ง ติดตามขั้นตอนการอนุมัติ
              และการมอบหมายงานอิเล็กทรอนิกส์
            </p>
          </div>
        </div>

        {/* Signature */}
        <div className={`featureCard ${featureSignature ? 'active' : ''}`}>
          <div className="featureCardIconBox iconIndigo">
            <CheckCircle2 size={24} />
          </div>
          <div className="featureCardContent">
            <div className="featureCardTitleRow">
              <h3>ระบบลายเซ็นดิจิทัล (Digital Signature)</h3>
              <label className="switchToggle">
                <input
                  type="checkbox"
                  checked={featureSignature}
                  onChange={(e) => setFeatureSignature(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <p>
              ระบบลงนามอิเล็กทรอนิกส์และวาดลายเซ็นดิจิทัล พร้อม HMAC-SHA256 Audit Verification
            </p>
          </div>
        </div>

        {/* Media Request */}
        <div className={`featureCard ${featureMediaRequest ? 'active' : ''}`}>
          <div className="featureCardIconBox iconPurple">
            <Palette size={24} />
          </div>
          <div className="featureCardContent">
            <div className="featureCardTitleRow">
              <h3>ระบบขอสื่อประชาสัมพันธ์ (Media Request)</h3>
              <label className="switchToggle">
                <input
                  type="checkbox"
                  checked={featureMediaRequest}
                  onChange={(e) => setFeatureMediaRequest(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <p>
              ระบบขอผลิตสื่อกราฟิก ออกแบบ วิดีโอ ไวนิล และประชาสัมพันธ์สำหรับหน่วยงาน
            </p>
          </div>
        </div>

        {/* Repair */}
        <div className={`featureCard ${featureRepair ? 'active' : ''}`}>
          <div className="featureCardIconBox iconAmber">
            <Wrench size={24} />
          </div>
          <div className="featureCardContent">
            <div className="featureCardTitleRow">
              <h3>ระบบแจ้งซ่อมบำรุงและศูนย์ไอที (Repair Service)</h3>
              <label className="switchToggle">
                <input
                  type="checkbox"
                  checked={featureRepair}
                  onChange={(e) => setFeatureRepair(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <p>
              ระบบแจ้งซ่อมคอมพิวเตอร์ งานช่างอาคารสถานที่ และงานเครื่องมือแพทย์
            </p>
          </div>
        </div>

        {/* Salary */}
        <div className={`featureCard ${featureSalary ? 'active' : ''}`}>
          <div className="featureCardIconBox iconEmerald">
            <Coins size={24} />
          </div>
          <div className="featureCardContent">
            <div className="featureCardTitleRow">
              <h3>ระบบสลิปเงินเดือนและค่าตอบแทน (Salary Portal)</h3>
              <label className="switchToggle">
                <input
                  type="checkbox"
                  checked={featureSalary}
                  onChange={(e) => setFeatureSalary(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <p>ระบบค้นหา ตรวจสอบ และดาวน์โหลดสลิปเงินเดือนสำหรับเจ้าหน้าที่ รพ.เถิน</p>
          </div>
        </div>

        {/* ITA */}
        <div className={`featureCard ${featureIta ? 'active' : ''}`}>
          <div className="featureCardIconBox iconViolet">
            <Layers size={24} />
          </div>
          <div className="featureCardContent">
            <div className="featureCardTitleRow">
              <h3>ระบบประเมินคุณธรรมและความโปร่งใส (ITA Articles)</h3>
              <label className="switchToggle">
                <input
                  type="checkbox"
                  checked={featureIta}
                  onChange={(e) => setFeatureIta(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <p>ระบบเขียนและเผยแพร่บทความประเมินคุณธรรมและความโปร่งใส ITA</p>
          </div>
        </div>

        {/* RDU */}
        <div className={`featureCard ${featureRdu ? 'active' : ''}`}>
          <div className="featureCardIconBox iconCyan">
            <Pill size={24} />
          </div>
          <div className="featureCardContent">
            <div className="featureCardTitleRow">
              <h3>ระบบการใช้ยาอย่างสมเหตุผล (RDU Hospital)</h3>
              <label className="switchToggle">
                <input
                  type="checkbox"
                  checked={featureRdu}
                  onChange={(e) => setFeatureRdu(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <p>ระบบจัดเก็บโฟลเดอร์และรายงานการใช้ยาอย่างสมเหตุผลของโรงพยาบาล</p>
          </div>
        </div>
      </div>
    </div>
  )
}
