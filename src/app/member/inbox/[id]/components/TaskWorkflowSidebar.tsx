'use client'

import React from 'react'
import {
  FileText,
  Clock,
  ChevronUp,
  ChevronDown,
  User,
  Check,
  X,
  ShieldCheck,
  History,
} from 'lucide-react'
import type { TaskStep, TaskAudit } from './taskDetailConfig'

export function TaskWorkflowSidebar(props: {
  task: any
  steps: TaskStep[]
  auditLogs: TaskAudit[]
  isTimelineExpanded: boolean
  setIsTimelineExpanded: React.Dispatch<React.SetStateAction<boolean>>
  isAuditTrailExpanded: boolean
  setIsAuditTrailExpanded: React.Dispatch<React.SetStateAction<boolean>>
  formatThaiDate: (dateStr: string | null) => string
  getUrgencyBadge: (urgency: string, taskType?: string) => React.ReactNode
  getTypeBadge: (type: string) => React.ReactNode
}) {
  const {
    task,
    steps,
    auditLogs,
    isTimelineExpanded,
    setIsTimelineExpanded,
    isAuditTrailExpanded,
    setIsAuditTrailExpanded,
    formatThaiDate,
    getUrgencyBadge,
    getTypeBadge,
  } = props

  return (
    <>
        {/* Right Column: Request Info, Workflow Timeline & Audit Logs */}
        <div>
          {/* 1. ข้อมูลคำร้อง (Request Info Card - Top Right) */}
          <div className="contentCard">
            <div className="contentCardHeader">
              <h3 className="contentCardTitle">
                <FileText size={18} className="text-emerald-700" />
                <span>ข้อมูลคำร้อง</span>
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <span className="infoItemLabel">ผู้ยื่นคำขอ</span>
                <div className="infoItemValue">{task.requester_name}</div>
                <div className="infoItemSub">{task.requester_dept || '-'}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px dashed #f1f5f9' }}>
                <div>
                  <span className="infoItemLabel">วันที่ยื่นเรื่อง</span>
                  <div className="infoItemValue" style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.85rem' }}>
                    {formatThaiDate(task.created_at)}
                  </div>
                </div>
                <div>
                  <span className="infoItemLabel">ความเร่งด่วน</span>
                  <div>{getUrgencyBadge(task.urgency, task.task_type)}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px dashed #f1f5f9' }}>
                <div>
                  <span className="infoItemLabel">รหัสใบงาน</span>
                  <span className="taskNoBadge">{task.task_no}</span>
                </div>
                <div>
                  <span className="infoItemLabel">ประเภทงาน</span>
                  <div>{getTypeBadge(task.task_type)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. ขั้นตอนการอนุมัติ (Workflow Timeline - Collapsible / Minimized) */}
          {(() => {
            const totalSteps = steps.length
            const completedSteps = steps.filter((s) => s.status === 'COMPLETED').length
            const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
            const currentStep = steps.find((s) => s.step_no === task.current_step_no) || steps[0]
            const isAllApproved = task.status === 'APPROVED'
            const isTaskRejected = task.status === 'REJECTED'
            const isTaskOnHold = task.status === 'ON_HOLD'
            const isTaskSentBack = task.status === 'SENT_BACK'

            return (
              <div className="contentCard">
                <div className="contentCardHeader">
                  <div className="timelineHeaderRow">
                    <h3 className="contentCardTitle">
                      <Clock size={18} className="text-emerald-700" />
                      <span>ขั้นตอนการอนุมัติ</span>
                      {totalSteps > 0 && (
                        <span className="timelineStepCountBadge">
                          {completedSteps}/{totalSteps}
                        </span>
                      )}
                    </h3>

                    {totalSteps > 1 && (
                      <button
                        type="button"
                        onClick={() => setIsTimelineExpanded(!isTimelineExpanded)}
                        className="timelineToggleBtn"
                        aria-expanded={isTimelineExpanded}
                        title={isTimelineExpanded ? 'ย่อเพื่อดูเฉพาะขั้นตอนปัจจุบัน' : 'คลิกเพื่อดูขั้นตอนทั้งหมด'}
                      >
                        {isTimelineExpanded ? (
                          <>
                            <ChevronUp size={14} />
                            <span>ย่อขั้นตอน</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown size={14} />
                            <span>ดูทั้งหมด ({totalSteps})</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar Track */}
                {totalSteps > 0 && (
                  <div className="timelineProgressContainer">
                    <div className="timelineProgressBarTrack">
                      <div
                        className="timelineProgressBarFill"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="timelineProgressLabelRow">
                      <span>ความคืบหน้าภาพรวม</span>
                      <strong>{progressPct}% ({completedSteps}/{totalSteps})</strong>
                    </div>
                  </div>
                )}

                {/* Collapsed Mode: Active Step Card */}
                {!isTimelineExpanded && totalSteps > 0 ? (
                  <div className={`timelineActiveStepCard ${
                    isAllApproved ? 'isApproved' :
                    isTaskRejected ? 'isRejected' :
                    isTaskOnHold ? 'isOnHold' : ''
                  }`}>
                    <div className="timelineActiveStepHeader">
                      <span className="timelineActiveStepTag">
                        {isAllApproved ? '✓ อนุมัติครบถ้วนสมบูรณ์' :
                         isTaskRejected ? '✗ ไม่อนุมัติ / ยุติเรื่อง' :
                         isTaskOnHold ? '⏸ พักการดำเนินงาน' :
                         isTaskSentBack ? '↩ ส่งกลับให้แก้ไข' :
                         `ขั้นตอนปัจจุบัน (${currentStep?.step_no || 1}/${totalSteps})`}
                      </span>
                      <span className={`timelineStepStatusText ${
                        isAllApproved ? 'isDone' :
                        isTaskRejected ? 'isRejected' :
                        isTaskOnHold ? 'isPending' : 'isCurrent'
                      }`}>
                        {isAllApproved ? '✓ สำเร็จสิ้นสุด' :
                         isTaskRejected ? '✗ ไม่อนุมัติ' :
                         isTaskOnHold ? '● พักงานชั่วคราว' :
                         isTaskSentBack ? '● ส่งกลับแก้ไข' :
                         '● กำลังรอพิจารณา'}
                      </span>
                    </div>

                    <div className="timelineActiveStepTitle">
                      {isAllApproved ? 'ดำเนินการตามกระบวนการเสร็จสิ้นครบถ้วน' : (currentStep?.step_name || 'พิจารณาอนุมัติ')}
                    </div>

                    <div className="timelineActiveStepMeta">
                      <div className="timelineActiveStepAssignee">
                        <User size={13} className="text-slate-500" />
                        <span>ผู้รับผิดชอบ: <strong>{currentStep?.assigned_to_name || currentStep?.assigned_role || 'ผู้รับมอบหมาย'}</strong></span>
                      </div>
                      {currentStep?.assigned_to_position && (
                        <span style={{ color: '#64748b', fontSize: '0.75rem' }}>ตำแหน่ง: {currentStep.assigned_to_position}</span>
                      )}
                    </div>

                    {totalSteps > 1 && (
                      <div className="timelineActiveStepHint">
                        <span>
                          {completedSteps > 0 
                            ? `✓ ผ่านขั้นตอนก่อนหน้าแล้ว ${completedSteps} ขั้นตอน` 
                            : `รอเริ่มกระบวนการขั้นตอนแรก`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsTimelineExpanded(true)}
                          className="timelineMiniExpandBtn"
                        >
                          <span>ดูทุกขั้นตอน ({totalSteps})</span>
                          <ChevronDown size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Expanded Mode: Full Stepper Pipeline */}
                {(isTimelineExpanded || totalSteps <= 1) && totalSteps > 0 && (
                  <div className="timelinePipelineList">
                    {steps.map((st, idx) => {
                      const isCurrent = st.step_no === task.current_step_no && (task.status === 'PENDING' || task.status === 'IN_PROGRESS')
                      const isDone = st.status === 'COMPLETED'
                      const isRejected = st.status === 'REJECTED'
                      const isLast = idx === steps.length - 1

                      return (
                        <div key={st.id} className="timelinePipelineItem">
                          <div className="timelineStepTrackCol">
                            <div className={`timelineStepMarker ${
                              isDone ? 'isDone' :
                              isRejected ? 'isRejected' :
                              isCurrent ? 'isCurrent' : 'isPending'
                            }`}>
                              {isDone ? (
                                <Check size={14} />
                              ) : isRejected ? (
                                <X size={14} />
                              ) : (
                                <span>{st.step_no}</span>
                              )}
                            </div>
                            {!isLast && (
                              <div className={`timelineStepLine ${isDone ? 'isDoneLine' : ''}`} />
                            )}
                          </div>

                          <div className={`timelineStepBodyCard ${
                            isDone ? 'isDone' :
                            isRejected ? 'isRejected' :
                            isCurrent ? 'isCurrent' : ''
                          }`}>
                            <div className="timelineStepStatusRow">
                              <span className="timelineStepNumberText">ขั้นตอนที่ {st.step_no}</span>
                              <span className={`timelineStepStatusText ${
                                isDone ? 'isDone' :
                                isRejected ? 'isRejected' :
                                isCurrent ? 'isCurrent' : 'isPending'
                              }`}>
                                {isDone ? '✓ อนุมัติแล้ว' :
                                 isRejected ? '✗ ไม่อนุมัติ' :
                                 isCurrent ? '● กำลังรอพิจารณา' : 'รอดำเนินการ'}
                              </span>
                            </div>

                            <div className="timelineStepNameText">{st.step_name}</div>
                            <div className="timelineStepAssigneeText">
                              ผู้รับผิดชอบ: {st.assigned_to_name || st.assigned_role || 'ผู้รับมอบหมาย'}
                            </div>

                            {st.action_by_name && (
                              <div className="timelineStepActionBox">
                                <div className="timelineStepSigner">
                                  ลงนามโดย: <strong>{st.action_by_name}</strong>
                                </div>
                                <div className="timelineStepDate">
                                  {formatThaiDate(st.action_at)}
                                </div>
                                {st.comment && (
                                  <div className="timelineStepCommentQuote">
                                    &ldquo;{st.comment}&rdquo;
                                  </div>
                                )}
                                {st.signature_path && (
                                  <div className="timelineSignatureBadge">
                                    <ShieldCheck size={13} />
                                    <span>ประทับ e-Signature ยืนยันแล้ว</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {totalSteps > 1 && (
                      <div className="timelineCollapseFooter">
                        <button
                          type="button"
                          onClick={() => setIsTimelineExpanded(false)}
                          className="timelineToggleBtn"
                        >
                          <ChevronUp size={14} />
                          <span>ย่อขั้นตอน</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          {/* 3. ประวัติการดำเนินงาน (Audit Trail - Collapsible) */}
          <div className="contentCard">
            <div className="contentCardHeader">
              <div className="auditHeaderRow">
                <h3 className="contentCardTitle" style={{ fontSize: '0.95rem' }}>
                  <History size={16} className="text-slate-600" />
                  <span>ประวัติการดำเนินงาน</span>
                  {auditLogs.length > 0 && (
                    <span className="auditCountBadge">
                      {auditLogs.length} รายการ
                    </span>
                  )}
                </h3>

                {auditLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsAuditTrailExpanded(!isAuditTrailExpanded)}
                    className="timelineToggleBtn"
                    aria-expanded={isAuditTrailExpanded}
                    title={isAuditTrailExpanded ? 'คลิกเพื่อซ่อนประวัติ' : 'คลิกเพื่อดูประวัติการดำเนินงาน'}
                  >
                    {isAuditTrailExpanded ? (
                      <>
                        <ChevronUp size={14} />
                        <span>ซ่อนประวัติ</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown size={14} />
                        <span>ดูประวัติ ({auditLogs.length})</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {!isAuditTrailExpanded ? (
              <div
                className="auditCollapsedBox"
                onClick={() => setIsAuditTrailExpanded(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setIsAuditTrailExpanded(true)
                  }
                }}
              >
                <span className="auditCollapsedText">
                  {auditLogs.length > 0
                    ? `มีบันทึกประวัติการดำเนินงาน ${auditLogs.length} รายการ`
                    : 'ยังไม่มีประวัติการดำเนินงาน'}
                </span>
                {auditLogs.length > 0 && (
                  <span className="auditCollapsedAction">
                    <span>กดเพื่อดูประวัติ</span>
                    <ChevronDown size={14} />
                  </span>
                )}
              </div>
            ) : (
              <div>
                <div className="auditTrailList">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="auditTrailItem">
                      <div className="auditTrailTopRow">
                        <span className="auditTrailActionText">{log.action}</span>
                        <span className="auditTrailDateText">{formatThaiDate(log.created_at)}</span>
                      </div>
                      <div>โดย: {log.performer_name || `ID #${log.performed_by}`}</div>
                    </div>
                  ))}
                </div>

                <div className="auditCollapseFooter">
                  <button
                    type="button"
                    onClick={() => setIsAuditTrailExpanded(false)}
                    className="timelineToggleBtn"
                  >
                    <ChevronUp size={14} />
                    <span>ซ่อนประวัติ</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
    </>
  )
}
