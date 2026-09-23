'use client'

import React, { useState, useRef } from 'react'
import { Camera, Briefcase, Building2, Loader2, Send, User } from 'lucide-react'
import MemberLogoutButton from './LogoutButton'
import TelegramLinkModal from './TelegramLinkModal'
import { useRouter } from 'next/navigation'

interface MemberInfo {
  id: number
  username: string
  email: string
  name: string | null
  department: string | null
  position: string | null
  profile_path: string | null
  role?: string
}

interface ProfileBannerProps {
  member: MemberInfo
  initials: string
  displayRole: string
}

export default function ProfileBanner({ member, initials, displayRole }: ProfileBannerProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [hasAvatar, setHasAvatar] = useState<boolean>(!!member.profile_path)
  const [avatarTimestamp, setAvatarTimestamp] = useState<number>(0)
  const [uploading, setUploading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState<boolean>(false)

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
        router.refresh() // Refresh page to propagate changes
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

  return (
    <div className="pb-card">
      {/* ── Section 1: Gradient Header Strip ── */}
      <div className="pb-header" />

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
            <div className="pb-avatarOverlay">
              {uploading ? (
                <Loader2 className="animate-spin" size={22} />
              ) : (
                <Camera size={22} />
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

        {/* Name & Tags */}
        <div className="pb-nameGroup">
          <h2 className="pb-fullName">{member.name || 'ไม่ได้ระบุชื่อ-นามสกุล'}</h2>
          <div className="pb-tagsRow">
            <span className="pb-tag pb-tagId">
              <User size={12} />
              @{member.username}
            </span>
            <span className={`pb-tag pb-tagRole ${member.role === 'subdistrict' ? 'pb-tagRoleSub' : ''}`}>
              {displayRole}
            </span>
          </div>
          {error && <div className="pb-errorMsg">{error}</div>}
        </div>

        {/* Logout – pushed right on desktop */}
        <div className="pb-logoutSlot">
          <MemberLogoutButton />
        </div>
      </div>

      {/* ── Section 3: Quick-Info Chips ── */}
      <div className="pb-infoBar">
        <div className="pb-chip">
          <Briefcase size={15} className="pb-chipIcon" />
          <span className="pb-chipLabel">ตำแหน่ง</span>
          <span className="pb-chipValue">{member.position || 'ไม่ได้ระบุ'}</span>
        </div>
        <div className="pb-chip">
          <Building2 size={15} className="pb-chipIcon" />
          <span className="pb-chipLabel">แผนก</span>
          <span className="pb-chipValue">{member.department || 'ไม่ได้ระบุ'}</span>
        </div>
        <button 
          type="button" 
          className="pb-chip pb-chipAction" 
          onClick={() => setIsTelegramModalOpen(true)}
        >
          <Send size={15} className="pb-chipIcon pb-chipIconTg" />
          <span className="pb-chipLabel">การแจ้งเตือน</span>
          <span className="pb-chipValue">เชื่อมระบบ Telegram</span>
        </button>
      </div>

      <TelegramLinkModal 
        isOpen={isTelegramModalOpen} 
        onClose={() => setIsTelegramModalOpen(false)} 
      />
    </div>
  )
}
