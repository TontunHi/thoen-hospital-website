'use client'

import React from 'react'
import {
  Search,
  X,
  RefreshCw,
  HeartPulse,
  Pill,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ReceiptText,
  Activity,
} from 'lucide-react'
import type { StreptokinaseItem } from '@/lib/clinical/rcmStreptokinaseService'
import { formatThaiDate } from '@/lib/formatters'
import { RcmSeamlessModalSection } from '@/components/rcm/RcmSeamlessRepDisplay'
import { formatStkMoney } from './StreptokinaseKpiGrid'

export interface ModalOrderItem {
  id: string
  icode: string
  name: string
  strength: string | null
  units: string | null
  qty: number
  unitprice: number
  sumPrice: number
  paidstName: string
  incomeName: string
  isDrug: boolean
  isTargetDrug: boolean
}

export interface StreptokinaseDetailModalProps {
  selectedItem: StreptokinaseItem | null
  modalTab: 'overview' | 'orders'
  loadingModalDetails: boolean
  orderFilter: 'all' | 'drug' | 'service'
  orderSearch: string
  normalizedOrders: ModalOrderItem[]
  filteredOrders: ModalOrderItem[]
  orderMetrics: {
    totalCount: number
    drugCount: number
    serviceCount: number
    totalDrugCost: number
    totalServiceCost: number
    grandTotal: number
    targetDrug: ModalOrderItem | null
  }
  onClose: () => void
  onTabChange: (tab: 'overview' | 'orders') => void
  onOrderFilterChange: (filter: 'all' | 'drug' | 'service') => void
  onOrderSearchChange: (val: string) => void
  onClearOrderFilters: () => void
}

export function StreptokinaseDetailModal({
  selectedItem,
  modalTab,
  loadingModalDetails,
  orderFilter,
  orderSearch,
  normalizedOrders,
  filteredOrders,
  orderMetrics,
  onClose,
  onTabChange,
  onOrderFilterChange,
  onOrderSearchChange,
  onClearOrderFilters,
}: StreptokinaseDetailModalProps) {
  if (!selectedItem) return null

  return (
    <div
      className="stk-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="stk-modal">
        <div className="stk-modal-header">
          <div>
            <h3 className="stk-modal-title">
              {selectedItem.ptname} ({selectedItem.hn})
            </h3>
            <p className="stk-modal-sub">
              <span>เลขบัตรประชาชน: {selectedItem.cid || '—'}</span>
              <span>•</span>
              <span>เพศ {selectedItem.sex}</span>
              <span>•</span>
              <span>อายุ {selectedItem.age} ปี</span>
              <span>•</span>
              <span className="stk-badge stk-badge-neutral">
                {selectedItem.patientType === 'OPD'
                  ? `OPD VN: ${selectedItem.vn}`
                  : `IPD AN: ${selectedItem.an}`}
              </span>
            </p>
          </div>

          <button
            type="button"
            className="stk-modal-close"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
          >
            <X size={20} />
          </button>
        </div>

        <div className="stk-modal-tabs">
          <button
            type="button"
            className={`stk-modal-tab ${modalTab === 'overview' ? 'is-active' : ''}`}
            onClick={() => onTabChange('overview')}
          >
            สรุปเวชระเบียนและการตรวจสอบ (Overview & Audit)
          </button>
          <button
            type="button"
            className={`stk-modal-tab ${modalTab === 'orders' ? 'is-active' : ''}`}
            onClick={() => onTabChange('orders')}
          >
            รายการยาและค่าบริการรักษา (Orders)
          </button>
        </div>

        <div className="stk-modal-body">
          {modalTab === 'overview' && (
            <>
              <div className="stk-modal-section">
                <h4 className="stk-section-title">
                  <ShieldCheck size={16} className="text-emerald-700" />
                  <span>ผลการตรวจสอบเงื่อนไขการเบิกชดเชย (Audit Verification)</span>
                </h4>

                <div className={`stk-audit-box ${selectedItem.errorDx ? 'is-fail' : 'is-pass'}`}>
                  {selectedItem.errorDx ? (
                    <AlertTriangle size={20} className="stk-audit-icon text-rose-600" />
                  ) : (
                    <CheckCircle2 size={20} className="stk-audit-icon text-emerald-600" />
                  )}
                  <div className="stk-audit-content">
                    <div className="stk-audit-title">
                      {selectedItem.errorDx
                        ? 'ตรวจพบข้อผิดพลาด: ไม่พบรหัสโรค STEMI (I210-I213 หรือ I22x)'
                        : 'ผ่านการตรวจสอบ: พบรหัสโรค STEMI (I210-I213 หรือ I22x)'}
                    </div>
                    <div>
                      รหัสโรคที่บันทึกในระบบ: <code>{selectedItem.dx || 'ไม่มี'}</code>
                    </div>
                  </div>
                </div>

                <div className={`stk-audit-box ${selectedItem.errorOp ? 'is-fail' : 'is-pass'}`}>
                  {selectedItem.errorOp ? (
                    <AlertTriangle size={20} className="stk-audit-icon text-rose-600" />
                  ) : (
                    <CheckCircle2 size={20} className="stk-audit-icon text-emerald-600" />
                  )}
                  <div className="stk-audit-content">
                    <div className="stk-audit-title">
                      {selectedItem.errorOp
                        ? 'ตรวจพบข้อผิดพลาด: ไม่พบหัตถการ Op 9910'
                        : 'ผ่านการตรวจสอบ: มีการบันทึกหัตถการ Op 9910 (Thrombolytic injection)'}
                    </div>
                    <div>
                      รหัสหัตถการที่บันทึกในระบบ: <code>{selectedItem.op || 'ไม่มี'}</code>
                    </div>
                  </div>
                </div>
              </div>

              <div className="stk-modal-section">
                <h4 className="stk-section-title">
                  <ReceiptText size={16} />
                  <span>ข้อมูลค่ารักษาพยาบาลและการชดเชย</span>
                </h4>

                <div className="stk-detail-grid">
                  <div className="stk-detail-card">
                    <div className="stk-detail-label">ค่ายา Streptokinase (HOSxP)</div>
                    <div className="stk-detail-value">
                      {formatStkMoney(selectedItem.money_hosxp)} บาท
                    </div>
                  </div>
                  <div className="stk-detail-card">
                    <div className="stk-detail-label">ยอดชดเชยสุทธิ (Compensated)</div>
                    <div className="stk-detail-value text-emerald-700">
                      {formatStkMoney(selectedItem.compensated)} บาท
                    </div>
                  </div>
                  <div className="stk-detail-card">
                    <div className="stk-detail-label">เงิน E-Claim</div>
                    <div className="stk-detail-value">
                      {formatStkMoney(selectedItem.money_eclaim)} บาท
                    </div>
                  </div>
                  <div className="stk-detail-card">
                    <div className="stk-detail-label">เงิน Rep / Invoice</div>
                    <div className="stk-detail-value">
                      {formatStkMoney(selectedItem.money_invoice || selectedItem.money_rep)} บาท
                    </div>
                  </div>
                  <div className="stk-detail-card">
                    <div className="stk-detail-label">ลูกหนี้ค้างชำระ (Debit)</div>
                    <div className="stk-detail-value">
                      {formatStkMoney(selectedItem.debit)} บาท
                    </div>
                  </div>
                  <div className="stk-detail-card">
                    <div className="stk-detail-label">สถานะ E-Claim / เลขที่ Rep</div>
                    <div className="stk-detail-value">
                      {selectedItem.status}{' '}
                      {selectedItem.rep ? `(Rep: ${selectedItem.rep})` : ''}
                    </div>
                  </div>
                </div>
              </div>

              <div className="stk-modal-section">
                <h4 className="stk-section-title">
                  <Pill size={16} />
                  <span>ข้อมูลการใช้ยาและแผนก</span>
                </h4>

                <div className="stk-detail-grid">
                  <div className="stk-detail-card">
                    <div className="stk-detail-label">ยา Streptokinase ที่ได้รับ</div>
                    <div className="stk-detail-value">{selectedItem.drugname}</div>
                  </div>
                  <div className="stk-detail-card">
                    <div className="stk-detail-label">
                      {selectedItem.patientType === 'OPD' ? 'แผนก/ห้องตรวจ' : 'ตึกผู้ป่วย'}
                    </div>
                    <div className="stk-detail-value">
                      {selectedItem.patientType === 'OPD'
                        ? selectedItem.department || selectedItem.clinic || '—'
                        : selectedItem.ward || '—'}
                    </div>
                  </div>
                  <div className="stk-detail-card">
                    <div className="stk-detail-label">
                      {selectedItem.patientType === 'OPD' ? 'วันที่รับบริการ' : 'วันรับไว้รักษา'}
                    </div>
                    <div className="stk-detail-value">
                      {formatThaiDate(selectedItem.vstdate || selectedItem.admdate)}{' '}
                      {selectedItem.vsttime || ''}
                    </div>
                  </div>
                  <div className="stk-detail-card">
                    <div className="stk-detail-label">สิทธิการรักษา</div>
                    <div className="stk-detail-value">{selectedItem.pttypename}</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {modalTab === 'orders' && (
            <div className="stk-orders-container">
              {loadingModalDetails ? (
                <div className="stk-empty-state">
                  <RefreshCw size={24} className="stk-empty-icon stk-spin text-emerald-600" />
                  <div className="stk-empty-title">กำลังดึงรายการคำสั่งการรักษา...</div>
                </div>
              ) : (
                <>
                  <div className="stk-order-target-card">
                    <div className="stk-order-target-header">
                      <div className="stk-order-target-badge">
                        <HeartPulse size={15} />
                        <span>ยาเป้าหมายตามโครงการ (STEMI Thrombolytic Therapy)</span>
                      </div>
                      <div className="stk-order-target-status">
                        สิทธิการชำระ:{' '}
                        <span className="font-semibold text-emerald-900">
                          {orderMetrics.targetDrug?.paidstName || selectedItem.pttypename}
                        </span>
                      </div>
                    </div>
                    <div className="stk-order-target-body">
                      <div className="stk-order-target-main">
                        <div className="stk-order-target-name">
                          {orderMetrics.targetDrug?.name || selectedItem.drugname}
                          {orderMetrics.targetDrug?.strength && (
                            <span className="stk-order-target-strength">
                              ({orderMetrics.targetDrug.strength})
                            </span>
                          )}
                        </div>
                        <div className="stk-order-target-sub">
                          รหัสยา:{' '}
                          <span className="stk-num">{orderMetrics.targetDrug?.icode || '—'}</span>{' '}
                          &bull; หมวดรายได้:{' '}
                          <span>{orderMetrics.targetDrug?.incomeName || 'ค่ายาและสารอาหาร'}</span>
                        </div>
                      </div>
                      <div className="stk-order-target-stats">
                        <div className="stk-order-stat-pill">
                          <span className="stk-order-stat-pill-label">จำนวนสั่งใช้</span>
                          <span className="stk-order-stat-pill-val stk-num">
                            {orderMetrics.targetDrug
                              ? `${orderMetrics.targetDrug.qty} ${orderMetrics.targetDrug.units || 'หน่วย'}`
                              : '1 ครั้ง'}
                          </span>
                        </div>
                        <div className="stk-order-stat-pill">
                          <span className="stk-order-stat-pill-label">ราคา/หน่วย</span>
                          <span className="stk-order-stat-pill-val stk-num">
                            {formatStkMoney(orderMetrics.targetDrug?.unitprice ?? selectedItem.money_hosxp)} ฿
                          </span>
                        </div>
                        <div className="stk-order-stat-pill stk-order-stat-pill-highlight">
                          <span className="stk-order-stat-pill-label">รวมค่ายาเป้าหมาย</span>
                          <span className="stk-order-stat-pill-val stk-num text-emerald-800 font-bold">
                            {formatStkMoney(orderMetrics.targetDrug?.sumPrice ?? selectedItem.money_hosxp)} ฿
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="stk-order-summary-grid">
                    <div className="stk-order-summary-card">
                      <div className="stk-order-summary-title">คำสั่งการรักษาทั้งหมด</div>
                      <div className="stk-order-summary-num stk-num">
                        {orderMetrics.totalCount} <span className="stk-order-summary-unit">รายการ</span>
                      </div>
                      <div className="stk-order-summary-sub stk-num">
                        รวม {formatStkMoney(orderMetrics.grandTotal, true)} ฿
                      </div>
                    </div>
                    <div className="stk-order-summary-card">
                      <div className="stk-order-summary-title">รายการยาและเวชภัณฑ์</div>
                      <div className="stk-order-summary-num stk-num text-emerald-700">
                        {orderMetrics.drugCount} <span className="stk-order-summary-unit">รายการ</span>
                      </div>
                      <div className="stk-order-summary-sub stk-num">
                        รวม {formatStkMoney(orderMetrics.totalDrugCost, true)} ฿
                      </div>
                    </div>
                    <div className="stk-order-summary-card">
                      <div className="stk-order-summary-title">ค่าบริการและหัตถการ</div>
                      <div className="stk-order-summary-num stk-num text-blue-700">
                        {orderMetrics.serviceCount} <span className="stk-order-summary-unit">รายการ</span>
                      </div>
                      <div className="stk-order-summary-sub stk-num">
                        รวม {formatStkMoney(orderMetrics.totalServiceCost, true)} ฿
                      </div>
                    </div>
                    <div className="stk-order-summary-card stk-order-summary-card-total">
                      <div className="stk-order-summary-title text-emerald-800">
                        ยอดรวมค่ารักษา (HOSxP)
                      </div>
                      <div className="stk-order-summary-num stk-num text-emerald-800">
                        {formatStkMoney(orderMetrics.grandTotal || selectedItem.money_hosxp, true)}{' '}
                        <span className="stk-order-summary-unit">บาท</span>
                      </div>
                      <div className="stk-order-summary-sub text-slate-500">
                        บันทึกเรียกเก็บ:{' '}
                        {formatStkMoney(
                          selectedItem.money_eclaim || selectedItem.money_rep || selectedItem.money_hosxp,
                          true
                        )}{' '}
                        ฿
                      </div>
                    </div>
                  </div>

                  <div className="stk-order-toolbar">
                    <div className="stk-order-chips" role="group" aria-label="กรองประเภทคำสั่งการรักษา">
                      <button
                        type="button"
                        className={`stk-order-chip ${orderFilter === 'all' ? 'is-active' : ''}`}
                        onClick={() => onOrderFilterChange('all')}
                      >
                        <span>ทั้งหมด</span>
                        <span className="stk-order-chip-count stk-num">{orderMetrics.totalCount}</span>
                      </button>
                      <button
                        type="button"
                        className={`stk-order-chip ${orderFilter === 'drug' ? 'is-active' : ''}`}
                        onClick={() => onOrderFilterChange('drug')}
                      >
                        <Pill size={13} />
                        <span>รายการยา</span>
                        <span className="stk-order-chip-count stk-num">{orderMetrics.drugCount}</span>
                      </button>
                      <button
                        type="button"
                        className={`stk-order-chip ${orderFilter === 'service' ? 'is-active' : ''}`}
                        onClick={() => onOrderFilterChange('service')}
                      >
                        <Activity size={13} />
                        <span>ค่าบริการ/หัตถการ</span>
                        <span className="stk-order-chip-count stk-num">{orderMetrics.serviceCount}</span>
                      </button>
                    </div>

                    <div className="stk-order-search-box">
                      <Search size={14} className="stk-order-search-icon" />
                      <input
                        type="text"
                        className="stk-order-search-input"
                        placeholder="ค้นหาชื่อยา, รหัส, หมวดรายได้..."
                        value={orderSearch}
                        onChange={(e) => onOrderSearchChange(e.target.value)}
                      />
                      {orderSearch && (
                        <button
                          type="button"
                          className="stk-order-search-clear"
                          onClick={() => onOrderSearchChange('')}
                          aria-label="ล้างคำค้นหา"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="stk-order-table-container">
                    <div className="stk-order-table-scroll">
                      <table className="stk-order-table">
                        <thead>
                          <tr>
                            <th className="col-center" style={{ width: '44px' }}>#</th>
                            <th className="col-center" style={{ width: '80px' }}>ประเภท</th>
                            <th className="col-left" style={{ width: '90px' }}>รหัส</th>
                            <th className="col-left">รายการยาและค่าบริการรักษา</th>
                            <th className="col-left" style={{ width: '150px' }}>หมวดรายได้</th>
                            <th className="col-center" style={{ width: '90px' }}>จำนวน</th>
                            <th className="col-right" style={{ width: '100px' }}>ราคา/หน่วย</th>
                            <th className="col-right" style={{ width: '110px' }}>รวมเงิน (บาท)</th>
                            <th className="col-center" style={{ width: '100px' }}>สิทธิชำระ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOrders.length > 0 ? (
                            filteredOrders.map((ord, idx) => (
                              <tr
                                key={ord.id}
                                className={ord.isTargetDrug ? 'stk-order-row-target' : ''}
                              >
                                <td className="col-center stk-num text-slate-500">{idx + 1}</td>
                                <td className="col-center">
                                  {ord.isDrug ? (
                                    <span className="stk-order-badge stk-order-badge-drug">ยา</span>
                                  ) : (
                                    <span className="stk-order-badge stk-order-badge-service">บริการ</span>
                                  )}
                                </td>
                                <td className="col-left stk-num stk-order-code">{ord.icode || '—'}</td>
                                <td className="col-left stk-order-item-col">
                                  <div className="stk-order-item-name">
                                    <span>{ord.name}</span>
                                    {ord.strength && (
                                      <span className="stk-order-strength">({ord.strength})</span>
                                    )}
                                    {ord.isTargetDrug && (
                                      <span className="stk-target-pill">ยาเป้าหมาย STEMI</span>
                                    )}
                                  </div>
                                </td>
                                <td className="col-left stk-order-income text-slate-500">
                                  {ord.incomeName}
                                </td>
                                <td className="col-center stk-num">
                                  <span className="font-semibold text-slate-800">{ord.qty}</span>{' '}
                                  <span className="text-slate-500 text-xs">{ord.units || ''}</span>
                                </td>
                                <td className="col-right stk-num text-slate-600">
                                  {formatStkMoney(ord.unitprice)}
                                </td>
                                <td className="col-right stk-num font-semibold text-slate-900">
                                  {formatStkMoney(ord.sumPrice)}
                                </td>
                                <td className="col-center">
                                  <span className="stk-order-paidst">{ord.paidstName}</span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={9} className="p-8 text-center text-slate-500">
                                <div className="stk-empty-search-order">
                                  {normalizedOrders.length === 0 ? (
                                    <>
                                      <Pill size={28} className="text-slate-300 mx-auto mb-2" />
                                      <p className="font-medium text-slate-700">
                                        ไม่พบรายละเอียดรายการคำสั่งการรักษาแบบแยกบรรทัดในระบบ HOSxP
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        แต่มีบันทึกค่ายาเป้าหมายรวม: {selectedItem.drugname} จำนวนเงิน{' '}
                                        {formatStkMoney(selectedItem.money_hosxp)} บาท
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="font-medium text-slate-700">
                                        ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหาหรือตัวกรอง
                                      </p>
                                      <button
                                        type="button"
                                        className="stk-btn stk-btn-secondary mt-2 text-xs"
                                        onClick={onClearOrderFilters}
                                      >
                                        ล้างตัวกรองและคำค้นหา
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                        {filteredOrders.length > 0 && (
                          <tfoot>
                            <tr>
                              <td colSpan={5} className="stk-order-tfoot-label">
                                รวมผลการแสดงผล: {filteredOrders.length} รายการ (จากทั้งหมด{' '}
                                {orderMetrics.totalCount} รายการ)
                              </td>
                              <td className="col-center stk-num font-semibold">
                                {filteredOrders.reduce((acc, curr) => acc + curr.qty, 0)}
                              </td>
                              <td className="col-right text-slate-500 text-xs">รวมเงิน</td>
                              <td className="col-right stk-num font-bold text-emerald-800 text-sm">
                                {formatStkMoney(
                                  filteredOrders.reduce((acc, curr) => acc + curr.sumPrice, 0),
                                  true
                                )}
                              </td>
                              <td />
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <RcmSeamlessModalSection item={selectedItem} />
        </div>

        <div className="stk-modal-footer">
          <button
            type="button"
            className="stk-btn stk-btn-secondary"
            onClick={onClose}
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  )
}
