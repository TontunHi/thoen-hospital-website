'use client'

import React, { useState, useRef, useMemo } from 'react'
import MemberLogoutButton from './LogoutButton'
import TelegramLinkModal from './TelegramLinkModal'
import TelegramPromptModal from './TelegramPromptModal'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'

interface MemberInfo {
  id: number
  username: string
  email: string
  name: string | null
  department: string | null
  position: string | null
  profile_path: string | null
  role?: string
  hasSignature?: boolean
}

interface ProfileBannerProps {
  member: MemberInfo
  initials: string
  displayRole: string
  isTelegramLinked?: boolean
}

export default function ProfileBanner({
  member,
  initials,
  displayRole,
  isTelegramLinked = false,
}: ProfileBannerProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [hasAvatar, setHasAvatar] = useState<boolean>(!!member.profile_path)
  const [avatarTimestamp, setAvatarTimestamp] = useState<number>(0)
  const [uploading, setUploading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState<boolean>(false)
  const [isTelegramPromptOpen, setIsTelegramPromptOpen] = useState<boolean>(false)
  const [telegramLinked, setTelegramLinked] = useState<boolean>(isTelegramLinked)

  React.useEffect(() => {
    setTelegramLinked(isTelegramLinked)
  }, [isTelegramLinked])


  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    setUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/member/profile', {
        method: 'POST',
        body: formData,
      })

      const data = res.ok ? await res.json() : null

      if (res.ok && data?.success) {
        setHasAvatar(true)
        setAvatarTimestamp(Date.now())
        router.refresh()
      } else {
        setError(data?.error || 'ไม่สามารถอัปโหลดรูปโปรไฟล์ได้')
      }
    } catch (err) {
      console.error('Failed to upload avatar:', err)
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const deptAndPositionText = useMemo(() => {
    const parts = [member.position, member.department].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : null
  }, [member.position, member.department])

  return (
    <div className="pb-card">
      {/* ── Section 1: Hospital Brand Accent Header Strip ── */}
      <div className="pb-header" aria-hidden="true" />

      {/* ── Section 2: Identity Row (Avatar + Name + Logout) ── */}
      <div className="pb-identity">
        {/* Avatar */}
        <div className="pb-avatarWrap">
          <div
            className="pb-avatar"
            onClick={handleAvatarClick}
            title="คลิกเพื่ออัปโหลดรูปภาพโปรไฟล์"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleAvatarClick()
              }
            }}
          >
            {hasAvatar ? (
              <img
                src={`/api/member/profile/image?userId=${member.id}&t=${avatarTimestamp}`}
                alt={member.name || 'Avatar'}
                className="pb-avatarImg"
              />
            ) : (
              <span className="pb-avatarInitials">{initials}</span>
            )}
            <div className="pb-avatarOverlay" aria-hidden="true">
              {uploading ? (
                <span
                  className="material-symbols-outlined animate-spin"
                  style={{ fontSize: '20px' }}
                >
                  progress_activity
                </span>
              ) : (
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '20px' }}
                >
                  photo_camera
                </span>
              )}
            </div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            style={{ display: 'none' }}
            disabled={uploading}
          />
        </div>

        {/* User Info Details */}
        <div className="pb-nameGroup">
          <div className="pb-nameRow">
            <h2 className="pb-fullName">{member.name || 'ไม่ได้ระบุชื่อ-นามสกุล'}</h2>
            <span className={`pb-tag pb-tagRole ${member.role === 'subdistrict' ? 'pb-tagRoleSub' : ''}`}>
              {displayRole}
            </span>
          </div>

          <div className="pb-subInfo">
            <span>ตำแหน่งและแผนก: </span>
            {deptAndPositionText ? (
              <span className="pb-subInfoValue">{deptAndPositionText}</span>
            ) : (
              <span className="pb-subInfoEmpty">
                ยังไม่ระบุ · <span className="pb-addInfoText">เพิ่มข้อมูล</span>
              </span>
            )}
          </div>

          {error && <div className="pb-errorMsg">{error}</div>}
        </div>

        {/* Logout slot */}
        <div className="pb-logoutSlot">
          <MemberLogoutButton />
        </div>
      </div>

      {/* ── Section 3: Quick Info & Status Chips Bar ── */}
      <div className="pb-infoBar">
        <div className="pb-chip">
          <span className="material-symbols-outlined pb-chipIcon" aria-hidden="true">
            badge
          </span>
          <span className="pb-chipLabel">ตำแหน่ง</span>
          <span className="pb-chipValue">{member.position || 'ไม่ได้ระบุ'}</span>
        </div>

        <div className="pb-chip">
          <span className="material-symbols-outlined pb-chipIcon" aria-hidden="true">
            domain
          </span>
          <span className="pb-chipLabel">แผนก</span>
          <span className="pb-chipValue">{member.department || 'ไม่ได้ระบุ'}</span>
        </div>

        {telegramLinked ? (
          <button
            type="button"
            className="pb-chip pb-chipAction pb-chipConnected"
            onClick={() => setIsTelegramModalOpen(true)}
            title="คลิกเพื่อดูข้อมูลการเชื่อมต่อ Telegram"
          >
            <div className="pb-telegramBadge" aria-hidden="true">
              <Send size={13} />
            </div>
            <span className="pb-chipLabel">การแจ้งเตือน</span>
            <span className="pb-chipValue pb-chipConnectedValue">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '15px' }}
                aria-hidden="true"
              >
                check_circle
              </span>
              เชื่อมต่อแล้ว
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="pb-chip pb-chipAction"
            onClick={() => setIsTelegramModalOpen(true)}
            title="คลิกเพื่อเชื่อมต่อบัญชี Telegram"
          >
            <div className="pb-telegramBadge" aria-hidden="true">
              <Send size={13} />
            </div>
            <span className="pb-chipLabel">การแจ้งเตือน</span>
            <span className="pb-chipValue pb-chipPromptValue">
              ยังไม่ได้เชื่อมต่อ
            </span>
          </button>
        )}

        {member.role !== 'subdistrict' && (
          member.hasSignature ? (
            <Link
              href="/member/signature"
              className="pb-chip pb-chipAction pb-chipConnected"
              title="ดูลายมือชื่ออิเล็กทรอนิกส์ของคุณ"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '15px' }}
                aria-hidden="true"
              >
                draw
              </span>
              <span className="pb-chipLabel">ลายเซ็น</span>
              <span className="pb-chipValue pb-chipConnectedValue">
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '15px' }}
                  aria-hidden="true"
                >
                  check_circle
                </span>
                มีแล้ว
              </span>
            </Link>
          ) : (
            <Link
              href="/member/signature"
              className="pb-chip pb-chipAction"
              title="คลิกเพื่อบันทึกลายมือชื่ออิเล็กทรอนิกส์"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '15px' }}
                aria-hidden="true"
              >
                draw
              </span>
              <span className="pb-chipLabel">ลายเซ็น</span>
              <span className="pb-chipValue pb-chipPromptValue">
                ยังไม่มีลายเซ็น
              </span>
            </Link>
          )
        )}
      </div>

      <TelegramLinkModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
        onLinked={() => {
          setTelegramLinked(true)
          router.refresh()
        }}
        onUnlinked={() => {
          setTelegramLinked(false)
          router.refresh()
        }}
      />

      <TelegramPromptModal
        isLinked={telegramLinked}
        memberId={member.id}
        onOpenConnectModal={() => setIsTelegramModalOpen(true)}
        onVisibilityChange={setIsTelegramPromptOpen}
      />
    </div>
  )
}
