'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { User, X, ZoomIn } from 'lucide-react'
import { getInitials } from '@/lib/formatters'
import { isLeaderRole } from '@/lib/departments/orgTreeUtils'
import type { PublicMember } from './orgDragContext'

interface PersonnelDrawerProps {
  member: PublicMember
  groupName: string
  onClose: () => void
}

/**
 * Slide-over Detail Drawer for personnel profile inspection (Desktop right drawer / Mobile bottom sheet).
 * PDPA-safe: intentionally excludes phone numbers and private contact details.
 */
export default function PersonnelDrawer({ member, groupName, onClose }: PersonnelDrawerProps) {
  const [isZoomed, setIsZoomed] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isZoomed) {
          setIsZoomed(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose, isZoomed])

  const roleText = useMemo(() => {
    if (isLeaderRole(member.role)) {
      return 'หัวหน้ากลุ่มงาน / หัวหน้างาน'
    }
    if (member.role && member.role !== 'member' && member.role !== 'เจ้าหน้าที่ผู้ปฏิบัติงาน') {
      return member.role
    }
    return 'บุคลากรผู้ปฏิบัติงาน'
  }, [member.role])

  return (
    <>
      <div
        className="orgDrawerOverlay"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-drawer-title"
      >
        <aside
          className="orgDrawerPanel"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="orgDrawerHeader">
            <div className="orgDrawerHeaderTitle">
              <User size={18} strokeWidth={1.5} className="orgIconAccent" aria-hidden="true" />
              <h3 id="member-drawer-title">ข้อมูลบุคลากร</h3>
            </div>
            <button
              type="button"
              className="orgDrawerCloseIconBtn"
              onClick={onClose}
              aria-label="ปิดหน้าต่าง"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          <div className="orgDrawerBody">
            <div className="orgDrawerProfileTop">
              <div
                className={`orgDrawerPortraitWrap ${member.imagePath ? 'hasZoom' : ''}`}
                onClick={() => {
                  if (member.imagePath) setIsZoomed(true)
                }}
                title={member.imagePath ? 'คลิกเพื่อดูรูปภาพขยายขนาดเต็ม' : undefined}
                role={member.imagePath ? 'button' : undefined}
                tabIndex={member.imagePath ? 0 : undefined}
                onKeyDown={(e) => {
                  if (member.imagePath && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    setIsZoomed(true)
                  }
                }}
              >
                {member.imagePath ? (
                  <>
                    <img
                      src={member.imagePath}
                      alt={member.name}
                      className="orgDrawerPortrait"
                    />
                    <span className="orgDrawerZoomBadge">
                      <ZoomIn size={13} strokeWidth={1.5} aria-hidden="true" />
                      <span>ขยายรูป</span>
                    </span>
                  </>
                ) : (
                  <div className="orgDrawerPortraitFallback">
                    {getInitials(member.name)}
                  </div>
                )}
              </div>

              <h4 className="orgDrawerName">{member.name}</h4>
              <span className="orgDrawerRoleChip">{roleText}</span>
            </div>

            <dl className="orgDrawerMetaList">
              <div className="orgDrawerMetaRow">
                <dt className="orgDrawerMetaLabel">ชื่อ - นามสกุล</dt>
                <dd className="orgDrawerMetaValue isPrimary">{member.name}</dd>
              </div>
              <div className="orgDrawerMetaRow">
                <dt className="orgDrawerMetaLabel">ตำแหน่ง</dt>
                <dd className="orgDrawerMetaValue">{member.position}</dd>
              </div>
              <div className="orgDrawerMetaRow">
                <dt className="orgDrawerMetaLabel">แผนก / กลุ่มงาน</dt>
                <dd className="orgDrawerMetaValue isAccent">{groupName || 'โรงพยาบาลเถิน'}</dd>
              </div>
            </dl>
          </div>

          <div className="orgDrawerFooter">
            <button
              type="button"
              className="orgDrawerCloseBtn"
              onClick={onClose}
            >
              ปิด
            </button>
          </div>
        </aside>
      </div>

      {isZoomed && member.imagePath && (
        <div
          className="orgLightboxOverlay"
          onClick={() => setIsZoomed(false)}
          role="dialog"
          aria-modal="true"
          aria-label="รูปภาพขนาดเต็ม"
        >
          <div className="orgLightboxContent" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="orgLightboxCloseBtn"
              onClick={() => setIsZoomed(false)}
              aria-label="ปิดรูปภาพขนาดเต็ม"
            >
              <X size={20} strokeWidth={1.5} />
            </button>
            <img
              src={member.imagePath}
              alt={member.name}
              className="orgLightboxImage"
            />
            <div className="orgLightboxCaption">
              <span className="orgLightboxName">{member.name}</span>
              <span className="orgLightboxPosition">{member.position}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
