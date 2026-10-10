'use client'

import React from 'react'
import { Search, X, RefreshCw } from 'lucide-react'

interface RegistrationFilterBarProps {
  statusFilter: 'all' | 'pending' | 'approved' | 'rejected'
  setStatusFilter: (status: 'all' | 'pending' | 'approved' | 'rejected') => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  onSearchSubmit: (e: React.FormEvent) => void
  onRefresh: () => void
  loading: boolean
  totalCount: number
  pendingCount: number
  approvedCount: number
  rejectedCount: number
}

export function RegistrationFilterBar({
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  onRefresh,
  loading,
  totalCount,
  pendingCount,
  approvedCount,
  rejectedCount,
}: RegistrationFilterBarProps) {
  return (
    <>
      <div className="adminTitleRow">
        <div>
          <h1 className="adminTitle">ตรวจสอบคำขอลงทะเบียนบุคลากร</h1>
          <p className="adminSubtitle">
            ตรวจสอบ พิจารณาอนุมัติคำขอเปิดบัญชีเข้าใช้งานระบบ และดูประวัติย้อนหลัง
          </p>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="statsGrid">
        <div
          className={`statCard ${statusFilter === 'all' ? 'activeStat' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          <span className="statLabel">คำขอทั้งหมด</span>
          <span className="statValue text-slate-800">{totalCount}</span>
        </div>

        <div
          className={`statCard ${statusFilter === 'pending' ? 'activeStat' : ''}`}
          onClick={() => setStatusFilter('pending')}
        >
          <div className="flex items-center justify-between">
            <span className="statLabel">รอตรวจสอบ</span>
            <span className="statDot bg-amber-500" />
          </div>
          <span className="statValue text-amber-600">{pendingCount}</span>
        </div>

        <div
          className={`statCard ${statusFilter === 'approved' ? 'activeStat' : ''}`}
          onClick={() => setStatusFilter('approved')}
        >
          <div className="flex items-center justify-between">
            <span className="statLabel">อนุมัติแล้ว</span>
            <span className="statDot bg-emerald-500" />
          </div>
          <span className="statValue text-emerald-600">{approvedCount}</span>
        </div>

        <div
          className={`statCard ${statusFilter === 'rejected' ? 'activeStat' : ''}`}
          onClick={() => setStatusFilter('rejected')}
        >
          <div className="flex items-center justify-between">
            <span className="statLabel">ไม่อนุมัติ</span>
            <span className="statDot bg-rose-500" />
          </div>
          <span className="statValue text-rose-600">{rejectedCount}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filterToolbar">
        <div className="tabFilterGroup">
          <button
            type="button"
            className={`filterTab ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            ทั้งหมด ({totalCount})
          </button>
          <button
            type="button"
            className={`filterTab ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            รอตรวจสอบ ({pendingCount})
          </button>
          <button
            type="button"
            className={`filterTab ${statusFilter === 'approved' ? 'active' : ''}`}
            onClick={() => setStatusFilter('approved')}
          >
            อนุมัติแล้ว ({approvedCount})
          </button>
          <button
            type="button"
            className={`filterTab ${statusFilter === 'rejected' ? 'active' : ''}`}
            onClick={() => setStatusFilter('rejected')}
          >
            ไม่อนุมัติ ({rejectedCount})
          </button>
        </div>

        <form onSubmit={onSearchSubmit} className="searchForm">
          <div className="searchBox">
            <Search size={16} className="searchIcon" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, เลขบัตร, แผนก, ตำแหน่ง…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="searchInput"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  onRefresh()
                }}
                className="clearSearchBtn"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button type="submit" className="searchBtn">
            ค้นหา
          </button>
        </form>
      </div>
    </>
  )
}
