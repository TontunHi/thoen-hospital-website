'use client'

import React from 'react'
import type { Rh1AggregateResult, Rh1Hospital } from '@/lib/budget/rh1BudgetService'
import { heatStyle, rankWithin } from './rh1Helpers'

export interface Rh1ComparisonViewsProps {
  view: 'rk' | 'grp' | 'mx'
  H: Rh1Hospital[]
  NH: number
  peerIndices: number[]
  focusIdx: number
  focusedHospital: Rh1Hospital
  isLM: boolean
  metric: 'pc' | 'amt'
  cdim: 'p' | 'l' | 'g'
  matrixLvl: 'm' | 's'
  amtVector: Float64Array
  pcVector: Float64Array
  ranksData: {
    A: { rk: Int16Array; n: number }
    P: { rk: Int16Array; n: number; med: number; min: number; max: number }
    R: { rk: Int16Array; n: number }
  }
  rankingRows: Array<{ i: number; amt: number; pc: number; ra: number; rp: number; rr: number }>
  groupCompareRows: Array<{ key: string; label: string; count: number; pop: number; amt: number; pc: number }>
  sourceAggregate: Rh1AggregateResult
  formatMoney: (val?: number) => string
}

export function Rh1ComparisonViews({
  view,
  H,
  NH,
  peerIndices,
  focusIdx,
  focusedHospital,
  isLM,
  metric,
  cdim,
  matrixLvl,
  amtVector,
  pcVector,
  ranksData,
  rankingRows,
  groupCompareRows,
  sourceAggregate,
  formatMoney,
}: Rh1ComparisonViewsProps) {
  if (view === 'rk') {
    return (
      <div className="bt-panel">
        <div className="bt-panel-header">
          <div>
            <h3 className="bt-panel-title">อันดับโรงพยาบาลในกลุ่ม ({peerIndices.length} แห่ง)</h3>
            <p className="bt-panel-desc">
              เรียงลำดับตาม{isLM ? 'ยอดชดเชยรายครั้ง OP' : metric === 'pc' ? 'ยอดต่อหัว UC' : 'ยอดเงินชดเชยรวม'} · จุดสีส้มคือ รพ.เถิน · ขีดสีดำคือค่ามัธยฐานกลุ่ม
            </p>
          </div>
          <div className="legend">
            <span><i className="sw d" /> รพ.อื่น</span>
            <span><i className="sw s" /> รพ.เถิน (โฟกัส)</span>
            <span><i className="sw m" /> ค่ามัธยฐาน</span>
            <span>เฉดสี: น้อย <span className="grad" /> มาก</span>
          </div>
        </div>

        <div className="bt-table-wrapper bt-table-wrapper-max">
          <table className="bt-table bt-table-ranking">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>อันดับ</th>
                <th className="t">หน่วยบริการ / กลุ่มระดับบริการ</th>
                <th className="t" style={{ width: '60px' }}>จังหวัด</th>
                <th style={{ width: '45px', textAlign: 'center' }}>ขนาด</th>
                <th style={{ width: '45px', textAlign: 'right' }}>เตียง</th>
                <th style={{ width: '80px', textAlign: 'right' }}>ประชากร UC</th>
                <th style={{ minWidth: '115px', textAlign: 'right' }}>
                  {isLM ? 'ยอดชดเชย OP' : 'เงินที่ได้รับ'}
                  <div style={{ fontSize: '0.675rem', fontWeight: 400, color: '#64748b' }}>
                    ยอดเงิน (อันดับกลุ่ม)
                  </div>
                </th>
                <th style={{ minWidth: '120px', textAlign: 'right' }}>
                  {isLM ? 'ยอดชดเชย OP/ครั้ง' : 'ต่อหัว UC'}
                  <div style={{ fontSize: '0.675rem', fontWeight: 400, color: '#64748b' }}>
                    ยอดเฉลี่ย (อันดับกลุ่ม)
                  </div>
                </th>
                <th style={{ width: '70px', textAlign: 'center' }}>
                  อันดับเขต
                  <div style={{ fontSize: '0.675rem', fontWeight: 400, color: '#64748b' }}>ทั้งเขต 1</div>
                </th>
                <th style={{ width: '105px', textAlign: 'center' }}>
                  การกระจายในกลุ่ม
                  <div style={{ fontSize: '0.675rem', fontWeight: 400, color: '#64748b' }}>(Strip Plot)</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rankingRows.map((r, rowIdx) => {
                const h = H[r.i]
                const isFocus = r.i === focusIdx
                const hasVal = r.amt !== 0
                const min = ranksData.P.min || 0
                const max = ranksData.P.max || 1
                const med = ranksData.P.med || 0
                const range = max - min || 1
                const dotLeft = Math.min(95, Math.max(5, ((r.pc - min) / range) * 90 + 5))
                const medLeft = Math.min(95, Math.max(5, ((med - min) / range) * 90 + 5))
                const currentRank = metric === 'pc' ? r.rp : r.ra

                return (
                  <tr key={h.c} className={isFocus ? 'focus' : ''}>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: isFocus ? '#059669' : '#64748b' }}>
                      {currentRank ? `#${currentRank}` : rowIdx + 1}
                    </td>
                    <td className="t">
                      <div style={{ fontWeight: isFocus ? 700 : 600, color: isFocus ? '#065f46' : '#0f172a' }}>
                        {h.n}
                        {isFocus && (
                          <span
                            className="bt-focus-pill"
                            style={{ marginLeft: '0.35rem', fontSize: '0.625rem', padding: '0.05rem 0.35rem' }}
                          >
                            โฟกัส
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '1px' }}>
                        รหัส {h.c} · {h.g}
                      </div>
                    </td>
                    <td className="t">{h.p}</td>
                    <td style={{ textAlign: 'center' }}>{h.l}</td>
                    <td style={{ textAlign: 'right' }}>{h.b}</td>
                    <td style={{ textAlign: 'right' }}>{new Intl.NumberFormat().format(h.u)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600 }}>{hasVal ? formatMoney(r.amt) : '–'}</div>
                      {hasVal && (
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '1px' }}>
                          อันดับ <b>#{r.ra}</b><span style={{ color: '#94a3b8' }}>/{ranksData.A.n}</span>
                        </div>
                      )}
                    </td>
                    <td
                      data-hc="1"
                      style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        ...(hasVal ? heatStyle(r.rp, ranksData.P.n) : {}),
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{hasVal ? formatMoney(r.pc) : '–'}</div>
                      {hasVal && (
                        <div style={{ fontSize: '0.7rem', opacity: 0.9, marginTop: '1px' }}>
                          อันดับ <b>#{r.rp}</b><span style={{ opacity: 0.75 }}>/{ranksData.P.n}</span>
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="rk-val">#{r.rr || '–'}</span>
                      <span className="rk-total">/{ranksData.R.n}</span>
                    </td>
                    <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center' }}>
                      <div className="track">
                        <div
                          className={`dot ${isFocus ? 'sel' : ''}`}
                          style={{ left: `${dotLeft}%` }}
                          title={`${h.n}: ${formatMoney(r.pc)}`}
                        />
                        <div
                          className="med"
                          style={{ left: `${medLeft}%` }}
                          title={`มัธยฐานกลุ่ม: ${formatMoney(med)}`}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (view === 'grp') {
    return (
      <div className="bt-panel">
        <div className="bt-panel-header">
          <div>
            <h3 className="bt-panel-title">
              เปรียบเทียบผลงาน{cdim === 'l' ? 'ตามขนาด (A–F3)' : cdim === 'p' ? 'ตามจังหวัด' : 'ตามกลุ่มระดับบริการ (GroupName)'}
            </h3>
            <p className="bt-panel-desc">
              วิเคราะห์ผลรวมประชากร ยอดชดเชยรวม และยอดเฉลี่ยต่อหัว UC ของแต่ละกลุ่ม
            </p>
          </div>
        </div>

        <div className="bt-table-wrapper bt-table-wrapper-max">
          <table className="bt-table">
            <thead>
              <tr>
                <th className="t">กลุ่ม</th>
                <th style={{ textAlign: 'center' }}>จำนวน รพ.</th>
                <th>ประชากร UC รวม</th>
                <th>เงินที่ได้รับรวม (บาท)</th>
                <th>เฉลี่ยต่อหัว UC (บาท/คน)</th>
                <th style={{ minWidth: '180px' }}>สัดส่วนเปรียบเทียบ</th>
              </tr>
            </thead>
            <tbody>
              {groupCompareRows.map(g => {
                const maxVal = Math.max(...groupCompareRows.map(x => (metric === 'pc' ? x.pc : x.amt)))
                const pct = maxVal ? Math.round(((metric === 'pc' ? g.pc : g.amt) / maxVal) * 100) : 0
                return (
                  <tr key={g.key}>
                    <td className="t" style={{ fontWeight: 600 }}>{g.label}</td>
                    <td style={{ textAlign: 'center' }}>{g.count}</td>
                    <td>{new Intl.NumberFormat().format(g.pop)}</td>
                    <td style={{ fontWeight: 600 }}>{formatMoney(g.amt)}</td>
                    <td style={{ color: '#0369a1', fontWeight: 700 }}>{formatMoney(g.pc)}</td>
                    <td>
                      <div style={{ background: '#e2e8f0', borderRadius: '4px', height: '14px', width: '100%', overflow: 'hidden' }}>
                        <div
                          style={{
                            background: '#0284c7',
                            height: '100%',
                            width: `${pct}%`,
                            transition: 'width 0.2s ease',
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="bt-panel">
      <div className="bt-panel-header">
        <div>
          <h3 className="bt-panel-title">
            เมทริกซ์รายการกองทุน × โรงพยาบาลในกลุ่ม ({peerIndices.length} แห่ง)
          </h3>
          <p className="bt-panel-desc">
            ปักหมุด รพ.เถิน ไว้คอลัมน์ซ้ายสุด (กรอบส้ม) · แสดง{metric === 'pc' ? 'ยอดต่อหัว UC' : 'ยอดเงินชดเชย'} พร้อมไล่สี Heatmap
          </p>
        </div>
        <div className="legend">
          <span>
            เฉดสีระดับผลงาน: <span className="grad" />
          </span>
        </div>
      </div>

      <div className="bt-table-wrapper bt-table-wrapper-max">
        <table className="bt-table bt-mx">
          <thead>
            <tr>
              <th className="f">รายการกองทุน</th>
              <th className="fc" style={{ textAlign: 'right', minWidth: '135px' }}>
                {focusedHospital.n}
              </th>
              {peerIndices
                .filter(i => i !== focusIdx)
                .map(i => (
                  <th key={H[i].c} style={{ textAlign: 'right', minWidth: '125px' }}>
                    {H[i].n}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            <tr className="tot">
              <td className="f">
                <b>รวมทุกรายการ ({sourceAggregate.flat ? 'ยอดรวม' : 'ยอดรวมกองทุน'})</b>
              </td>
              <td
                className="fc"
                data-hc="1"
                style={{
                  textAlign: 'right',
                  fontWeight: 700,
                  ...(ranksData.P.rk[focusIdx] > 0 ? heatStyle(ranksData.P.rk[focusIdx], ranksData.P.n) : {}),
                }}
              >
                <div>
                  <b>{formatMoney(metric === 'pc' ? pcVector[focusIdx] : amtVector[focusIdx])}</b>
                  <i style={{ display: 'block', fontSize: '0.675rem', opacity: 0.85 }}>#{ranksData.P.rk[focusIdx]}</i>
                </div>
              </td>
              {peerIndices
                .filter(i => i !== focusIdx)
                .map(i => {
                  const val = metric === 'pc' ? pcVector[i] : amtVector[i]
                  const rk = ranksData.P.rk[i] || 0
                  return (
                    <td
                      key={H[i].c}
                      data-hc="1"
                      style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        ...(rk > 0 ? heatStyle(rk, ranksData.P.n) : {}),
                      }}
                    >
                      <div>
                        <b>{formatMoney(val)}</b>
                        <i style={{ display: 'block', fontSize: '0.675rem', opacity: 0.85 }}>#{rk}</i>
                      </div>
                    </td>
                  )
                })}
            </tr>

            {sourceAggregate.list
              .filter(f => (sourceAggregate.flat ? f.lvl === 'm' : f.lvl === matrixLvl))
              .map(item => {
                const itemPCs = new Float64Array(NH)
                for (let j = 0; j < NH; j++) {
                  itemPCs[j] = H[j].u ? item.arr[j] / H[j].u : 0
                }
                const itemRks = new Int16Array(NH)
                const itemN = rankWithin(itemPCs, peerIndices, itemRks)

                return (
                  <tr key={item.key}>
                    <td className="f">
                      <span>{item.name}</span>
                    </td>
                    <td
                      className="fc"
                      data-hc="1"
                      style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        ...(itemRks[focusIdx] > 0 ? heatStyle(itemRks[focusIdx], itemN) : {}),
                      }}
                    >
                      {item.arr[focusIdx] > 0 ? (
                        <div>
                          <b>{formatMoney(metric === 'pc' ? itemPCs[focusIdx] : item.arr[focusIdx])}</b>
                          <i style={{ display: 'block', fontSize: '0.675rem', opacity: 0.85 }}>#{itemRks[focusIdx]}</i>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>–</span>
                      )}
                    </td>
                    {peerIndices
                      .filter(i => i !== focusIdx)
                      .map(i => {
                        const val = metric === 'pc' ? itemPCs[i] : item.arr[i]
                        const rk = itemRks[i] || 0
                        return (
                          <td
                            key={H[i].c}
                            data-hc="1"
                            style={{
                              textAlign: 'right',
                              ...(val > 0 && rk > 0 ? heatStyle(rk, itemN) : {}),
                            }}
                          >
                            {val > 0 ? (
                              <div>
                                <b>{formatMoney(val)}</b>
                                <i style={{ display: 'block', fontSize: '0.675rem', opacity: 0.85 }}>#{rk}</i>
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>–</span>
                            )}
                          </td>
                        )
                      })}
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
