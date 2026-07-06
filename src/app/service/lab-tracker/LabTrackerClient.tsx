'use client';

import { useState, useEffect, useCallback } from 'react';
import './page.css';

interface DoctorItem {
  code: string;
  name: string;
  count: number;
}

interface PatientReportItem {
  hn: string;
  patientName: string;
  formName?: string;
  orderTime?: string;
  receiveTime?: string;
  reportTime?: string;
  ovstost?: string;
  doctorName?: string;
}

interface LabDetail {
  hn: string;
  patientName: string;
  reported: {
    formName: string;
    itemName: string;
    result: string;
    refValue: string;
  }[];
  pending: {
    formName: string;
    itemName: string;
    isOutLab: string;
  }[];
}

export default function LabTrackerClient() {
  // Navigation states
  const [activeDoctor, setActiveDoctor] = useState<{ code: string; name: string } | null>(null);

  // Search Filter state
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [dashboardData, setDashboardData] = useState<{ doctors: DoctorItem[]; others: DoctorItem[]; totalCount: number } | null>(null);
  const [reportData, setReportData] = useState<{ pending: PatientReportItem[]; reported: PatientReportItem[] } | null>(null);
  
  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Modal detailed states
  const [selectedHn, setSelectedHn] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalData, setModalData] = useState<LabDetail | null>(null);

  // Fetch Dashboard data (doctors and nurses)
  const fetchDashboard = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/service/lab-tracker/doctors');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถดึงข้อมูลรายการผู้สั่งตรวจได้');
      }
      setDashboardData(data);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการโหลดแดชบอร์ด');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Fetch report lists for selected doctor/staff
  const fetchDoctorReport = useCallback(async (code: string, isSilent = false) => {
    if (!isSilent) setReportLoading(true);
    try {
      const res = await fetch(`/api/service/lab-tracker/report?id=${code}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถดึงประวัติรายงาน LAB ได้');
      }
      setReportData({
        pending: data.pending || [],
        reported: data.reported || []
      });
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการโหลดรายการความคืบหน้า');
    } finally {
      if (!isSilent) setReportLoading(false);
    }
  }, []);

  // Auto-refresh interval (every 60 seconds)
  useEffect(() => {
    fetchDashboard();

    const interval = setInterval(() => {
      if (activeDoctor) {
        fetchDoctorReport(activeDoctor.code, true);
      } else {
        fetchDashboard(true);
      }
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [activeDoctor, fetchDashboard, fetchDoctorReport]);

  const handleSelectDoctor = (code: string, name: string) => {
    setActiveDoctor({ code, name });
    setReportData(null);
    setSearchQuery('');
    fetchDoctorReport(code);
  };

  const handleBackToDashboard = () => {
    setActiveDoctor(null);
    setReportData(null);
    setSearchQuery('');
    fetchDashboard();
  };

  const handleOpenLabDetail = async (hn: string) => {
    setSelectedHn(hn);
    setModalLoading(true);
    setModalError(null);
    setModalData(null);

    try {
      const res = await fetch(`/api/service/lab-tracker/detail?hn=${hn}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถโหลดผลตรวจ LAB ได้');
      }
      setModalData(data);
    } catch (err: any) {
      setModalError(err.message || 'เกิดข้อผิดพลาดในการโหลดผลตรวจ');
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedHn(null);
    setModalData(null);
  };

  // Prevent background scroll when modal open
  useEffect(() => {
    if (selectedHn) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedHn]);

  // Filter lists based on searchQuery
  const filteredPending = reportData?.pending.filter(p => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      p.hn.toLowerCase().includes(query) ||
      p.patientName.toLowerCase().includes(query) ||
      (p.formName || '').toLowerCase().includes(query) ||
      (p.doctorName || '').toLowerCase().includes(query)
    );
  }) || [];

  const filteredReported = reportData?.reported.filter(r => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      r.hn.toLowerCase().includes(query) ||
      r.patientName.toLowerCase().includes(query) ||
      (r.formName || '').toLowerCase().includes(query) ||
      (r.doctorName || '').toLowerCase().includes(query)
    );
  }) || [];

  return (
    <>
      <div className="container lab-tracker-page">
        {/* Header section */}
        <div className="tracker-header">
          <h1>ระบบติดตามผลตรวจทางห้องปฏิบัติการ (LAB Tracker)</h1>
          <p className="tracker-subtitle">
            ตรวจสอบความคืบหน้าการรายงานผลและติดตามตรวจทางห้องปฏิบัติการประจำวัน สำหรับ รพ.สต.
          </p>
          <div className="refresh-status">
            <span>อัปเดตล่าสุดเมื่อ: <strong>{lastRefreshed.toLocaleTimeString()}</strong></span>
            <button 
              onClick={() => activeDoctor ? fetchDoctorReport(activeDoctor.code) : fetchDashboard()} 
              className="refresh-btn"
              title="รีเฟรชข้อมูล"
            >
              🔄 รีเฟรชทันที (ระบบอัปเดตอัตโนมัติทุก 60 วินาที)
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message card">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && !dashboardData && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>กำลังเชื่อมต่อข้อมูลรายงานความคืบหน้า LAB วันนี้...</p>
          </div>
        )}

        {/* View 1: Dashboard Doctor List */}
        {!activeDoctor && dashboardData && (
          <div className="tracker-dashboard">
            <div className="dashboard-grid">
              {/* Doctors card */}
              <div className="group-card card doctor-group">
                <div className="group-header">
                  <h2>กลุ่มแพทย์ผู้สั่งตรวจ</h2>
                  <span className="group-badge bg-primary">มีใบสั่งแลป {dashboardData.doctors.length} ท่าน</span>
                </div>
                <div className="group-body">
                  {dashboardData.doctors.length > 0 ? (
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>ชื่อผู้สั่งตรวจ</th>
                          <th>จำนวนส่งตรวจ (คน)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardData.doctors.map((doc) => (
                          <tr key={doc.code} onClick={() => handleSelectDoctor(doc.code, doc.name)} className="clickable-row">
                            <td className="doc-name">{doc.name}</td>
                            <td className="doc-count"><strong>{doc.count}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="no-orders-text">ไม่มีประวัติการส่งตรวจแลปจากกลุ่มแพทย์ในวันนี้</p>
                  )}
                </div>
              </div>

              {/* Nurses/Others Card */}
              <div className="group-card card nurse-group">
                <div className="group-header">
                  <h2>กลุ่มพยาบาลและเจ้าหน้าที่อื่นๆ</h2>
                  <span className="group-badge bg-gold">มีใบสั่งแลป {dashboardData.others.length} ท่าน</span>
                </div>
                <div className="group-body">
                  {dashboardData.others.length > 0 ? (
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>ชื่อผู้สั่งตรวจ</th>
                          <th>จำนวนส่งตรวจ (คน)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardData.others.map((staff) => (
                          <tr key={staff.code} onClick={() => handleSelectDoctor(staff.code, staff.name)} className="clickable-row">
                            <td className="doc-name">{staff.name}</td>
                            <td className="doc-count"><strong>{staff.count}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="no-orders-text">ไม่มีประวัติการส่งตรวจแลปจากกลุ่มพยาบาล/เจ้าหน้าที่ในวันนี้</p>
                  )}
                </div>
              </div>

              {/* Options selection Panel */}
              <div className="group-card card options-group">
                <div className="group-header">
                  <h2>เมนูระบบงานตรวจแลป</h2>
                </div>
                <div className="group-body options-body">
                  <div 
                    className="all-orders-card" 
                    onClick={() => handleSelectDoctor('all', 'สั่งตรวจทั้งหมดในวันนี้')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleSelectDoctor('all', 'สั่งตรวจทั้งหมดในวันนี้')
                      }
                    }}
                  >
                    <h3>ดูรายการผู้ป่วยทั้งหมดที่สั่ง LAB วันนี้</h3>
                    <p>จำนวนยอดผู้ป่วยสะสมที่สั่งตรวจสะสม: <strong>{dashboardData.totalCount}</strong> ราย</p>
                    <span className="btn btn-outline btn-sm">เปิดดูผู้ป่วยทั้งหมด</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View 2: Doctor Progress Report lists */}
        {activeDoctor && (
          <div className="doctor-report-view">
            <div className="report-navbar card">
              <button onClick={handleBackToDashboard} className="btn btn-outline btn-sm">
                ย้อนกลับ
              </button>
              <div className="navbar-info">
                <h2>รายการติดตามตรวจ LAB ของ: <span className="text-primary">{activeDoctor.name}</span></h2>
                <p>ประจำวันที่สั่ง: <strong>{new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })}</strong></p>
              </div>
              <div className="navbar-search">
                <input 
                  type="text" 
                  placeholder="🔍 ค้นหา (HN, ชื่อ-สกุล, ฟอร์ม)..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="navbar-search-input"
                />
              </div>
            </div>

            {reportLoading && !reportData && (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>กำลังดึงข้อมูลความคืบหน้าการรายงานผลแลป...</p>
              </div>
            )}

            {reportData && (
              <div className="report-tables-grid">
                {/* Table 1: Pending */}
                <div className="progress-table-card card pending-card">
                  <div className="table-header bg-orange">
                    <h3>⏳ อยู่ระหว่างรอรายงานผลตรวจ</h3>
                    <span className="table-badge">{filteredPending.length} รายการ</span>
                  </div>
                  <div className="table-body">
                    {filteredPending.length > 0 ? (
                      <div className="table-wrapper">
                        <table className="progress-table">
                          <thead>
                            <tr>
                              <th>HN</th>
                              <th>ชื่อ - สกุล</th>
                              <th>LAB Form</th>
                              <th>เวลาสั่ง</th>
                              <th>รับ<br />ออร์เดอร์</th>
                              {activeDoctor.code === 'all' && <th>ผู้สั่ง</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredPending.map((p, index) => (
                              <tr key={index}>
                                <td>
                                  <button onClick={() => handleOpenLabDetail(p.hn)} className="hn-btn pending">
                                    {p.hn}
                                  </button>
                                </td>
                                <td className="patient-name">{p.patientName}</td>
                                <td>{p.formName}</td>
                                <td>{p.orderTime}</td>
                                <td>{p.receiveTime}</td>
                                {activeDoctor.code === 'all' && <td className="nowrap">{p.doctorName}</td>}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="no-data-text">
                        {searchQuery ? 'ไม่พบข้อมูลที่ตรงกับการค้นหา' : 'ไม่มีข้อมูลผู้ป่วยที่อยู่ระหว่างรอรายงานผลตรวจในเวลานี้'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Table 2: Completed / Reported */}
                <div className="progress-table-card card reported-card">
                  <div className="table-header bg-green">
                    <h3>✅ รายงานผลแลปเรียบร้อยแล้ว</h3>
                    <span className="table-badge">{filteredReported.length} รายการ</span>
                  </div>
                  <div className="table-body">
                    {filteredReported.length > 0 ? (
                      <div className="table-wrapper">
                        <table className="progress-table">
                          <thead>
                            <tr>
                              <th>HN</th>
                              <th>ชื่อ - สกุล</th>
                              <th>เวลารายงานผล</th>
                              {activeDoctor.code === 'all' && <th>ผู้สั่ง</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredReported.map((r, index) => {
                              const isGreenState = r.ovstost === '99';
                              return (
                                <tr key={index} className={isGreenState ? 'special-state-row' : ''}>
                                  <td>
                                    <button onClick={() => handleOpenLabDetail(r.hn)} className="hn-btn completed">
                                      {r.hn}
                                    </button>
                                  </td>
                                  <td className="patient-name">{r.patientName}</td>
                                  <td>{r.reportTime}</td>
                                  {activeDoctor.code === 'all' && <td className="nowrap">{r.doctorName}</td>}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="no-data-text">
                        {searchQuery ? 'ไม่พบข้อมูลที่ตรงกับการค้นหา' : 'ไม่มีข้อมูลผู้ป่วยที่ตรวจวิเคราะห์และรายงานผลเสร็จสิ้นในวันนี้'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal detailed results (Moved outside container to avoid parent stack context issues) */}
      {selectedHn && (
        <div 
          className="modal-overlay" 
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal()
          }}
          role="button"
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
              handleCloseModal()
            }
          }}
        >
          <div className="modal-card card">
            <div className="modal-header">
              <div>
                <h2>รายงานผลการตรวจทางห้องปฏิบัติการ (LAB)</h2>
                {modalData && (
                  <p className="modal-subtitle">
                    ผู้ป่วย: <strong>{modalData.patientName}</strong> | HN: <strong>{modalData.hn}</strong>
                  </p>
                )}
              </div>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>

            <div className="modal-body">
              {modalLoading && (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>กำลังดึงผลแลปวันนี้จากระบบ HOSxP...</p>
                </div>
              )}

              {modalError && (
                <div className="error-message">
                  <span className="error-icon">⚠️</span>
                  <p>{modalError}</p>
                </div>
              )}

              {modalData && (
                <div className="modal-tables-container">
                  {/* Reported LABs Table */}
                  {modalData.reported.length > 0 && (
                    <div className="detail-section">
                      <h3 className="section-title text-green">รายการผล LAB ที่ออกรายงานแล้ว</h3>
                      <div className="detail-table-wrapper">
                        <table className="detail-table">
                          <thead>
                            <tr>
                              <th>LAB Form</th>
                              <th>รายการตรวจ</th>
                              <th>ผล LAB</th>
                              <th>ค่าอ้างอิงปกติ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modalData.reported.map((r, index) => (
                              <tr key={index}>
                                <td>{r.formName}</td>
                                <td className="text-bold">{r.itemName}</td>
                                <td className="lab-result-value">{r.result}</td>
                                <td>{r.refValue || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Pending LABs Table */}
                  {modalData.pending.length > 0 && (
                    <div className="detail-section" style={{ marginTop: '2rem' }}>
                      <h3 className="section-title text-orange">รายการ LAB ที่อยู่ระหว่างตรวจวิเคราะห์</h3>
                      <div className="detail-table-wrapper">
                        <table className="detail-table">
                          <thead>
                            <tr>
                              <th>LAB Form</th>
                              <th>รายการตรวจ</th>
                              <th>การส่งตรวจ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modalData.pending.map((p, index) => (
                              <tr key={index}>
                                <td>{p.formName}</td>
                                <td className="text-bold">{p.itemName}</td>
                                <td className="nowrap">
                                  {p.isOutLab === 'Y' ? (
                                    <span className="badge badge-gold">ส่งตรวจแลปภายนอก (Outlab)</span>
                                  ) : (
                                    <span className="badge badge-primary">ตรวจวิเคราะห์ภายใน รพ.</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {modalData.reported.length === 0 && modalData.pending.length === 0 && (
                    <p className="no-data-text">ไม่พบรายการสั่งตรวจแลปในวันนี้ของผู้ป่วยรายนี้</p>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={handleCloseModal}>
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
