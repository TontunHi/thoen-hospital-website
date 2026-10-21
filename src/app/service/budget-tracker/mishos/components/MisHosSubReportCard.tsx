'use client'

import React, { useState, useMemo } from 'react'
import {
  Download,
  Search,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react'
import { MisHosSubReport, MisHosChartConfig } from '@/lib/budget/misHosService'
import MisHosChart from './MisHosChart'
import { exportMisHosRecordsToExcel } from '../utils/exportExcel'

interface MisHosSubReportCardProps {
  subReport: MisHosSubReport
  records: Record<string, any>[]
  chartConfig?: MisHosChartConfig | null
  loading?: boolean
  error?: string
  selectedYear: string
  hcode: string
  hname: string
}

export default function MisHosSubReportCard({
  subReport,
  records,
  chartConfig,
  loading = false,
  error,
  selectedYear,
  hcode,
  hname,
}: MisHosSubReportCardProps) {
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const pageSize = 15

  const chartType = subReport.chart_type || chartConfig?.chartType || 'table'
  const isTable = chartType === 'table'

  // Determine width class matching CoreUI/Bootstrap grid in Module 381
  const widthClass = useMemo(() => {
    const w = String(subReport.report_width).trim()
    if (w === '4') return 'bt-mishos-col-4'
    if (w === '5') return 'bt-mishos-col-5'
    if (w === '6') return 'bt-mishos-col-6'
    if (w === '7') return 'bt-mishos-col-7'
    if (w === '8') return 'bt-mishos-col-8'
    return 'bt-mishos-col-12'
  }, [subReport.report_width])

  // Derive columns & definitions
  const rawColumns = useMemo(() => {
    if (!records || records.length === 0) return []
    const keys = new Set<string>()
    records.forEach(r => Object.keys(r).forEach(k => keys.add(k)))
    return Array.from(keys)
  }, [records])

  // Header configs from chartConfig.table_header if present
  const headerDefs = useMemo(() => {
    const configHeaders = chartConfig?.table_header || []
    return rawColumns.map((colKey, idx) => {
      const defStr = configHeaders[idx]
      if (defStr) {
        const parts = defStr.split(',')
        const title = parts[0]
        const decimals = parts[1] !== undefined ? parseInt(parts[1], 10) : undefined
        return {
          key: colKey,
          title,
          isNumeric: !isNaN(decimals as number),
          decimals: !isNaN(decimals as number) ? (decimals as number) : 0,
        }
      }
      // Heuristic detection if no explicit header config
      const upper = colKey.toUpperCase()
      const isCodeOrDate =
        upper.includes('YEAR') ||
        upper.includes('CODE') ||
        upper.includes('CD') ||
        upper.includes('ID') ||
        upper.includes('DATE') ||
        upper.includes('MONTH')

      const sampleVal = records.find(
        r => r[colKey] !== null && r[colKey] !== undefined && r[colKey] !== ''
      )?.[colKey]
      const strVal = String(sampleVal ?? '')
      const numVal = Number(sampleVal)
      const isNum =
        !isCodeOrDate &&
        sampleVal !== null &&
        sampleVal !== undefined &&
        strVal.trim() !== '' &&
        !isNaN(numVal) &&
        (typeof sampleVal === 'number' || (!strVal.startsWith('0') || strVal === '0')) &&
        strVal.length < 15

      const hasDecimals = records.some(r => {
        const v = r[colKey]
        return v !== null && v !== undefined && String(v).includes('.')
      })

      return {
        key: colKey,
        title: colKey,
        isNumeric: isNum,
        decimals: hasDecimals ? 2 : 0,
      }
    })
  }, [rawColumns, chartConfig?.table_header, records])

  // Filter records by search text
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records
    const term = searchTerm.toLowerCase().trim()
    return records.filter(r =>
      Object.values(r).some(val => String(val).toLowerCase().includes(term))
    )
  }, [records, searchTerm])

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRecords.slice(start, start + pageSize)
  }, [filteredRecords, currentPage, pageSize])

  // Summary Row totals (tfoot) matching Module 381
  const columnSums = useMemo(() => {
    const sums: Record<string, number> = {}
    headerDefs.forEach(col => {
      if (col.isNumeric) {
        sums[col.key] = records.reduce((acc, row) => {
          const val = parseFloat(row[col.key])
          return acc + (isNaN(val) ? 0 : val)
        }, 0)
      }
    })
    return sums
  }, [headerDefs, records])

  // Export Excel handler
  const handleExport = async () => {
    const columnKeys = headerDefs.map(d => d.key)
    const columnTitles = headerDefs.map(d => d.title)
    await exportMisHosRecordsToExcel(
      filteredRecords,
      columnKeys,
      subReport.report_name,
      selectedYear,
      hcode,
      hname,
      columnTitles
    )
  }

  return (
    <div className={`bt-mishos-subcard-wrap ${widthClass}`}>
      <div className="bt-mishos-subcard">
        {/* Card Header */}
        <div className="bt-mishos-subcard-header">
          <div className="bt-mishos-subcard-title-group">
            <h3 className="bt-mishos-subcard-title">
              {subReport.report_name}
            </h3>
            {chartConfig?.yaxis && !isTable && (
              <span className="bt-mishos-subcard-unit">หน่วย: {chartConfig.yaxis}</span>
            )}
          </div>

          <div className="bt-mishos-subcard-actions">
            {isTable && (
              <>
                {records.length > 0 && (
                  <div className="bt-mishos-card-search-box">
                    <Search size={12} className="bt-mishos-card-search-icon" />
                    <input
                      type="text"
                      placeholder="ค้นหา..."
                      value={searchTerm}
                      onChange={e => {
                        setSearchTerm(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="bt-mishos-card-search-input"
                      aria-label={`ค้นหาข้อมูลในตาราง ${subReport.report_name}`}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={records.length === 0}
                  className="bt-mishos-card-excel-btn"
                  title="ส่งออกตารางเป็น Excel (.xlsx)"
                  aria-label="ส่งออก Excel"
                >
                  <Download size={13} />
                  <span>Excel</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Card Body */}
        <div className="bt-mishos-subcard-body">
          {loading ? (
            <div className="bt-mishos-card-loading">
              <Loader2 size={24} className="bt-spin" style={{ color: '#0284c7' }} />
              <span>กำลังดึงข้อมูลรายงาน...</span>
            </div>
          ) : error ? (
            <div className="bt-mishos-card-error">
              <AlertCircle size={18} style={{ color: '#dc2626' }} />
              <span>{error}</span>
            </div>
          ) : records.length === 0 ? (
            <div className="bt-mishos-card-empty">
              <span>ยังไม่มีข้อมูลสำหรับปีงบประมาณ พ.ศ. {selectedYear}</span>
            </div>
          ) : isTable ? (
            <div className="bt-mishos-table-container">
              <div className="bt-mishos-table-scroll">
                <table className="bt-mishos-table">
                  <thead>
                    <tr>
                      <th style={{ width: '48px', textAlign: 'center' }}>ลำดับ</th>
                      {headerDefs.map(col => (
                        <th
                          key={col.key}
                          className={col.isNumeric ? 'bt-mishos-th-right' : 'bt-mishos-th-left'}
                        >
                          {col.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRecords.map((row, rIdx) => {
                      const rowNum = (currentPage - 1) * pageSize + rIdx + 1
                      return (
                        <tr key={rIdx}>
                          <td className="bt-mishos-col-seq">{rowNum}</td>
                          {headerDefs.map(col => {
                            const rawVal = row[col.key]
                            if (col.isNumeric) {
                              const num = parseFloat(rawVal)
                              const formatted = isNaN(num)
                                ? rawVal ?? '-'
                                : num.toLocaleString('th-TH', {
                                    minimumFractionDigits: col.decimals,
                                    maximumFractionDigits: col.decimals,
                                  })
                              return (
                                <td key={col.key} className="bt-mishos-col-num">
                                  {formatted}
                                </td>
                              )
                            }
                            return (
                              <td key={col.key} className="bt-mishos-col-text">
                                {rawVal ?? '-'}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                  {/* Summary Footer matching Module 381 */}
                  {records.length > 0 && (
                    <tfoot className="bt-mishos-tfoot">
                      <tr>
                        <th className="bt-mishos-tfoot-total-label">รวม</th>
                        {headerDefs.map((col, cIdx) => {
                          if (cIdx === 0 && !col.isNumeric) {
                            return (
                              <th key={col.key} className="bt-mishos-tfoot-item-count">
                                {filteredRecords.length.toLocaleString('th-TH')} รายการ
                              </th>
                            )
                          }
                          if (col.isNumeric) {
                            const sumVal = columnSums[col.key] || 0
                            return (
                              <th key={col.key} className="bt-mishos-tfoot-sum-val">
                                {sumVal.toLocaleString('th-TH', {
                                  minimumFractionDigits: col.decimals,
                                  maximumFractionDigits: col.decimals,
                                })}
                              </th>
                            )
                          }
                          return <th key={col.key} />
                        })}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* In-table Pagination */}
              {totalPages > 1 && (
                <div className="bt-mishos-subcard-pagination">
                  <span className="bt-mishos-subcard-page-info">
                    หน้า {currentPage} / {totalPages} (ทั้งหมด {filteredRecords.length} แถว)
                  </span>
                  <div className="bt-mishos-subcard-page-btns">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className="bt-mishos-subcard-btn-arrow"
                      aria-label="หน้าก่อนหน้า"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className="bt-mishos-subcard-btn-arrow"
                      aria-label="หน้าถัดไป"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bt-mishos-subcard-chart-wrap">
              <MisHosChart
                records={records}
                reportTitle={subReport.report_name}
                chartType={chartType}
                chartConfig={chartConfig}
                height={260}
                hideHeader={true}
              />
            </div>
          )}
        </div>

        {/* Card Footer matching Module 381 */}
        <div className="bt-mishos-subcard-footer">
          <span className="bt-mishos-subcard-id">ID: {subReport.ssid}</span>
          <span className="bt-mishos-subcard-meta">
            {records.length > 0 ? `${records.length} แถวข้อมูล` : 'ไม่มีข้อมูล'}
          </span>
        </div>
      </div>
    </div>
  )
}
