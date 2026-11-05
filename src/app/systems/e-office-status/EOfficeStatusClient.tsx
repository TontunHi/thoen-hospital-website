'use client'

import React, { useState, useRef } from 'react'
import Link from 'next/link'
import {
  RefreshCw,
  Maximize2,
  Minimize2,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react'
import Breadcrumb from '@/components/ui/Breadcrumb'
import './page.css'

const POWER_BI_EMBED_URL =
  'https://app.powerbi.com/view?r=eyJrIjoiYThlMGY3NjAtYThlYi00NGVhLThiN2QtNzE5YjNjN2U5OTI3IiwidCI6IjExODdiMzgwLTg3NzgtNDdlYS1iNjYwLTNmMjgyNjRiMTNhMCIsImMiOjEwfQ%3D%3D'
const MOPH_SOURCE_URL = 'https://ict.moph.go.th/th/extension/1932'

export default function EOfficeStatusClient() {
  const [iframeKey, setIframeKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleRefresh = () => {
    setIsLoading(true)
    setIframeKey((prev) => prev + 1)
  }

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {
          setIsFullscreen(true)
        })
      } else {
        setIsFullscreen(true)
      }
      setIsFullscreen(true)
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }
      setIsFullscreen(false)
    }
  }

  return (
    <div
      ref={containerRef}
      className={`eofficePage ${isFullscreen ? 'isFullscreen' : ''}`}
    >
      {isFullscreen && (
        <button
          type="button"
          onClick={toggleFullscreen}
          className="fullscreenExitBtn"
          aria-label="ออกจากโหมดเต็มจอ"
        >
          <Minimize2 size={16} />
          <span>ออกจากโหมดเต็มจอ</span>
        </button>
      )}

      <div className="eofficeContainer">
        {!isFullscreen && (
          <div className="eofficeHeaderCard">
            <div className="eofficeTopRow">
              <Breadcrumb
                items={[
                  { label: 'ระบบสารสนเทศ', href: '/systems' },
                  { label: 'สถานะระบบ E-office สป.สธ.' },
                ]}
              />

              <div className="eofficeNoticeLinks">
                <a
                  href={MOPH_SOURCE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="eofficeNoticeLink"
                  title="เปิดหน้าต้นทาง ศทส. สธ."
                >
                  <span>ต้นทาง ศทส. สป.สธ.</span>
                  <ExternalLink size={12} />
                </a>
                <a
                  href={POWER_BI_EMBED_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="eofficeNoticeLink"
                  title="เปิดใน Microsoft Power BI"
                >
                  <span>เปิดใน Power BI</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            <div className="eofficeMainRow">
              <div className="eofficeTitleArea">
                <h1 className="eofficeTitle">
                  Dashboard สรุปสถานะการใช้งานระบบ E-office สป.สธ. (ส่วนภูมิภาค)
                </h1>
              </div>

              <div className="eofficeActions">
                <Link href="/systems" className="eofficeBtn">
                  <ArrowLeft size={15} />
                  <span>กลับหน้ารวมระบบ</span>
                </Link>

                <button
                  type="button"
                  onClick={handleRefresh}
                  className="eofficeBtn"
                  title="รีเฟรชข้อมูลแดชบอร์ด"
                >
                  <RefreshCw
                    size={15}
                    className={isLoading ? 'animate-spin' : ''}
                  />
                  <span>รีเฟรช</span>
                </button>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="eofficeBtn eofficeBtnPrimary"
                  title="แสดงผลเต็มจอ"
                >
                  <Maximize2 size={15} />
                  <span>เต็มจอ</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="eofficeFrameCard">
          {isLoading && (
            <div className="eofficeLoadingOverlay">
              <div className="eofficeSpinner" />
              <span>กำลังโหลดรายงานแดชบอร์ด...</span>
            </div>
          )}

          <iframe
            key={iframeKey}
            title="Dashboard สรุปสถานะการใช้งานระบบ E-office ของหน่วยงานในสังกัด สป.สธ (ส่วนภูมิภาค)"
            src={POWER_BI_EMBED_URL}
            className="eofficeIframe"
            allowFullScreen
            loading="lazy"
            onLoad={() => setIsLoading(false)}
          />
        </div>
      </div>
    </div>
  )
}
