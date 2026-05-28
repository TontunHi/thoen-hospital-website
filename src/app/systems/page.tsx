'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import './page.css'

export default function SystemsPage() {
  const [activeTab, setActiveTab] = useState<'internal' | 'moph' | 'dashboard'>('internal')

  const internalSystems = [
    {
      title: 'โปรแกรมเงินเดือน',
      desc: 'เข้าสู่ระบบเพื่อดูสลิปเงินเดือนและข้อมูลการจ่ายประจำเดือนสำหรับบุคลากรโรงพยาบาลเถิน',
      link: '/salary/login',
      btnText: 'ไปยังโปรแกรมเงินเดือน',
    },
    {
      title: 'สถานะห้องฉุกเฉิน',
      desc: 'แสดงข้อมูลและสถิติสถานะผู้ป่วยในห้องฉุกเฉินแบบเรียลไทม์ (รองรับการแสดงผลหน้าจอทีวี มือถือ และคอมพิวเตอร์)',
      link: '/systems/er-status',
      btnText: 'เปิดดูสถานะห้องฉุกเฉิน',
    },
    {
      title: 'โปรแกรมโพสข่าวประชาสัมพันธ์',
      desc: 'ระบบจัดการข่าวประชาสัมพันธ์ ข่าวรับสมัครงาน และข่าวกิจกรรมบนเว็บไซต์โรงพยาบาลเถิน',
      link: '/admin',
      btnText: 'จัดการข่าวประชาสัมพันธ์',
    },
    {
      title: 'โปรแกรม COC Lampang',
      desc: 'เชื่อมต่อระบบ COC โรงพยาบาลลำปาง สำหรับจัดการข้อมูลและการติดตามดูแลผู้ป่วยต่อเนื่อง',
      link: 'http://coc.lph.go.th/',
      btnText: 'ไปยังโปรแกรม COC Lampang',
    },
    {
      title: 'ระบบ Back Office',
      desc: 'เชื่อมต่อระบบ Back Office โรงพยาบาลเถิน สำหรับงานสารบรรณ พัสดุ ทรัพยากรบุคคล และการติดตามงาน',
      link: 'https://11152.gtwoffice.com/',
      btnText: 'ไปยังระบบ Back Office',
    },
    {
      title: 'HDC Lampang',
      desc: 'เชื่อมต่อคลังข้อมูลบริการสาธารณสุข (Health Data Center) จังหวัดลำปาง เพื่อการวิเคราะห์ข้อมูลและติดตามงาน',
      link: 'https://hdc.moph.go.th/lpg/public/main',
      btnText: 'ไปยัง HDC Lampang',
    },
  ]

  const mophServices = [
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
  ]

  // Real dashboards list
  const dashboardList = [
    {
      title: 'Main Dashboard',
      desc: 'ระบบแดชบอร์ดหลักของโรงพยาบาลสำหรับสรุปภาพรวมข้อมูลและสถิติต่างๆ',
      link: 'https://app.powerbi.com/view?r=eyJrIjoiMjdlNzcxOTQtODc1YS00ZDA5LWJmYTMtYTRlNmVlY2VkNzg0IiwidCI6ImI3NmEyM2QzLThjZGYtNDNjMC1hNTNiLTYwYmNkMjM3OTg5NSIsImMiOjEwfQ%3D%3D',
    },
    {
      title: 'PHR Dashboard',
      desc: 'ระบบรายงานสถิติและข้อมูลการให้บริการระเบียบสุขภาพอิเล็กทรอนิกส์ส่วนบุคคล (PHR)',
      link: 'https://app.powerbi.com/view?r=eyJrIjoiNjliODQ0OGUtYmFlMi00OWFjLWJhZjMtNjU1N2M0NWViNzQ0IiwidCI6ImI3NmEyM2QzLThjZGYtNDNjMC1hNTNiLTYwYmNkMjM3OTg5NSIsImMiOjEwfQ%3D%3D',
    },
    {
      title: 'PROVIDER ID Dashboard',
      desc: 'แดชบอร์ดสรุปสถิติข้อมูลและการลงทะเบียนสำหรับระบบยืนยันตนผู้ให้บริการสาธารณสุข',
      link: 'https://app.powerbi.com/view?r=eyJrIjoiYmYyNmZiNGQtMjVhMC00ZDdmLWE4ZDItMzU2YzczMGExNTBjIiwidCI6ImI3NmEyM2QzLThjZGYtNDNjMC1hNTNiLTYwYmNkMjM3OTg5NSIsImMiOjEwfQ%3D%3D',
    },
    {
      title: 'Health ID Dashboard',
      desc: 'แดชบอร์ดสรุปข้อมูลการใช้งานและลงทะเบียนแสดงสิทธิ์ผู้ใช้บริการระบบ Health ID',
      link: 'https://app.powerbi.com/view?r=eyJrIjoiNjUwYjIyZTgtYzllMC00YTM0LWJhNTItOTA2ZTY1OGJlOGVkIiwidCI6ImI3NmEyM2QzLThjZGYtNDNjMC1hNTNiLTYwYmNkMjM3OTg5NSIsImMiOjEwfQ%3D%3D',
    },
    {
      title: 'ใบรับรองแพทย์ Digital',
      desc: 'ระบบแดชบอร์ดข้อมูลการออกเอกสารใบรับรองแพทย์ดิจิทัลอิเล็กทรอนิกส์',
      link: 'https://app.powerbi.com/view?r=eyJrIjoiM2Y0MTAwZjItZDYwNC00MmUyLTlmZjktM2I1MWM3YjY3MjRmIiwidCI6ImI3NmEyM2QzLThjZGYtNDNjMC1hNTNiLTYwYmNkMjM3OTg5NSIsImMiOjEwfQ%3D%3D',
    },
    {
      title: 'Health Rider',
      desc: 'ระบบติดตามข้อมูลและการจัดส่งยาโดยทีมผู้ให้บริการจัดส่งยาถึงบ้าน (Health Rider)',
      link: 'https://health-mis-dashboard.moph.go.th/main/login',
    },
    {
      title: 'สอน. บัดดี้',
      desc: 'ระบบตรวจสอบสถานะและวิเคราะห์ข้อมูลการให้บริการสุขภาพผ่านโครงการ สปสช. บัดดี้',
      link: 'https://dashboard-dhi.one.th/dashboard_telemedicine',
    },
    {
      title: 'เว็บไซต์ 30 บาท',
      desc: 'แดชบอร์ดรายงานการให้บริการรักษาพยาบาลตามสิทธิ 30 บาทรักษาทุกโรค',
      link: 'https://app.powerbi.com/view?r=eyJrIjoiMjdlNzcxOTQtODc1YS00ZDA5LWJmYTMtYTRlNmVlY2VkNzg0IiwidCI6ImI3NmEyM2QzLThjZGYtNDNjMC1hNTNiLTYwYmNkMjM3OTg5NSIsImMiOjEwfQ%3D%3D',
    },
    {
      title: 'Dashboard Cyber Security',
      desc: 'ระบบเฝ้าระวังความมั่นคงปลอดภัยไซเบอร์และรายงานความเสี่ยงสารสนเทศในสังกัด สธ.',
      link: 'https://ict.moph.go.th/th/extension/1524',
    },
    {
      title: 'Imaging Hub Dashboard',
      desc: 'ระบบจัดเก็บข้อมูลและวิเคราะห์สถิติด้านการตรวจวินิจฉัยภาพถ่ายทางการแพทย์ส่วนกลาง',
      link: 'https://imaginghub-dashboard.one.th/board_view',
    },
    {
      title: 'โรงพยาบาลอัจฉริยะ',
      desc: 'ระบบวิเคราะห์และติดตามเกณฑ์ประเมินการพัฒนาเป็นโรงพยาบาลอัจฉริยะ (Smart Hospital)',
      link: 'https://bdh-service.moph.go.th/smarthosp-quest/',
    },
    {
      title: 'อัตราการครองเตียง',
      desc: 'ระบบรายงานและติดตามอัตราการครองเตียงของผู้ป่วยในโรงพยาบาลเถินและเครือข่าย',
      link: 'https://mis-health.lpho.go.th/bed',
    },
    {
      title: 'Telemedicine จังหวัดลำปาง',
      desc: 'ระบบสถิติการตรวจรักษาทางไกล (Telemedicine) ของสถานพยาบาลในจังหวัดลำปาง',
      link: 'https://mis-health.lpho.go.th/group/it/telemed',
    },
  ]

  return (
    <div className="container systemsPage">
      <div className="systemsHeader">
        <h1>💻 ระบบสารสนเทศ</h1>
        <p>ศูนย์รวมลิงก์ระบบงานบริการสาธารณสุข และเครื่องมือสารสนเทศสำหรับบุคลากรโรงพยาบาลเถิน</p>
      </div>

      {/* Tabs Controller */}
      <div className="systemsTabs">
        <button 
          className={`tabBtn ${activeTab === 'internal' ? 'active' : ''}`}
          onClick={() => setActiveTab('internal')}
        >
          📂 ระบบงานภายใน
        </button>
        <button 
          className={`tabBtn ${activeTab === 'moph' ? 'active' : ''}`}
          onClick={() => setActiveTab('moph')}
        >
          🏥 รวมบริการ MOPH
        </button>
        <button 
          className={`tabBtn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 DashBoard
        </button>
      </div>

      {/* Tab Contents */}
      <div className="tabContent">
        
        {/* 1. INTERNAL SYSTEMS */}
        {activeTab === 'internal' && (
          <div className="systemsGrid">
            {internalSystems.map((sys, idx) => (
              <div key={idx} className="systemCard card">
                <div className="cardHeader">
                  <div className="iconWrapper">
                    <Image
                      src="/images/logo-website.webp"
                      alt="Logo"
                      width={40}
                      height={40}
                    />
                  </div>
                  <h3>{sys.title}</h3>
                </div>
                <p>{sys.desc}</p>
                <div className="cardActions">
                  <a href={sys.link} target={sys.link.startsWith('http') ? '_blank' : '_self'} rel="noopener noreferrer" className="btn btn-primary btn-sm">
                    {sys.btnText}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 2. MOPH SERVICES */}
        {activeTab === 'moph' && (
          <div className="systemsGrid">
            {mophServices.map((sys, idx) => (
              <div key={idx} className="systemCard card">
                <div className="cardHeader">
                  <div className="iconWrapper mophIcon">
                    <Image
                      src="/images/logo-website.webp"
                      alt="MOPH Logo"
                      width={40}
                      height={40}
                    />
                  </div>
                  <h3>{sys.title}</h3>
                </div>
                <p>{sys.desc}</p>
                <div className="cardActions">
                  <a href={sys.link} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                    เข้าสู่ระบบ ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 3. DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="systemsGrid">
            {dashboardList.map((sys, idx) => (
              <div key={idx} className="systemCard card">
                <div className="cardHeader">
                  <div className="iconWrapper" style={{ backgroundColor: '#E0F2F1', borderColor: '#26A69A' }}>
                    <Image
                      src="/images/logo-website.webp"
                      alt="Logo"
                      width={40}
                      height={40}
                    />
                  </div>
                  <h3>{sys.title}</h3>
                </div>
                <p>{sys.desc}</p>
                <div className="cardActions">
                  <a href={sys.link} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                    เปิดดู Dashboard ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
