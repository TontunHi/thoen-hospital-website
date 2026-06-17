'use client'

import React, { useState, useRef } from 'react'
import { Camera, Briefcase, Shield, Loader2 } from 'lucide-react'
import MemberLogoutButton from './LogoutButton'
import { useRouter } from 'next/navigation'

interface MemberInfo {
  id: number
  username: string
  email: string
  name: string | null
  department: string | null
  position: string | null
  profile_path: string | null
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
  const [avatarTimestamp, setAvatarTimestamp] = useState<number>(() => Date.now())
  const [uploading, setUploading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

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

      const data = await res.ok ? await res.json() : null

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
    <div className="profileBannerCard">
      <div className="bannerBackground"></div>
      <div className="profileBannerContent">
        <div className="avatarWrapper">
          <div className="userAvatar clickableAvatar" onClick={handleAvatarClick} title="คลิกเพื่ออัปโหลดรูปภาพโปรไฟล์">
            {hasAvatar ? (
              <img
                src={`/api/member/profile/image?userId=${member.id}&t=${avatarTimestamp}`}
                alt={member.name || 'Avatar'}
                className="userAvatarImage"
              />
            ) : (
              <span className="userAvatarText">{initials}</span>
            )}
            
            <div className="avatarUploadOverlay">
              {uploading ? (
                <Loader2 className="uploadSpinner animate-spin" size={24} />
              ) : (
                <Camera size={24} />
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

        <div className="userInfoGroup">
          <div className="userNameArea">
            <div className="userNameRow">
              <h2>{member.name || 'ไม่ได้ระบุชื่อ-นามสกุล'}</h2>
              <span className="usernameTag">@{member.username}</span>
              <span className="usernameTag roleTag">
                {displayRole}
              </span>
            </div>
            {error && <div className="avatarErrorText">{error}</div>}
          </div>

          <div className="userDetailsGrid">
            <div className="userDetailItem">
              <Briefcase size={16} className="detailIcon" />
              <span>ตำแหน่ง: <strong>{member.position || 'ไม่ได้ระบุ'}</strong></span>
            </div>
            <div className="userDetailItem">
              <Shield size={16} className="detailIcon" />
              <span>แผนก/กลุ่มงาน: <strong>{member.department || 'ไม่ได้ระบุ'}</strong></span>
            </div>
          </div>
        </div>

        <div className="logoutButtonWrapper">
          <MemberLogoutButton />
        </div>
      </div>
    </div>
  )
}
