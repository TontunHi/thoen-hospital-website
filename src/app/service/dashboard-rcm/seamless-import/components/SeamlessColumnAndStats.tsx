'use client'

import React from 'react'
import { CheckCircle2, Database, FileSpreadsheet, Layers, Receipt } from 'lucide-react'
import type { ParsedSeamlessRow, SeamlessDatabaseStats } from '@/lib/clinical/rcmSeamlessImportService'

export interface SeamlessDynamicColumn {
  key: string
  header: string
  align?: 'left' | 'right' | 'center'
  width?: string
  render: (row: ParsedSeamlessRow, idx: number) => React.ReactNode
}

export function buildSeamlessDynamicColumns(rows: ParsedSeamlessRow[]): SeamlessDynamicColumn[] {
  if (rows.length === 0) return []

  const cols: SeamlessDynamicColumn[] = [
    {
      key: 'index',
      header: 'ลำดับ',
      width: '60px',
      align: 'center',
      render: (_row, idx) => (
        <span style={{ color: '#64748b', fontSize: '0.8125rem' }} className="tabular-nums">
          {idx + 1}
        </span>
      ),
    },
  ]

  if (rows.some((r) => r.id && r.id.trim() !== '')) {
    cols.push({
      key: 'id',
      header: 'Trans ID',
      align: 'center',
      render: (r) => (
        <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: '#475569' }}>
          {r.id}
        </span>
      ),
    })
  }

  if (rows.some((r) => r.rep && r.rep.trim() !== '')) {
    cols.push({
      key: 'rep',
      header: 'Rep',
      align: 'center',
      render: (r) => <span style={{ fontWeight: 600, color: '#334155' }}>{r.rep}</span>,
    })
  }

  if (rows.some((r) => r.fund && r.fund.trim() !== '' && r.fund !== 'ไม่ระบุกองทุน')) {
    cols.push({
      key: 'fund',
      header: 'กองทุน',
      align: 'center',
      render: (r) => <span className="seamless-fund-tag">{r.fund}</span>,
    })
  }

  if (rows.some((r) => r.pid && r.pid.trim() !== '')) {
    cols.push({
      key: 'pid',
      header: 'เลขบัตรประชาชน',
      align: 'center',
      render: (r) => (
        <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{r.pid}</span>
      ),
    })
  }

  if (rows.some((r) => r.hn && r.hn.trim() !== '')) {
    cols.push({
      key: 'hn',
      header: 'HN',
      align: 'center',
      render: (r) => (
        <span style={{ fontWeight: 600, color: '#047857' }}>{r.hn || '—'}</span>
      ),
    })
  }

  if (rows.some((r) => r.vn && r.vn.trim() !== '')) {
    cols.push({
      key: 'vn',
      header: 'VN',
      align: 'center',
      render: (r) => (
        <span style={{ color: '#64748b', fontSize: '0.8125rem' }}>{r.vn || '—'}</span>
      ),
    })
  }

  if (rows.some((r) => r.ptname && r.ptname.trim() !== '')) {
    cols.push({
      key: 'ptname',
      header: 'ชื่อ-สกุล',
      align: 'center',
      render: (r) => <span>{r.ptname || '—'}</span>,
    })
  }

  if (rows.some((r) => r.admDate && r.admDate.trim() !== '')) {
    cols.push({
      key: 'admDate',
      header: 'วันที่บริการ',
      align: 'center',
      render: (r) => <span style={{ fontSize: '0.8125rem' }}>{r.admDate || '—'}</span>,
    })
  }

  if (rows.some((r) => r.sendDate && r.sendDate.trim() !== '')) {
    cols.push({
      key: 'sendDate',
      header: 'วันที่ส่ง',
      align: 'center',
      render: (r) => <span style={{ fontSize: '0.8125rem' }}>{r.sendDate || '—'}</span>,
    })
  }

  if (rows.some((r) => r.mainInscl && r.mainInscl.trim() !== '')) {
    cols.push({
      key: 'mainInscl',
      header: 'สิทธิการรักษา',
      align: 'center',
      render: (r) => <span>{r.mainInscl || '—'}</span>,
    })
  }

  if (rows.some((r) => r.type && r.type.trim() !== '')) {
    cols.push({
      key: 'type',
      header: 'ประเภทบริการ',
      align: 'center',
      render: (r) => <span>{r.type || '—'}</span>,
    })
  }

  if (rows.some((r) => r.serialNo && r.serialNo.trim() !== '')) {
    cols.push({
      key: 'serialNo',
      header: 'ครั้งที่',
      align: 'center',
      render: (r) => <span>{r.serialNo || '—'}</span>,
    })
  }

  if (rows.some((r) => (r.collected || 0) > 0)) {
    cols.push({
      key: 'collected',
      header: 'เรียกเก็บ',
      align: 'center',
      render: (r) => (
        <span className="tabular-nums" style={{ color: '#475569' }}>
          {r.collected ? r.collected.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '—'}
        </span>
      ),
    })
  }

  if (rows.some((r) => (r.compensated || 0) > 0)) {
    cols.push({
      key: 'compensated',
      header: 'ชดเชย',
      align: 'center',
      render: (r) => (
        <span style={{ fontWeight: 700, color: '#0f172a' }} className="tabular-nums">
          {r.compensated ? r.compensated.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '—'}
        </span>
      ),
    })
  }

  if (rows.some((r) => (r.noCompensated || 0) > 0)) {
    cols.push({
      key: 'noCompensated',
      header: 'ไม่ชดเชย',
      align: 'center',
      render: (r) => (
        <span style={{ color: '#dc2626', fontWeight: 600 }} className="tabular-nums">
          {r.noCompensated ? r.noCompensated.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '—'}
        </span>
      ),
    })
  }

  if (rows.some((r) => (r.equipName && r.equipName.trim() !== '') || (r.equipCode && r.equipCode.trim() !== ''))) {
    cols.push({
      key: 'equip',
      header: 'อุปกรณ์',
      align: 'center',
      render: (r) => <span>{r.equipName || r.equipCode || '—'}</span>,
    })
  }

  if (rows.some((r) => r.note && r.note.trim() !== '')) {
    cols.push({
      key: 'note',
      header: 'หมายเหตุ',
      align: 'center',
      render: (r) => (
        <span style={{ fontSize: '0.75rem', color: '#dc2626' }} title={r.note || ''}>
          {r.note || '—'}
        </span>
      ),
    })
  }

  if (rows.some((r) => Boolean(r.hn || r.vn))) {
    cols.push({
      key: 'hosMatch',
      header: 'สถานะ HOSxP',
      align: 'center',
      render: (r) =>
        r.hn ? (
          <span className="seamless-badge-match match">
            <CheckCircle2 size={12} />
            พบในระบบ
          </span>
        ) : (
          <span className="seamless-badge-match unmatch">ไม่พบ HN</span>
        ),
    })
  }

  return cols
}

export function SeamlessStatsGrid({
  stats,
  isRefreshingStats,
}: {
  stats: SeamlessDatabaseStats | null
  isRefreshingStats: boolean
}) {
  return (
    <div className="seamless-stats-grid">
      <div className="seamless-stat-card">
        <div className="seamless-stat-icon-wrap emerald">
          <Database size={20} />
        </div>
        <div className="seamless-stat-info">
          <span className="seamless-stat-label">รายการชดเชยในฐานข้อมูล</span>
          {isRefreshingStats ? (
            <div className="rcm-skeleton-bar" style={{ width: '100px', height: '24px', margin: '4px 0' }} />
          ) : (
            <span className="seamless-stat-value tabular-nums">
              {(stats?.totalRows ?? 0).toLocaleString('th-TH')}
            </span>
          )}
          <span className="seamless-stat-sub">ตารางฐานข้อมูล Seamless</span>
        </div>
      </div>

      <div className="seamless-stat-card">
        <div className="seamless-stat-icon-wrap blue">
          <Receipt size={20} />
        </div>
        <div className="seamless-stat-info">
          <span className="seamless-stat-label">ยอดเงินชดเชยสะสมรวม</span>
          {isRefreshingStats ? (
            <div className="rcm-skeleton-bar" style={{ width: '130px', height: '24px', margin: '4px 0' }} />
          ) : (
            <span className="seamless-stat-value tabular-nums">
              ฿{(stats?.totalCompensated ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </span>
          )}
          <span className="seamless-stat-sub">ยอดชดเชยรวมทุกกองทุน</span>
        </div>
      </div>

      <div className="seamless-stat-card">
        <div className="seamless-stat-icon-wrap amber">
          <Layers size={20} />
        </div>
        <div className="seamless-stat-info">
          <span className="seamless-stat-label">จำนวนไฟล์ที่นำเข้าแล้ว</span>
          {isRefreshingStats ? (
            <div className="rcm-skeleton-bar" style={{ width: '80px', height: '24px', margin: '4px 0' }} />
          ) : (
            <span className="seamless-stat-value tabular-nums">
              {(stats?.totalFiles ?? 0).toLocaleString('th-TH')} ไฟล์
            </span>
          )}
          <span className="seamless-stat-sub">ไฟล์รายงานที่บันทึกสำเร็จ</span>
        </div>
      </div>

      <div className="seamless-stat-card">
        <div className="seamless-stat-icon-wrap purple">
          <FileSpreadsheet size={20} />
        </div>
        <div className="seamless-stat-info">
          <span className="seamless-stat-label">จำนวนเลขที่ Rep / หน่วยอื่น / รอวันโอน</span>
          {isRefreshingStats ? (
            <div className="rcm-skeleton-bar" style={{ width: '80px', height: '24px', margin: '4px 0' }} />
          ) : (
            <span className="seamless-stat-value tabular-nums">
              {(stats?.totalReps ?? 0).toLocaleString('th-TH')} Rep
            </span>
          )}
          <span className="seamless-stat-sub tabular-nums">
            ต่างหน่วย {(stats?.otherHospCount ?? 0).toLocaleString('th-TH')} • รอวันโอน{' '}
            {(stats?.missingPayDateCount ?? 0).toLocaleString('th-TH')} • Deny{' '}
            {(stats?.denyCodeCount ?? 0).toLocaleString('th-TH')}
          </span>
        </div>
      </div>
    </div>
  )
}
