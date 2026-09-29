'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { 
  ExternalLink, 
  LayoutDashboard, 
  Activity, 
  Database, 
  ArrowRight
} from 'lucide-react'
import Breadcrumb from '@/components/ui/Breadcrumb'
import './page.css'

interface SystemItem {
  title: string
  desc: string
  link: string
  isInternalRoute?: boolean
}

export default function SystemsClientView() {
  const [activeTab, setActiveTab] = useState<'moph' | 'dashboard'>('moph')

  const mophServices: SystemItem[] = [
    {
      title: 'MOPH PHR Viewer',
      desc: 'ใช้งานระบบเข้าถึงข้อมูลประวัติสุขภาพส่วนบุคคลของผู้รับบริการ (Personal Health Record)',
      link: 'https://phr1.moph.go.th/phr/',
    },
    {
      title: 'ระบบ Provider ID',
      desc: 'ลงชื่อเข้าใช้/ลงทะเบียนใช้งานระบบแสดงตนสำหรับบุคลากรสาธารณสุขและรับรองเอกสารดิจิทัล',
      link: 'https://provider.id.th/',
    },
    {
      title: 'ระบบ MOPH IDP Admin',
      desc: 'ข้อมูลบัญชีผู้ใช้งานและจัดการสิทธิ์บุคลากรประจำหน่วยบริการสำหรับผู้ดูแลระบบ (Admin) หน่วยบริการ',
      link: 'https://phr1.moph.go.th/idpadmin/',
    },
    {
      title: 'หมอพร้อม Station',
      desc: 'ลงทะเบียน/เข้าใช้งานระบบบันทึกและประมวลผลข้อมูลการให้บริการของหมอพร้อม ณ จุดบริการ',
      link: 'https://mohpromtstation.moph.go.th/login',
    },
    {
      title: 'ระบบ MOPH Account Center',
      desc: 'เข้าใช้งานระบบจัดการบัญชีผู้ใช้งานระบบศูนย์กลางการบริการด้านข้อมูลและบริการของกระทรวง',
      link: 'https://cvp1.moph.go.th/accountcenter/',
    },
    {
      title: 'ระบบ MOPH IC',
      desc: 'เข้าใช้งานระบบ MOPH Immunization Center ติดตามข้อมูลการให้บริการวัคซีนและการประมวลผล',
      link: 'https://cvp1.moph.go.th/dashboard/',
    },
    {
      title: 'ระบบ MOPH PHR Center',
      desc: 'ระบบรายงานข้อมูลทะเบียนสุขภาพอิเล็กทรอนิกส์ส่วนบุคคลบนแอปพลิเคชันหมอพร้อมสำหรับโรงพยาบาล',
      link: 'https://phr1.moph.go.th/dashboard/',
    },
    {
      title: 'ระบบ MOPH FDH',
      desc: 'เข้าใช้งานศูนย์กลางข้อมูลด้านการเงิน Financial Data Hub (FDH) สำหรับเคลมสิทธิกระทรวงสาธารณสุข',
      link: 'https://fdh.moph.go.th/hospital/',
    },
    {
      title: 'ระบบ สอน.บัดดี้ (Buddy Care)',
      desc: 'เข้าใช้งานระบบ สอน.บัดดี้ (Buddy Care) ของ สปสช. สำหรับดูแลและติดตามผู้ป่วยโรคเรื้อรังและผู้สูงอายุ',
      link: 'https://buddy-care.org/auth',
    },
    {
      title: 'ระบบ MOPH Refer',
      desc: 'ระบบส่งต่อผู้ป่วยอิเล็กทรอนิกส์ (MOPH Refer) ระหว่างเครือข่ายสถานบริการสาธารณสุข',
      link: 'https://moph-refer.moph.go.th/login',
    },
    {
      title: 'ระบบ Health ID',
      desc: 'ระบบยืนยันตัวตนผู้รับบริการสุขภาพดิจิทัลสำหรับผู้ที่ไม่มีสมาร์ทโฟนหรือแอปพลิเคชันหมอพร้อม',
      link: 'https://moph.id.th/login',
    },
    {
      title: 'ระบบบริหารจัดการคำร้องขอเพื่อเชื่อมต่อ API',
      desc: 'ระบบสำหรับลงทะเบียนและบริการจัดการคำร้องขอในการเชื่อมต่อบริการ API กระทรวงสาธารณสุข',
      link: 'https://moph-api-mx.id.th/',
    },
    {
      title: 'ศูนย์รวมประกาศรับสมัครสอบ สมัครงานสาธารณสุขไทย',
      desc: 'ศูนย์ข้อมูลและประกาศรับสมัครงาน รับสมัครสอบสำหรับบุคลากรทางการแพทย์และสาธารณสุข',
      link: 'https://workspace.moph.go.th/',
    },
  ]

  const dashboards: SystemItem[] = [
    {
      title: 'ระบบติดตามสถานะห้องฉุกเฉิน (ER Status)',
      desc: 'ระบบแสดงสถานะผู้ป่วยห้องอุบัติเหตุและฉุกเฉิน สถิติการรักษา และระดับความเร่งด่วนแบบ Real-time',
      link: '/systems/er-out-status',
      isInternalRoute: true,
    },
    {
      title: 'ระบบติดตามสถานะผู้ป่วยในและเตียง (Ward Status)',
      desc: 'ระบบติดตามสถานะการครองเตียง อัตราการรับผู้ป่วยใน และการบริหารจัดการหอผู้ป่วย',
      link: '/systems/ward-status',
      isInternalRoute: true,
    },
    {
      title: 'ระบบติดตามสถานะห้องผ่าตัด (OR Status)',
      desc: 'ระบบติดตามตารางและสถานะการผ่าตัดห้องผ่าตัด โรงพยาบาลเถิน',
      link: '/systems/status-or',
      isInternalRoute: true,
    },
    {
      title: 'Thoen Hospital Information Center',
      desc: 'ศูนย์รวมลิงก์ระบบสารสนเทศและบริการออนไลน์ภายในโรงพยาบาลเถิน สำหรับการบริหารจัดการและสืบค้นข้อมูล',
      link: 'https://lookerstudio.google.com/reporting/01017415-3211-40ef-82bf-79352eec89e9/page/p_h148a04ncd?s=n2d-Kx9Wqzs',
    },
    {
      title: 'HDCT Dashboard ระบบคลังข้อมูลสุขภาพ',
      desc: 'ระบบคลังข้อมูลสุขภาพและสารสนเทศทางการแพทย์ (Health Data Center - HDC) ติดตามตัวชี้วัดและสถิติบริการ',
      link: 'https://lookerstudio.google.com/reporting/1f0ffc33-3d0d-45db-9a1b-c743fc163351/page/p_z7n82o50nd',
    },
    {
      title: 'IPD Dashboard ระบบผู้ป่วยใน',
      desc: 'ระบบสารสนเทศเพื่อการบริหารและติดตามสถานะผู้ป่วยใน (Inpatient Department) อัตราครองเตียง และสถิติการรักษา',
      link: 'https://lookerstudio.google.com/reporting/81729ae5-2980-4828-87ee-c3bcfb17d598/page/p_79e3jphqcd',
    },
    {
      title: 'Refer Dashboard ระบบส่งต่อผู้ป่วย',
      desc: 'ระบบรายงานและติดตามข้อมูลการส่งต่อผู้ป่วย (Referral System) สถิติการส่งต่อ และข้อมูลการประสานงานระหว่างโรงพยาบาล',
      link: 'https://lookerstudio.google.com/reporting/b6a229a4-df41-450f-bb7e-4076e0ef7182/page/p_79e3jphqcd',
    },
    {
      title: 'Dental Dashboard ระบบทันตกรรม',
      desc: 'ระบบสารสนเทศและสถิติการให้บริการทันตกรรม (Dental Service) ข้อมูลผู้รับบริการ และผลการดำเนินงาน',
      link: 'https://lookerstudio.google.com/reporting/c4dafd26-ea81-4ba2-b258-2924376c66cf/page/p_2v22329rcd',
    },
    {
      title: 'Thai Traditional Medicine Dashboard',
      desc: 'ระบบสารสนเทศและรายงานผลการให้บริการแพทย์แผนไทยและการแพทย์ทางเลือก (TTM Service)',
      link: 'https://lookerstudio.google.com/reporting/d7a8e7e1-8742-4f7f-ba08-ca1c900659db/page/p_2v22329rcd',
    },
    {
      title: 'Drug Stock Dashboard ระบบคลังยาและเวชภัณฑ์',
      desc: 'ระบบสารสนเทศติดตามและบริหารจัดการคลังยาและเวชภัณฑ์ (Pharmacy Stock Management)',
      link: 'https://lookerstudio.google.com/reporting/e2f3a4b5-c6d7-4e8f-9a0b-1c2d3e4f5a6b/page/p_drugstock',
    },
  ]

  return (
    <div className="systemsPage">
      <div className="container">
        {/* Breadcrumb */}
        <Breadcrumb items={[{ label: 'ระบบสารสนเทศ' }]} />

        {/* Header */}
        <div className="systemsHeader animate-fadeInUp">
          <div className="systemsHeader__badge">
            <Database size={16} />
            <span>Health Informatics & Service Hub</span>
          </div>
          <h1 className="systemsHeader__title">ระบบสารสนเทศ โรงพยาบาลเถิน</h1>
          <p className="systemsHeader__desc">
            ศูนย์รวมระบบสารสนเทศสาธารณสุข กระทรวงสาธารณสุข (MOPH) และแดชบอร์ดสารสนเทศเพื่อการบริหารจัดการ
          </p>
        </div>

        {/* Main Tab Navigation */}
        <div className="tabNavWrapper animate-fadeInUp">
          <div className="tabNav" role="tablist" aria-label="แท็บระบบสารสนเทศ">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'moph'}
              className={`tabBtn touch-target ${activeTab === 'moph' ? 'active' : ''}`}
              onClick={() => setActiveTab('moph')}
            >
              <Activity size={18} />
              <span>รวมบริการ MOPH ({mophServices.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'dashboard'}
              className={`tabBtn touch-target ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <LayoutDashboard size={18} />
              <span>แดชบอร์ดสารสนเทศ ({dashboards.length})</span>
            </button>
          </div>
        </div>

        {/* MOPH Services View */}
        {activeTab === 'moph' && (
          <div className="tabContent animate-fadeInUp">
            <div className="servicesGrid">
              {mophServices.map((item, idx) => (
                <a
                  key={idx}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="systemCard touch-target"
                  title={`เปิด ${item.title} (เปิดแท็บใหม่)`}
                >
                  <div className="systemCard__inner">
                    <div className="systemCard__header">
                      <div className="systemCard__logoWrap">
                        <Image
                          src="/images/common/logo-website.webp"
                          alt="โลโก้โรงพยาบาลเถิน"
                          width={44}
                          height={44}
                          className="systemCard__logoImg"
                        />
                      </div>
                    </div>
                    <h3 className="systemCard__title">{item.title}</h3>
                    <p className="systemCard__desc">{item.desc}</p>
                    <div className="systemCard__footer">
                      <span className="systemCard__action-btn">
                        <span>เข้าสู่ระบบ</span>
                        <ExternalLink size={15} />
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Dashboard View */}
        {activeTab === 'dashboard' && (
          <div className="tabContent animate-fadeInUp">
            <div className="servicesGrid">
              {dashboards.map((item, idx) => {
                if (item.isInternalRoute) {
                  return (
                    <Link
                      key={idx}
                      href={item.link}
                      className="systemCard internal-system-card touch-target"
                      title={`เปิด ${item.title}`}
                    >
                      <div className="systemCard__inner">
                        <div className="systemCard__header">
                          <div className="systemCard__logoWrap">
                            <Image
                              src="/images/common/logo-website.webp"
                              alt="โลโก้โรงพยาบาลเถิน"
                              width={44}
                              height={44}
                              className="systemCard__logoImg"
                            />
                          </div>
                        </div>
                        <h3 className="systemCard__title">{item.title}</h3>
                        <p className="systemCard__desc">{item.desc}</p>
                        <div className="systemCard__footer">
                          <span className="systemCard__action-btn internal-btn">
                            <span>ดูสถานะระบบ</span>
                            <ArrowRight size={15} />
                          </span>
                        </div>
                      </div>
                    </Link>
                  )
                }

                return (
                  <a
                    key={idx}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="systemCard touch-target"
                    title={`เปิด ${item.title} (เปิดแท็บใหม่)`}
                  >
                    <div className="systemCard__inner">
                      <div className="systemCard__header">
                        <div className="systemCard__logoWrap">
                          <Image
                            src="/images/common/logo-website.webp"
                            alt="โลโก้โรงพยาบาลเถิน"
                            width={44}
                            height={44}
                            className="systemCard__logoImg"
                          />
                        </div>
                      </div>
                      <h3 className="systemCard__title">{item.title}</h3>
                      <p className="systemCard__desc">{item.desc}</p>
                      <div className="systemCard__footer">
                        <span className="systemCard__action-btn">
                          <span>เปิดแดชบอร์ด</span>
                          <ExternalLink size={15} />
                        </span>
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
