'use client';

import { useState, useEffect } from 'react';
import { 
  Search, 
  User, 
  Calendar, 
  Activity, 
  FileText, 
  Pill, 
  FlaskConical, 
  HeartPulse, 
  Thermometer, 
  Scale, 
  Stethoscope, 
  X, 
  AlertCircle, 
  Clock, 
  Building2, 
  Zap, 
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Printer
} from 'lucide-react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import './page.css';

interface PatientVisit {
  hn: string;
  cid: string;
  ptname: string;
  vn: string;
  an: string | null;
  dateText: string;
  department: string;
  cc: string;
  statusName: string;
  opdDrugsCount: number;
  opdLabsCount: number;
  ipdDrugsCount: number;
  ipdLabsCount: number;
}

interface VisitDetail {
  type: 'OPD' | 'IPD';
  patient: {
    hn: string;
    cid: string;
    name: string;
    age: number;
    dateText: string;
    diagnosis?: string;
  };
  screen?: {
    bps?: number;
    bpd?: number;
    bw?: number;
    height?: number;
    pulse?: number;
    temperature?: number;
    rr?: number;
    cc?: string;
    hpi?: string;
    pe?: string;
    pmh?: string;
    department?: string;
    dxMain?: string;
    dxSub0?: string;
    dxSub1?: string;
    dxSub2?: string;
  };
  drugs: {
    dateText?: string;
    name: string;
    strength: string;
    qty: number;
    units: string;
    usage: string;
  }[];
  labs: {
    dateText?: string;
    formName: string;
    itemName: string;
    result: string;
    refValue: string;
  }[];
  xray: string | null;
}

function formatCid(cid: string) {
  if (!cid) return '-';
  const clean = cid.replace(/\D/g, '');
  if (clean.length === 13) {
    return `${clean.slice(0, 1)}-${clean.slice(1, 5)}-${clean.slice(5, 10)}-${clean.slice(10, 12)}-${clean.slice(12, 13)}`;
  }
  return cid;
}

export default function LabSearchClient() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visits, setVisits] = useState<PatientVisit[]>([]);
  const [searched, setSearched] = useState(false);

  // Modal detail states
  const [selectedVisitId, setSelectedVisitId] = useState<{ vn?: string; an?: string } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<VisitDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'screening' | 'drugs' | 'labs'>('screening');
  const [printSections, setPrintSections] = useState({
    screening: true,
    drugs: true,
    labs: true,
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setSearched(true);
    setVisits([]);

    try {
      const res = await fetch('/api/service/lab/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถค้นหาข้อมูลได้');
      }

      setVisits(data.patients || []);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = async (id: { vn?: string; an?: string }) => {
    setSelectedVisitId(id);
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    // Set default tab based on visit type
    setActiveTab(id.an ? 'drugs' : 'screening');

    try {
      const param = id.an ? `an=${id.an}` : `vn=${id.vn}`;
      const res = await fetch(`/api/service/lab/detail?${param}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถโหลดรายละเอียดได้');
      }

      setDetail(data);
      setPrintSections({
        screening: Boolean(data.type === 'OPD' && data.screen),
        drugs: (data.drugs?.length ?? 0) > 0,
        labs: (data.labs?.length ?? 0) > 0,
      });
    } catch (err: any) {
      setDetailError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูลรายละเอียด');
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePrintDocument = () => {
    if (!detail) return;

    const selectedParts: string[] = [];
    if (printSections.screening && detail.type === 'OPD' && detail.screen) {
      selectedParts.push('ซักประวัติ/สัญญาณชีพ');
    }
    if (printSections.drugs) {
      selectedParts.push(`ยาที่ได้รับ (${detail.drugs.length})`);
    }
    if (printSections.labs) {
      selectedParts.push(`ผลตรวจ LAB (${detail.labs.length})`);
    }

    const visitKey = selectedVisitId?.vn ? `VN: ${selectedVisitId.vn}` : `AN: ${selectedVisitId?.an}`;

    fetch('/api/log-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionType: 'EXPORT',
        targetTable: 'patient_lab_history',
        actionDetails: `พิมพ์เวชระเบียน HN: ${detail.patient.hn} (${visitKey}) [${selectedParts.join(', ')}]`,
      }),
    }).catch(() => {});

    const cleanTag = selectedVisitId?.vn || selectedVisitId?.an || 'visit';
    const prevTitle = typeof document !== 'undefined' ? document.title : '';
    if (typeof document !== 'undefined') {
      document.title = `เวชระเบียน_HN_${detail.patient.hn}_${cleanTag}`;
    }

    window.print();

    if (typeof document !== 'undefined') {
      setTimeout(() => {
        document.title = prevTitle;
      }, 1000);
    }
  };

  const handleCloseDetail = () => {
    setSelectedVisitId(null);
    setDetail(null);
  };

  // Prevent scroll & handle ESC key when modal is open
  useEffect(() => {
    if (selectedVisitId) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleCloseDetail();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [selectedVisitId]);

  return (
    <div className="lab-search-page">
      <div className="container">
        {/* Breadcrumb Navigation */}
        <Breadcrumb 
          items={[
            { label: 'บริการทางการแพทย์', href: '/service' },
            { label: 'ค้นหาข้อมูลผู้ป่วยและผลแลป' }
          ]} 
        />

        {/* Page Header */}
        <div className="lab-search-header animate-fadeInUp">
          <div className="lab-search-badge">
            <FlaskConical size={16} />
            <span>HOSxP Clinical Informatics</span>
          </div>
          <h1 className="lab-search-title">ระบบค้นหาข้อมูลผู้ป่วยและผลแลป</h1>
          <p className="lab-search-subtitle">
            สืบค้นประวัติการตรวจรักษาพยาบาล รายการสั่งใช้ยา และผลตรวจทางห้องปฏิบัติการ (LAB) ย้อนหลัง 20 ครั้งล่าสุด
          </p>
        </div>

        {/* Search Bar Container */}
        <div className="search-box card animate-fadeInUp">
          <form onSubmit={handleSearch} className="search-form">
            <div className="input-group">
              <span className="search-icon">
                <Search size={20} />
              </span>
              <input
                type="text"
                className="form-input search-input"
                placeholder="กรอกเลขประจำตัวประชาชน 13 หลัก หรือหมายเลข HN..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary search-btn touch-target" disabled={loading}>
              <Search size={18} />
              <span>{loading ? 'กำลังค้นหา...' : 'ค้นหาข้อมูล'}</span>
            </button>
          </form>
        </div>

        {/* Results Section */}
        <div className="results-section">
          {loading && (
            <div className="loading-state animate-fadeIn">
              <div className="spinner"></div>
              <p>กำลังดึงข้อมูลการรักษาพยาบาลย้อนหลังจากระบบ HOSxP...</p>
            </div>
          )}

          {error && (
            <div className="error-message card animate-fadeIn">
              <AlertCircle size={22} className="error-icon" />
              <div>
                <strong>เกิดข้อผิดพลาดในการค้นหา</strong>
                <p>{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && searched && (
            <>
              {visits.length > 0 ? (
                <div className="results-container animate-fadeInUp">
                  {/* Patient Banner */}
                  <div className="patient-banner card">
                    <div className="patient-banner-info">
                      <div className="patient-avatar">
                        <User size={26} />
                      </div>
                      <div>
                        <h2>{visits[0].ptname}</h2>
                        <div className="patient-meta-tags">
                          <span className="meta-pill">HN: <strong>{visits[0].hn}</strong></span>
                          <span className="meta-pill">CID: <strong>{formatCid(visits[0].cid)}</strong></span>
                          <span className="meta-pill count-pill">ประวัติพบ <strong>{visits.length}</strong> ครั้งล่าสุด</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Visits Table */}
                  <div className="visits-table-wrapper card">
                    <table className="visits-table">
                      <thead>
                        <tr>
                          <th>วันที่มาตรวจ</th>
                          <th>แผนก/หน่วยบริการ</th>
                          <th>ข้อมูลซักประวัติ (CC)</th>
                          <th>ผู้ป่วยนอก (VN)</th>
                          <th>ยา OPD</th>
                          <th>LAB OPD</th>
                          <th>สถานะการบริการ</th>
                          <th>ผู้ป่วยใน (AN)</th>
                          <th>ยา IPD</th>
                          <th>LAB IPD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visits.map((visit, index) => (
                          <tr key={index}>
                            <td className="visit-date">
                              <span className="date-badge">
                                <Calendar size={13} />
                                <span>{visit.dateText}</span>
                              </span>
                            </td>
                            <td className="visit-dept">{visit.department}</td>
                            <td className="visit-cc" title={visit.cc}>{visit.cc || '-'}</td>
                            <td>
                              <button
                                type="button"
                                onClick={() => handleOpenDetail({ vn: visit.vn })}
                                className="link-button text-primary touch-target"
                                title={`คลิกดูรายละเอียด VN: ${visit.vn}`}
                              >
                                <span>{visit.vn}</span>
                              </button>
                            </td>
                            <td>{visit.opdDrugsCount ? <span className="drug-indicator">{visit.opdDrugsCount}</span> : '-'}</td>
                            <td>{visit.opdLabsCount ? <span className="lab-indicator">{visit.opdLabsCount}</span> : '-'}</td>
                            <td>
                              <span className="status-badge">{visit.statusName || '-'}</span>
                            </td>
                            <td>
                              {visit.an ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenDetail({ an: visit.an! })}
                                  className="link-button text-gold touch-target"
                                  title={`คลิกดูรายละเอียด AN: ${visit.an}`}
                                >
                                  <span>{visit.an}</span>
                                </button>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td>{visit.ipdDrugsCount ? <span className="drug-indicator gold">{visit.ipdDrugsCount}</span> : '-'}</td>
                            <td>{visit.ipdLabsCount ? <span className="lab-indicator gold">{visit.ipdLabsCount}</span> : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="empty-state card animate-fadeIn">
                  <AlertCircle size={40} className="empty-icon" />
                  <h3>ไม่พบข้อมูลการรักษาพยาบาลย้อนหลัง</h3>
                  <p>ไม่พบข้อมูลการรักษาสำหรับเลขประจำตัวประชาชนหรือ HN ที่ระบุ กรุณาตรวจสอบความถูกต้องอีกครั้ง</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Detail View */}
        {selectedVisitId && (
          <div 
            className="modal-overlay" 
            onClick={(e) => {
              if (e.target === e.currentTarget) handleCloseDetail();
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-card card">
              {/* Modal Top Header */}
              <div className="modal-header">
                <div className="modal-header-text">
                  <div className="modal-title-wrap">
                    <FileText size={22} className="modal-title-icon" />
                    <h2 id="modal-title">ประวัติการรักษาพยาบาล</h2>
                  </div>
                  {detail && (
                    <div className="modal-patient-pills">
                      <span className="patient-name-highlight">{detail.patient.name}</span>
                      <span className="pill-dot">•</span>
                      <span>อายุ <strong>{detail.patient.age}</strong> ปี</span>
                      <span className="pill-dot">•</span>
                      <span>HN: <strong>{detail.patient.hn}</strong></span>
                      <span className="pill-dot">•</span>
                      <span className={`modal-type-badge ${detail.type.toLowerCase()}`}>
                        {detail.type === 'OPD' ? 'ผู้ป่วยนอก (OPD)' : 'ผู้ป่วยใน (IPD)'}
                      </span>
                    </div>
                  )}
                </div>
                <button 
                  className="modal-close touch-target" 
                  onClick={handleCloseDetail}
                  aria-label="ปิดหน้าต่าง"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body Scroll Area */}
              <div className="modal-body">
                {detailLoading && (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>กำลังดึงข้อมูลรายละเอียดการรักษาพยาบาล...</p>
                  </div>
                )}

                {detailError && (
                  <div className="error-message">
                    <AlertCircle size={20} />
                    <p>{detailError}</p>
                  </div>
                )}

                {detail && (
                  <>
                    {/* Meta info summary bar */}
                    <div className="visit-meta-grid">
                      <div className="meta-item">
                        <span className="meta-label">
                          <Calendar size={13} />
                          <span>{detail.type === 'OPD' ? 'วันที่มาตรวจ:' : 'วันที่ Admit:'}</span>
                        </span>
                        <span className="meta-value">{detail.patient.dateText}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">
                          <Building2 size={13} />
                          <span>แผนกที่เข้ารับบริการ:</span>
                        </span>
                        <span className="meta-value">{detail.screen?.department || (detail.type === 'OPD' ? 'แผนกผู้ป่วยนอก' : 'หอผู้ป่วยใน')}</span>
                      </div>
                      {detail.patient.diagnosis && (
                        <div className="meta-item col-span-2">
                          <span className="meta-label">
                            <Stethoscope size={13} />
                            <span>การวินิจฉัยหลัก:</span>
                          </span>
                          <span className="meta-value text-bold text-primary">{detail.patient.diagnosis}</span>
                        </div>
                      )}
                    </div>

                    {detail.xray && (
                      <div className="xray-banner alert-box">
                        <Zap size={18} className="alert-icon text-amber" />
                        <div>
                          <strong>รายการ X-ray / CT Scan:</strong> <span>{detail.xray}</span>
                        </div>
                      </div>
                    )}

                    {/* Navigation Tabs inside Modal */}
                    <div className="modal-tabs">
                      {detail.type === 'OPD' && (
                        <button
                          type="button"
                          className={`tab-btn touch-target ${activeTab === 'screening' ? 'active' : ''}`}
                          onClick={() => setActiveTab('screening')}
                        >
                          <Activity size={16} />
                          <span>ซักประวัติ & สัญญาณชีพ</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className={`tab-btn touch-target ${activeTab === 'drugs' ? 'active' : ''}`}
                        onClick={() => setActiveTab('drugs')}
                      >
                        <Pill size={16} />
                        <span>ยาที่ได้รับ ({detail.drugs.length})</span>
                      </button>
                      <button
                        type="button"
                        className={`tab-btn touch-target ${activeTab === 'labs' ? 'active' : ''}`}
                        onClick={() => setActiveTab('labs')}
                      >
                        <FlaskConical size={16} />
                        <span>ผลตรวจ LAB ({detail.labs.length})</span>
                      </button>
                    </div>

                    {/* Tab Contents Area */}
                    <div className="tab-content">
                      {activeTab === 'screening' && detail.screen && (
                        <div className="screening-tab animate-fadeIn">
                          <div className="screening-grid">
                            {/* Vitals Card */}
                            <div className="vitals-card">
                              <div className="card-section-header">
                                <HeartPulse size={18} />
                                <h3>สัญญาณชีพ (Vital Signs)</h3>
                              </div>
                              <table className="vitals-table">
                                <tbody>
                                  <tr>
                                    <th>ความดันโลหิต (BP):</th>
                                    <td><strong>{detail.screen.bps || '-'}/{detail.screen.bpd || '-'}</strong> <span className="unit">mmHg</span></td>
                                  </tr>
                                  <tr>
                                    <th>ชีพจร (Pulse):</th>
                                    <td><strong>{detail.screen.pulse || '-'}</strong> <span className="unit">bpm</span></td>
                                  </tr>
                                  <tr>
                                    <th>อุณหภูมิ (Temp):</th>
                                    <td><strong>{detail.screen.temperature || '-'}</strong> <span className="unit">°C</span></td>
                                  </tr>
                                  <tr>
                                    <th>การหายใจ (RR):</th>
                                    <td><strong>{detail.screen.rr || '-'}</strong> <span className="unit">bpm</span></td>
                                  </tr>
                                  <tr>
                                    <th>น้ำหนัก / ส่วนสูง:</th>
                                    <td><strong>{detail.screen.bw || '-'}</strong> <span className="unit">กก.</span> / <strong>{detail.screen.height || '-'}</strong> <span className="unit">ซม.</span></td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            {/* Complaint Card */}
                            <div className="complaint-card">
                              <div className="card-section-header">
                                <FileText size={18} />
                                <h3>ข้อมูลการซักประวัติ</h3>
                              </div>
                              <div className="complaint-item">
                                <strong>อาการสำคัญ (Chief Complaint):</strong>
                                <p>{detail.screen.cc || '-'}</p>
                              </div>
                              <div className="complaint-item">
                                <strong>ประวัติการเจ็บป่วยปัจจุบัน (HPI):</strong>
                                <p>{detail.screen.hpi || '-'}</p>
                              </div>
                              <div className="complaint-item">
                                <strong>ประวัติการเจ็บป่วยในอดีต (PMH):</strong>
                                <p>{detail.screen.pmh || '-'}</p>
                              </div>
                            </div>
                          </div>

                          {/* Diagnosis Box */}
                          <div className="diagnosis-box">
                            <div className="card-section-header">
                              <Stethoscope size={18} />
                              <h3>การวินิจฉัยโรค (Diagnosis)</h3>
                            </div>
                            <ul className="diagnosis-list">
                              <li><span className="diag-label">โรคหลัก (Primary Dx):</span> <strong>{detail.screen.dxMain || '-'}</strong></li>
                              {detail.screen.dxSub0 && <li><span className="diag-label">โรครอง 1:</span> <span>{detail.screen.dxSub0}</span></li>}
                              {detail.screen.dxSub1 && <li><span className="diag-label">โรครอง 2:</span> <span>{detail.screen.dxSub1}</span></li>}
                              {detail.screen.dxSub2 && <li><span className="diag-label">โรครอง 3:</span> <span>{detail.screen.dxSub2}</span></li>}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* Drugs Tab */}
                      {activeTab === 'drugs' && (
                        <div className="drugs-tab animate-fadeIn">
                          {detail.drugs.length > 0 ? (
                            <div className="detail-table-wrapper">
                              <table className="detail-table">
                                <thead>
                                  <tr>
                                    {detail.type === 'IPD' && <th>วันที่จ่ายยา</th>}
                                    <th>ชื่อยาและความแรง</th>
                                    <th>จำนวน</th>
                                    <th>วิธีใช้ยา</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detail.drugs.map((drug, index) => (
                                    <tr key={index}>
                                      {detail.type === 'IPD' && <td className="nowrap">{drug.dateText}</td>}
                                      <td className="text-bold text-dark">
                                        <div className="drug-name-wrap">
                                          <Pill size={15} className="drug-icon" />
                                          <span>{drug.name} {drug.strength}</span>
                                        </div>
                                      </td>
                                      <td className="drug-qty"><strong>{drug.qty}</strong> {drug.units}</td>
                                      <td className="drug-usage">{drug.usage}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="no-data-box">
                              <p>ไม่มีประวัติรายการจ่ายยาในการรับบริการนี้</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Labs Tab */}
                      {activeTab === 'labs' && (
                        <div className="labs-tab animate-fadeIn">
                          {detail.labs.length > 0 ? (
                            <div className="detail-table-wrapper">
                              <table className="detail-table">
                                <thead>
                                  <tr>
                                    {detail.type === 'IPD' && <th>วันที่รายงาน</th>}
                                    <th>แบบฟอร์ม LAB</th>
                                    <th>รายการตรวจ LAB</th>
                                    <th>ผลตรวจ</th>
                                    <th>ค่าอ้างอิงปกติ</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detail.labs.map((lab, index) => (
                                    <tr key={index}>
                                      {detail.type === 'IPD' && <td className="nowrap">{lab.dateText}</td>}
                                      <td className="lab-form-name">{lab.formName}</td>
                                      <td className="text-bold text-dark">{lab.itemName}</td>
                                      <td className="lab-result-cell">
                                        <span className="lab-result-badge">{lab.result}</span>
                                      </td>
                                      <td className="lab-ref-cell">{lab.refValue || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="no-data-box">
                              <p>ไม่มีบันทึกรายงานผลแลป (LAB) ในการรับบริการนี้</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Printable Document (Visible only when printing) */}
                    <div id="lab-printable-document" aria-hidden="true">
                      <table className="lab-print-layout-table">
                        <thead>
                          <tr>
                            <td>
                              {/* Document Header */}
                              <div className="lab-print-header">
                                <div className="lab-print-header-titles">
                                  <h1 className="lab-print-hospital-name">โรงพยาบาลเถิน (Thoen Hospital)</h1>
                                  <p className="lab-print-doc-sub">อำเภอเถิน จังหวัดลำปาง • กลุ่มงานสารสนเทศทางการแพทย์</p>
                                  <h2 className="lab-print-doc-title">ใบสรุปประวัติการตรวจรักษาและผลการตรวจทางห้องปฏิบัติการ</h2>
                                </div>
                                <div className="lab-print-doc-meta">
                                  <div>
                                    วันที่พิมพ์:{' '}
                                    {new Intl.DateTimeFormat('th-TH', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    }).format(new Date())}
                                  </div>
                                  <div>
                                    ประเภท:{' '}
                                    {detail.type === 'OPD'
                                      ? `ผู้ป่วยนอก (VN: ${selectedVisitId?.vn || '-'})`
                                      : `ผู้ป่วยใน (AN: ${selectedVisitId?.an || '-'})`}
                                  </div>
                                </div>
                              </div>

                              {/* Patient Information Box (Repeats on every printed page) */}
                              <div className="lab-print-patient-box">
                                <div className="lab-print-info-row">
                                  <div><strong>ชื่อ-นามสกุล:</strong> {detail.patient.name}</div>
                                  <div><strong>HN:</strong> {detail.patient.hn}</div>
                                  <div><strong>เลขประจำตัวประชาชน:</strong> {formatCid(detail.patient.cid)}</div>
                                  <div><strong>อายุ:</strong> {detail.patient.age} ปี</div>
                                </div>
                                <div className="lab-print-info-row">
                                  <div><strong>วันที่รับบริการ:</strong> {detail.patient.dateText}</div>
                                  <div>
                                    <strong>แผนก:</strong>{' '}
                                    {detail.screen?.department || (detail.type === 'OPD' ? 'ผู้ป่วยนอก' : 'ผู้ป่วยใน')}
                                  </div>
                                  <div style={{ gridColumn: 'span 2' }}>
                                    <strong>การวินิจฉัยหลัก (Primary Dx):</strong>{' '}
                                    {detail.patient.diagnosis || detail.screen?.dxMain || '-'}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        </thead>

                        <tbody>
                          <tr>
                            <td>
                              {/* Section 1: Screening & Vitals */}
                              {printSections.screening && detail.type === 'OPD' && detail.screen && (
                                <div className="lab-print-section">
                                  <h3 className="lab-print-section-title">ข้อมูลการซักประวัติและสัญญาณชีพ (Triage & Vital Signs)</h3>
                                  <div className="lab-print-vitals-grid">
                                    <div><strong>ความดันโลหิต (BP):</strong> {detail.screen.bps || '-'}/{detail.screen.bpd || '-'} mmHg</div>
                                    <div><strong>ชีพจร (Pulse):</strong> {detail.screen.pulse || '-'} bpm</div>
                                    <div><strong>อุณหภูมิ (Temp):</strong> {detail.screen.temperature || '-'} °C</div>
                                    <div><strong>การหายใจ (RR):</strong> {detail.screen.rr || '-'} bpm</div>
                                    <div><strong>น้ำหนัก:</strong> {detail.screen.bw || '-'} กก.</div>
                                    <div><strong>ส่วนสูง:</strong> {detail.screen.height || '-'} ซม.</div>
                                  </div>

                                  <div className="lab-print-complaints">
                                    <div className="lab-print-complaint-item">
                                      <strong>อาการสำคัญ (Chief Complaint):</strong> {detail.screen.cc || '-'}
                                    </div>
                                    {detail.screen.hpi && (
                                      <div className="lab-print-complaint-item">
                                        <strong>ประวัติการเจ็บป่วยปัจจุบัน (HPI):</strong> {detail.screen.hpi}
                                      </div>
                                    )}
                                    {detail.screen.pmh && (
                                      <div className="lab-print-complaint-item">
                                        <strong>ประวัติการเจ็บป่วยในอดีต (PMH):</strong> {detail.screen.pmh}
                                      </div>
                                    )}
                                  </div>

                                  {(detail.screen.dxMain || detail.screen.dxSub0 || detail.screen.dxSub1 || detail.screen.dxSub2) && (
                                    <div className="lab-print-dx-box">
                                      <strong>การวินิจฉัยโรค (Diagnosis): </strong>
                                      {[detail.screen.dxMain, detail.screen.dxSub0, detail.screen.dxSub1, detail.screen.dxSub2]
                                        .filter(Boolean)
                                        .join(' | ')}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Section 2: Drugs */}
                              {printSections.drugs && (
                                <div className="lab-print-section">
                                  <h3 className="lab-print-section-title">
                                    รายการยาที่ได้รับ ({detail.drugs.length} รายการ)
                                  </h3>
                                  {detail.drugs.length > 0 ? (
                                    <table className="lab-print-table">
                                      <thead>
                                        <tr>
                                          <th style={{ width: '40px', textAlign: 'center' }}>ลำดับ</th>
                                          {detail.type === 'IPD' && <th style={{ width: '95px' }}>วันที่จ่าย</th>}
                                          <th>ชื่อยาและความแรง</th>
                                          <th style={{ width: '85px', textAlign: 'right' }}>จำนวน</th>
                                          <th>วิธีใช้ยา</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {detail.drugs.map((drug, idx) => (
                                          <tr key={idx}>
                                            <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                            {detail.type === 'IPD' && <td>{drug.dateText || '-'}</td>}
                                            <td><strong>{drug.name}</strong> {drug.strength}</td>
                                            <td style={{ textAlign: 'right' }}>{drug.qty} {drug.units}</td>
                                            <td>{drug.usage}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <p className="lab-print-empty-note">- ไม่มีประวัติการสั่งใช้ยาในการรับบริการนี้ -</p>
                                  )}
                                </div>
                              )}

                              {/* Section 3: Labs */}
                              {printSections.labs && (
                                <div className="lab-print-section">
                                  <h3 className="lab-print-section-title">
                                    ผลตรวจทางห้องปฏิบัติการ LAB ({detail.labs.length} รายการ)
                                  </h3>
                                  {detail.labs.length > 0 ? (
                                    <table className="lab-print-table">
                                      <thead>
                                        <tr>
                                          <th style={{ width: '40px', textAlign: 'center' }}>ลำดับ</th>
                                          {detail.type === 'IPD' && <th style={{ width: '95px' }}>วันที่รายงาน</th>}
                                          <th style={{ width: '180px' }}>กลุ่มแบบฟอร์ม LAB</th>
                                          <th>รายการตรวจ</th>
                                          <th style={{ width: '100px', textAlign: 'center' }}>ผลตรวจ</th>
                                          <th style={{ width: '120px' }}>ค่าอ้างอิงปกติ</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {detail.labs.map((lab, idx) => (
                                          <tr key={idx}>
                                            <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                            {detail.type === 'IPD' && <td>{lab.dateText || '-'}</td>}
                                            <td>{lab.formName}</td>
                                            <td><strong>{lab.itemName}</strong></td>
                                            <td style={{ textAlign: 'center' }}><strong>{lab.result}</strong></td>
                                            <td>{lab.refValue || '-'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <p className="lab-print-empty-note">- ไม่มีบันทึกผลการตรวจทางห้องปฏิบัติการในการรับบริการนี้ -</p>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        </tbody>

                        <tfoot>
                          <tr>
                            <td>
                              {/* Document Footer */}
                              <div className="lab-print-footer">
                                <div className="lab-print-footer-notice">
                                  * เอกสารสรุปเวชระเบียน ใช้สำหรับการดูแลรักษาพยาบาลและการติดตามอาการของผู้ป่วย ข้อมูลนี้ได้รับความคุ้มครองตาม พ.ร.บ. สุขภาพแห่งชาติ
                                </div>
                                <div className="lab-print-footer-signature">
                                  <span>โรงพยาบาลเถิน อ.เถิน จ.ลำปาง</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Bottom Footer */}
              <div className="modal-footer">
                <div className="print-controls-bar">
                  <span className="print-controls-label">เลือกส่วนพิมพ์:</span>
                  <div className="print-checkboxes">
                    {detail?.type === 'OPD' && (
                      <label className={`print-checkbox-label ${!detail?.screen ? 'disabled' : ''}`}>
                        <input
                          type="checkbox"
                          checked={Boolean(printSections.screening && detail?.screen)}
                          disabled={!detail?.screen}
                          onChange={(e) => setPrintSections((prev) => ({ ...prev, screening: e.target.checked }))}
                        />
                        <span>ซักประวัติ & สัญญาณชีพ</span>
                      </label>
                    )}
                    <label className="print-checkbox-label">
                      <input
                        type="checkbox"
                        checked={printSections.drugs}
                        onChange={(e) => setPrintSections((prev) => ({ ...prev, drugs: e.target.checked }))}
                      />
                      <span>ยาที่ได้รับ ({detail?.drugs.length || 0})</span>
                    </label>
                    <label className="print-checkbox-label">
                      <input
                        type="checkbox"
                        checked={printSections.labs}
                        onChange={(e) => setPrintSections((prev) => ({ ...prev, labs: e.target.checked }))}
                      />
                      <span>ผลตรวจ LAB ({detail?.labs.length || 0})</span>
                    </label>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary print-trigger-btn touch-target"
                    disabled={
                      !detail ||
                      detailLoading ||
                      !(
                        (printSections.screening && detail?.type === 'OPD' && detail?.screen) ||
                        printSections.drugs ||
                        printSections.labs
                      )
                    }
                    onClick={handlePrintDocument}
                    title="สั่งพิมพ์ออกเครื่องพิมพ์ หรือเลือก Save as PDF ในหน้าต่างพิมพ์"
                  >
                    <Printer size={16} />
                    <span>พิมพ์เอกสาร (PDF)</span>
                  </button>
                </div>
                <button type="button" className="btn btn-outline touch-target" onClick={handleCloseDetail}>
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
