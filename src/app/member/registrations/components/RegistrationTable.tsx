'use client'

import React from 'react'
import {
  RefreshCw,
  FileText,
  Eye,
  Edit3,
  UserCheck,
  UserX,
  Trash2,
} from 'lucide-react'
import type { RegistrationRecord } from '@/lib/registration/RegistrationService'

interface RegistrationTableProps {
  registrations: RegistrationRecord[]
  loading: boolean
  searchQuery: string
  onView: (item: RegistrationRecord) => void
  onEdit: (item: RegistrationRecord) => void
  onApprove: (id: number) => void
  onReject: (id: number) => void
  onDelete: (id: number) => void
  getStatusBadge: (status: string) => React.ReactNode
}

export function RegistrationTable({
  registrations,
  loading,
  searchQuery,
  onView,
  onEdit,
  onApprove,
  onReject,
  onDelete,
  getStatusBadge,
}: RegistrationTableProps) {
  if (loading) {
    return (
      <div className="loadingState">
        <RefreshCw size={28} className="animate-spin text-emerald-600 mb-2" />
        <p>กำลังโหลดข้อมูลคำขอสมัคร…</p>
      </div>
    )
  }

  if (registrations.length === 0) {
    return (
      <div className="emptyState">
        <FileText size={40} className="text-slate-300 mb-2" />
        <p className="emptyTitle">ไม่พบรายการคำขอลงทะเบียน</p>
        <p className="emptySubtitle">
          {searchQuery ? 'ลองเปลี่ยนคำค้นหา หรือรีเซ็ตตัวกรอง' : 'ยังไม่มีคำขอสมัครในสถานะนี้'}
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="tableResponsive">
        <table className="dataTable">
          <thead>
            <tr>
              <th>วันที่ส่ง</th>
              <th>ชื่อ-นามสกุล</th>
              <th>เลขบัตรประชาชน</th>
              <th>กลุ่มงาน / ตำแหน่ง</th>
              <th>ข้อมูลติดต่อ</th>
              <th>สถานะ</th>
              <th className="text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((item) => (
              <tr key={item.id}>
                <td className="whitespace-nowrap text-xs text-slate-500">
                  {new Date(item.createdAt).toLocaleDateString('th-TH', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td>
                  <div className="font-semibold text-slate-800">
                    {item.title}
                    {item.firstNameTh} {item.lastNameTh}
                  </div>
                  <div className="text-xs text-slate-500">
                    {item.firstNameEn} {item.lastNameEn} ({item.nickname})
                  </div>
                </td>
                <td className="tabularNums text-sm text-slate-700">{item.citizenId}</td>
                <td>
                  <div className="text-sm font-medium text-slate-800">{item.department}</div>
                  <div className="text-xs text-slate-500">
                    {item.position} • {item.level}
                  </div>
                </td>
                <td>
                  <div className="text-xs text-slate-700">{item.email}</div>
                  <div className="text-xs text-slate-500">{item.phone}</div>
                </td>
                <td>{getStatusBadge(item.status)}</td>
                <td>
                  <div className="actionBtnGroup">
                    <button
                      type="button"
                      className="btnIcon actionView"
                      title="ดูรายละเอียด"
                      onClick={() => onView(item)}
                    >
                      <Eye size={16} />
                    </button>

                    <button
                      type="button"
                      className="btnIcon actionEdit"
                      title="แก้ไขข้อมูล"
                      onClick={() => onEdit(item)}
                    >
                      <Edit3 size={16} />
                    </button>

                    {item.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          className="btnIcon actionApprove"
                          title="อนุมัติคำขอ"
                          onClick={() => onApprove(item.id)}
                        >
                          <UserCheck size={16} />
                        </button>

                        <button
                          type="button"
                          className="btnIcon actionReject"
                          title="ปฏิเสธคำขอ"
                          onClick={() => onReject(item.id)}
                        >
                          <UserX size={16} />
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      className="btnIcon actionDelete"
                      title="ลบคำขอ"
                      onClick={() => onDelete(item.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List (Responsive for 390px screens) */}
      <div className="mobileCardList">
        {registrations.map((item) => (
          <div key={item.id} className="mobileCard">
            <div className="mobileCardHeader">
              <div>
                <h3 className="mobileCardTitle">
                  {item.title}
                  {item.firstNameTh} {item.lastNameTh}
                </h3>
                <p className="mobileCardDate">
                  {new Date(item.createdAt).toLocaleDateString('th-TH', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div>{getStatusBadge(item.status)}</div>
            </div>

            <div className="mobileCardBody">
              <div className="mobileRow">
                <span className="mobileLabel">เลขบัตร:</span>
                <span className="mobileValue tabularNums">{item.citizenId}</span>
              </div>
              <div className="mobileRow">
                <span className="mobileLabel">กลุ่มงาน:</span>
                <span className="mobileValue">{item.department}</span>
              </div>
              <div className="mobileRow">
                <span className="mobileLabel">ตำแหน่ง:</span>
                <span className="mobileValue">{item.position}</span>
              </div>
              <div className="mobileRow">
                <span className="mobileLabel">อีเมล:</span>
                <span className="mobileValue">{item.email}</span>
              </div>
            </div>

            <div className="mobileCardActions">
              <button
                type="button"
                className="btnSecondary flex-1 text-xs py-2 h-9"
                onClick={() => onView(item)}
              >
                <Eye size={14} />
                <span>รายละเอียด</span>
              </button>

              <button
                type="button"
                className="btnSecondary text-xs py-2 px-3 h-9"
                onClick={() => onEdit(item)}
              >
                <Edit3 size={14} />
              </button>

              {item.status === 'pending' && (
                <button
                  type="button"
                  className="btnPrimary text-xs py-2 px-3 h-9"
                  onClick={() => onApprove(item.id)}
                >
                  <UserCheck size={14} />
                  <span>อนุมัติ</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
