'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Trophy,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Sparkles,
  Home,
} from 'lucide-react'

function CheckinStatusContent() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status') || 'error'
  const message = searchParams.get('message') || ''
  const name = searchParams.get('name') || ''
  const dept = searchParams.get('dept') || ''
  const eventTitle = searchParams.get('event') || ''
  const points = searchParams.get('points') || '1'
  const time = searchParams.get('time') || ''
  const type = searchParams.get('type') || ''
  const openTime = searchParams.get('openTime') || ''
  const closeTime = searchParams.get('closeTime') || ''

  const formatThaiTime = (isoString?: string) => {
    if (!isoString) return ''
    try {
      const d = new Date(isoString)
      return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
    } catch {
      return isoString
    }
  }

  // 1. Success State
  if (status === 'success') {
    return (
      <div className="bg-white rounded-3xl shadow-lg border border-emerald-100 p-8 sm:p-10 text-center max-w-md w-full relative overflow-hidden">
        {/* Top green glow */}
        <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />

        {/* Success Icon */}
        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-5 ring-8 ring-emerald-50 animate-bounce">
          <CheckCircle2 size={44} />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-3">
          <ShieldCheck size={14} className="text-emerald-600" />
          ยืนยันตัวตนด้วย ThaID สำเร็จ
        </div>

        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">
          เช็คอินเข้าร่วมกิจกรรมสำเร็จ!
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          ระบบได้บันทึกการเข้าร่วมงานและเพิ่มคะแนนให้ท่านเรียบร้อยแล้ว
        </p>

        {/* User Card */}
        <div className="my-6 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-left space-y-2 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block font-medium">ชื่อผู้เข้าร่วม</span>
            <span className="font-bold text-slate-800 text-sm">{name || 'บุคลากรโรงพยาบาลเถิน'}</span>
          </div>

          {dept && (
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">กลุ่มงาน / แผนก</span>
              <span className="font-semibold text-slate-700">{dept}</span>
            </div>
          )}

          {eventTitle && (
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">กิจกรรม</span>
              <span className="font-semibold text-emerald-800">{eventTitle}</span>
            </div>
          )}

          {time && (
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">เวลาที่เช็คอิน</span>
              <span className="text-slate-600">{formatThaiTime(time)}</span>
            </div>
          )}
        </div>

        {/* Points Awarded Badge */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-emerald-50 border border-emerald-200 flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-amber-600" />
            <span className="text-xs font-semibold text-slate-800">คะแนนที่ได้รับ</span>
          </div>
          <span className="text-base font-black text-emerald-800">+{points} คะแนน 🎉</span>
        </div>

        {/* Navigation Action Buttons */}
        <div className="space-y-2.5">
          <Link
            href="/member/events/leaderboard"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
          >
            <Trophy size={16} />
            <span>ดูกระดานอันดับคะแนน (Leaderboard)</span>
          </Link>
          <Link
            href="/member/events"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Home size={15} />
            <span>กลับหน้ารายการกิจกรรม</span>
          </Link>
        </div>
      </div>
    )
  }

  // 2. Time Window Error State
  if (status === 'time_error') {
    const isEarly = type === 'early'
    return (
      <div className="bg-white rounded-3xl shadow-lg border border-amber-100 p-8 sm:p-10 text-center max-w-md w-full relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-3 bg-amber-500" />

        <div className="w-20 h-20 mx-auto rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-5 ring-8 ring-amber-50">
          <Clock size={44} />
        </div>

        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">
          {isEarly ? 'ยังไม่ถึงเวลาเปิดรับสแกน' : 'หมดเวลาเช็คอินแล้ว'}
        </h1>

        <p className="text-xs sm:text-sm text-slate-600 mt-2">
          {isEarly
            ? `กิจกรรมนี้จะเปิดให้สแกนเช็คอินเวลา ${formatThaiTime(openTime)}`
            : `กิจกรรมนี้ปิดรับสแกนเช็คอินไปแล้วเมื่อเวลา ${formatThaiTime(closeTime)}`}
        </p>

        {eventTitle && (
          <div className="my-5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800">
            {eventTitle}
          </div>
        )}

        <div className="pt-2">
          <Link
            href="/member/events"
            className="inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-900 text-white transition-colors"
          >
            <span>กลับหน้ารายการกิจกรรม</span>
          </Link>
        </div>
      </div>
    )
  }

  // 3. Generic Error State (e.g. not a member, duplicate, etc.)
  return (
    <div className="bg-white rounded-3xl shadow-lg border border-rose-100 p-8 sm:p-10 text-center max-w-md w-full relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-3 bg-rose-500" />

      <div className="w-20 h-20 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-5 ring-8 ring-rose-50">
        <XCircle size={44} />
      </div>

      <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">
        ไม่สามารถเช็คอินได้
      </h1>

      <p className="text-xs sm:text-sm text-rose-700 mt-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200 leading-relaxed">
        {message || 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูล หรือรหัสกิจกรรมไม่ถูกต้อง'}
      </p>

      <div className="mt-6 space-y-2.5">
        <Link
          href="/member/events"
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-900 text-white transition-colors"
        >
          <span>กลับหน้ารายการกิจกรรม</span>
        </Link>
      </div>
    </div>
  )
}

export default function CheckinStatusPage() {
  return (
    <div className="min-h-screen bg-slate-100/80 flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="p-8 text-center text-xs text-slate-400">
            กำลังโหลดข้อมูลผลการเช็คอิน...
          </div>
        }
      >
        <CheckinStatusContent />
      </Suspense>
    </div>
  )
}
