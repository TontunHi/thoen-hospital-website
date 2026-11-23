'use client'

import React from 'react'
import type { TelemedSummary } from '@/lib/clinical/rcmTelemedDrugService'
import { ActiveCardsState, CompensationCard, ClaimCard, formatMoney } from './telemedHelpers'

export interface TelemedKpiCardsProps {
  summary: TelemedSummary
  activeCards: ActiveCardsState
  toggleCompensationCard: (card?: CompensationCard) => void
  toggleClaimCard: (card: ClaimCard) => void
  toggleFeeCard: () => void
  toggleUcCard: () => void
  toggleType5Card: () => void
}

export function TelemedKpiCards({
  summary,
  activeCards,
  toggleCompensationCard,
  toggleClaimCard,
  toggleFeeCard,
  toggleUcCard,
  toggleType5Card,
}: TelemedKpiCardsProps) {
  return (
    <>
      <div className="telemed-kpi-main-grid">
        <button
          type="button"
          className={`telemed-kpi-card ${!activeCards.compensation ? 'active' : ''}`}
          onClick={() => toggleCompensationCard(undefined)}
          aria-pressed={!activeCards.compensation}
          title="คลิกเพื่อล้างตัวกรองสถานะชดเชย"
        >
          <span className="telemed-kpi-label">ผู้รับบริการทั้งหมด</span>
          <div className="telemed-kpi-main-val">
            {summary.totalVisits.toLocaleString('th-TH')}
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subline">
            {summary.uniquePatients.toLocaleString('th-TH')} คน • รายได้ {formatMoney(summary.totalIncome)} บ.
          </div>
        </button>

        <button
          type="button"
          className={`telemed-kpi-card telemed-kpi-card-success ${
            activeCards.compensation === 'COMPENSATED' ? 'active' : ''
          }`}
          onClick={() => toggleCompensationCard('COMPENSATED')}
          aria-pressed={activeCards.compensation === 'COMPENSATED'}
          disabled={summary.compensatedVisits === 0}
          title={summary.compensatedVisits === 0 ? 'ไม่มีรายการ' : 'คลิกเพื่อกรองเฉพาะรายการที่ชดเชยแล้ว'}
        >
          <span className="telemed-kpi-label">ชดเชยแล้ว</span>
          <div className="telemed-kpi-main-val">
            {summary.compensatedVisits.toLocaleString('th-TH')}
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subline">
            {summary.compensationRate.toFixed(1)}% • ชดเชย {formatMoney(summary.totalCompensated)} บ.
          </div>
          <div className="telemed-prop-track">
            <div
              className="telemed-prop-fill telemed-prop-success"
              style={{ width: `${Math.min(100, Math.max(0, summary.compensationRate))}%` }}
            />
          </div>
        </button>

        <button
          type="button"
          className={`telemed-kpi-card telemed-kpi-card-warning ${
            activeCards.compensation === 'UNCOMPENSATED' ? 'active' : ''
          }`}
          onClick={() => toggleCompensationCard('UNCOMPENSATED')}
          aria-pressed={activeCards.compensation === 'UNCOMPENSATED'}
          disabled={summary.uncompensatedVisits === 0}
          title={summary.uncompensatedVisits === 0 ? 'ไม่มีรายการ' : 'คลิกเพื่อกรองเฉพาะรายการที่รอชดเชย / ยังไม่ส่ง'}
        >
          <span className="telemed-kpi-label">รอชดเชย / ยังไม่ส่ง</span>
          <div className="telemed-kpi-main-val">
            {summary.uncompensatedVisits.toLocaleString('th-TH')}
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subline">
            {summary.totalVisits > 0
              ? ((summary.uncompensatedVisits / summary.totalVisits) * 100).toFixed(1)
              : '0.0'}
            % ของทั้งหมด
          </div>
          <div className="telemed-prop-track">
            <div
              className="telemed-prop-fill telemed-prop-warning"
              style={{
                width: `${
                  summary.totalVisits > 0
                    ? Math.min(100, (summary.uncompensatedVisits / summary.totalVisits) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </button>
      </div>

      <div className="telemed-kpi-sub-grid">
        <button
          type="button"
          className={`telemed-kpi-card telemed-kpi-card-success ${
            activeCards.claim === 'WITH_AUTHEN' ? 'active' : ''
          }`}
          onClick={() => toggleClaimCard('WITH_AUTHEN')}
          aria-pressed={activeCards.claim === 'WITH_AUTHEN'}
          disabled={summary.withAuthenCount === 0}
          title={summary.withAuthenCount === 0 ? 'ไม่มีรายการ' : 'คลิกเพื่อกรองเฉพาะที่มี ClaimCode'}
        >
          <span className="telemed-kpi-label">มี ClaimCode</span>
          <div className="telemed-kpi-sub-val">
            {summary.withAuthenCount.toLocaleString('th-TH')}
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subline">{summary.authenRate.toFixed(1)}% ยืนยันตัวตนแล้ว</div>
          <div className="telemed-prop-track">
            <div
              className="telemed-prop-fill telemed-prop-success"
              style={{ width: `${Math.min(100, Math.max(0, summary.authenRate))}%` }}
            />
          </div>
        </button>

        <button
          type="button"
          className={`telemed-kpi-card telemed-kpi-card-danger ${
            activeCards.claim === 'NO_AUTHEN' ? 'active' : ''
          }`}
          onClick={() => toggleClaimCard('NO_AUTHEN')}
          aria-pressed={activeCards.claim === 'NO_AUTHEN'}
          disabled={summary.withoutAuthenCount === 0}
          title={summary.withoutAuthenCount === 0 ? 'ไม่มีรายการ' : 'คลิกเพื่อกรองเฉพาะที่ไม่มี ClaimCode'}
        >
          <span className="telemed-kpi-label">ไม่มี ClaimCode</span>
          <div className="telemed-kpi-sub-val">
            {summary.withoutAuthenCount.toLocaleString('th-TH')}
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subline">
            {summary.totalVisits > 0
              ? ((summary.withoutAuthenCount / summary.totalVisits) * 100).toFixed(1)
              : '0.0'}
            % เสี่ยงเบิกชดเชยไม่ได้
          </div>
          <div className="telemed-prop-track">
            <div
              className="telemed-prop-fill telemed-prop-danger"
              style={{
                width: `${
                  summary.totalVisits > 0
                    ? Math.min(100, (summary.withoutAuthenCount / summary.totalVisits) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </button>

        <button
          type="button"
          className={`telemed-kpi-card telemed-kpi-card-info ${activeCards.hasFee ? 'active' : ''}`}
          onClick={toggleFeeCard}
          aria-pressed={activeCards.hasFee}
          disabled={summary.withPriceCount === 0}
          title={summary.withPriceCount === 0 ? 'ไม่มีรายการ' : 'คลิกเพื่อกรองเฉพาะที่มีค่าบริการ TelMed'}
        >
          <span className="telemed-kpi-label">มีค่าบริการ TelMed</span>
          <div className="telemed-kpi-sub-val">
            {summary.withPriceCount.toLocaleString('th-TH')}
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subline">ค่า TelMed {formatMoney(summary.totalSumPrice)} บ.</div>
          <div className="telemed-prop-track">
            <div
              className="telemed-prop-fill telemed-prop-info"
              style={{ width: `${Math.min(100, Math.max(0, summary.withPriceRate))}%` }}
            />
          </div>
        </button>

        <button
          type="button"
          className={`telemed-kpi-card telemed-kpi-card-info ${activeCards.ucOnly ? 'active' : ''}`}
          onClick={toggleUcCard}
          aria-pressed={activeCards.ucOnly}
          disabled={summary.ucCount === 0}
          title={summary.ucCount === 0 ? 'ไม่มีรายการ' : 'คลิกเพื่อกรองเฉพาะสิทธิบัตรทอง (UC)'}
        >
          <span className="telemed-kpi-label">สิทธิบัตรทอง (UC)</span>
          <div className="telemed-kpi-sub-val">
            {summary.ucCount.toLocaleString('th-TH')}
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subline">{summary.ucRate.toFixed(1)}% ของทั้งหมด</div>
          <div className="telemed-prop-track">
            <div
              className="telemed-prop-fill telemed-prop-info"
              style={{ width: `${Math.min(100, Math.max(0, summary.ucRate))}%` }}
            />
          </div>
        </button>

        <button
          type="button"
          className={`telemed-kpi-card telemed-kpi-card-info ${
            activeCards.exportCode5 ? 'active' : ''
          }`}
          onClick={toggleType5Card}
          aria-pressed={activeCards.exportCode5}
          disabled={summary.exportCode5Count === 0}
          title={summary.exportCode5Count === 0 ? 'ไม่มีรายการ' : 'คลิกเพื่อกรองเฉพาะประเภทมารหัส 5'}
        >
          <span className="telemed-kpi-label">ประเภทมา รพ. ทางไกล (รหัส 5)</span>
          <div className="telemed-kpi-sub-val">
            {summary.exportCode5Count.toLocaleString('th-TH')}
            <span className="telemed-kpi-unit">ครั้ง</span>
          </div>
          <div className="telemed-kpi-subline">{summary.exportCode5Rate.toFixed(1)}% ของทั้งหมด</div>
          <div className="telemed-prop-track">
            <div
              className="telemed-prop-fill telemed-prop-info"
              style={{ width: `${Math.min(100, Math.max(0, summary.exportCode5Rate))}%` }}
            />
          </div>
        </button>
      </div>
    </>
  )
}
