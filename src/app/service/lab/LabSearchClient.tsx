'use client';

import { useState, useEffect } from 'react';
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
    } catch (err: any) {
      setDetailError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูลรายละเอียด');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedVisitId(null);
    setDetail(null);
  };

  // Prevent scroll when modal is open
  useEffect(() => {
    if (selectedVisitId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedVisitId]);

  return (
    <>
      <div className="container lab-search-page">
      <div className="lab-search-header">
        <h1>ระบบค้นหาข้อมูลผู้ป่วยและผลแลป</h1>
        <p className="lab-search-subtitle">
          สืบค้นประวัติการตรวจรักษาพยาบาล รายการสั่งใช้ยา และผลตรวจทางห้องปฏิบัติการ (LAB) ย้อนหลัง 20 ครั้งล่าสุด
        </p>
      </div>

      {/* Search Bar */}
      <div className="search-box card">
        <form onSubmit={handleSearch} className="search-form">
          <div className="input-group">
            <span className="search-icon">🔍</span>
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
          <button type="submit" className="btn btn-primary search-btn" disabled={loading}>
            {loading ? 'กำลังค้นหา...' : 'ค้นหาข้อมูล'}
          </button>
        </form>
      </div>

      {/* Results Section */}
      <div className="results-section">
        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>กำลังดึงข้อมูลการรักษาพยาบาลย้อนหลังจากระบบ HOSxP...</p>
          </div>
        )}

        {error && (
          <div className="error-message card">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && searched && (
          <>
            {visits.length > 0 ? (
              <div className="results-container">
                <div className="patient-banner card">
                  <div className="patient-banner-info">
                    <div>
                      <h2>{visits[0].ptname}</h2>
                      <p>HN: <strong>{visits[0].hn}</strong> | CID: <strong>{visits[0].cid}</strong></p>
                    </div>
                  </div>
                </div>

                <div className="visits-table-wrapper card">
                  <table className="visits-table">
                    <thead>
                      <tr>
                        <th>วันที่มา</th>
                        <th>หน่วยบริการ</th>
                        <th>ข้อมูลซักประวัติ</th>
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
                          <td className="visit-date">{visit.dateText}</td>
                          <td>{visit.department}</td>
                          <td className="visit-cc" title={visit.cc}>{visit.cc || '-'}</td>
                          <td>
                            <button
                              onClick={() => handleOpenDetail({ vn: visit.vn })}
                              className="link-button text-primary"
                            >
                              {visit.vn}
                            </button>
                          </td>
                          <td>{visit.opdDrugsCount || '-'}</td>
                          <td>{visit.opdLabsCount ? <span className="lab-indicator">{visit.opdLabsCount}</span> : '-'}</td>
                          <td>{visit.statusName || '-'}</td>
                          <td>
                            {visit.an ? (
                              <button
                                onClick={() => handleOpenDetail({ an: visit.an! })}
                                className="link-button text-gold"
                              >
                                {visit.an}
                              </button>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td>{visit.ipdDrugsCount || '-'}</td>
                          <td>{visit.ipdLabsCount ? <span className="lab-indicator gold">{visit.ipdLabsCount}</span> : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="empty-state card">
                <p>ไม่พบข้อมูลการรักษาพยาบาลย้อนหลัง สำหรับคำค้นหานี้</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Detail View */}
      {selectedVisitId && (
        <div className="modal-overlay" onClick={handleCloseDetail}>
          <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>ประวัติการรักษาพยาบาล</h2>
                {detail && (
                  <p className="modal-subtitle">
                    <strong>{detail.patient.name}</strong> ({detail.patient.age} ปี) | HN: <strong>{detail.patient.hn}</strong>
                  </p>
                )}
              </div>
              <button className="modal-close" onClick={handleCloseDetail}>×</button>
            </div>

            <div className="modal-body">
              {detailLoading && (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>กำลังดึงข้อมูลโดยละเอียด...</p>
                </div>
              )}

              {detailError && (
                <div className="error-message">
                  <span className="error-icon">⚠️</span>
                  <p>{detailError}</p>
                </div>
              )}

              {detail && (
                <>
                  <div className="visit-meta-grid">
                    <div className="meta-item">
                      <span className="meta-label">{detail.type === 'OPD' ? 'วันที่มาตรวจ:' : 'วันที่ Admit:'}</span>
                      <span className="meta-value">{detail.patient.dateText}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">ประเภทผู้ป่วย:</span>
                      <span className={`meta-value type-badge ${detail.type.toLowerCase()}`}>{detail.type === 'OPD' ? 'ผู้ป่วยนอก (OPD)' : 'ผู้ป่วยใน (IPD)'}</span>
                    </div>
                    {detail.patient.diagnosis && (
                      <div className="meta-item col-span-2">
                        <span className="meta-label">การวินิจฉัยหลัก:</span>
                        <span className="meta-value text-bold text-primary">{detail.patient.diagnosis}</span>
                      </div>
                    )}
                  </div>

                  {detail.xray && (
                    <div className="xray-banner alert-box">
                      <span className="alert-icon">⚡</span>
                      <div>
                        <strong>รายการ X-ray / CT Scan:</strong> {detail.xray}
                      </div>
                    </div>
                  )}

                  {/* Tabs */}
                  <div className="modal-tabs">
                    {detail.type === 'OPD' && (
                      <button
                        className={`tab-btn ${activeTab === 'screening' ? 'active' : ''}`}
                        onClick={() => setActiveTab('screening')}
                      >
                        ซักประวัติ & วินิจฉัย
                      </button>
                    )}
                    <button
                      className={`tab-btn ${activeTab === 'drugs' ? 'active' : ''}`}
                      onClick={() => setActiveTab('drugs')}
                    >
                      ยาที่ได้รับ ({detail.drugs.length})
                    </button>
                    <button
                      className={`tab-btn ${activeTab === 'labs' ? 'active' : ''}`}
                      onClick={() => setActiveTab('labs')}
                    >
                      ผลตรวจ LAB ({detail.labs.length})
                    </button>
                  </div>

                  <div className="tab-content">
                    {activeTab === 'screening' && detail.screen && (
                      <div className="screening-tab">
                        <div className="screening-grid">
                          <div className="vitals-card">
                            <h3>สัญญาณชีพ (Vitals)</h3>
                            <table className="vitals-table">
                              <tbody>
                                <tr>
                                  <td>ความดันโลหิต (BP):</td>
                                  <td><strong>{detail.screen.bps || '-'}/{detail.screen.bpd || '-'}</strong> mmHg</td>
                                </tr>
                                <tr>
                                  <td>ชีพจร (Pulse):</td>
                                  <td><strong>{detail.screen.pulse || '-'}</strong> bpm</td>
                                </tr>
                                <tr>
                                  <td>อุณหภูมิ (Temp):</td>
                                  <td><strong>{detail.screen.temperature || '-'}</strong> °C</td>
                                </tr>
                                <tr>
                                  <td>การหายใจ (RR):</td>
                                  <td><strong>{detail.screen.rr || '-'}</strong> bpm</td>
                                </tr>
                                <tr>
                                  <td>น้ำหนัก/ส่วนสูง:</td>
                                  <td><strong>{detail.screen.bw || '-'}</strong> กก. / <strong>{detail.screen.height || '-'}</strong> ซม.</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          <div className="complaint-card">
                            <h3>ข้อมูลการซักประวัติ</h3>
                            <div className="complaint-item">
                              <strong>อาการสำคัญ (CC):</strong>
                              <p>{detail.screen.cc || '-'}</p>
                            </div>
                            <div className="complaint-item">
                              <strong>ประวัติปัจจุบัน (PI):</strong>
                              <p>{detail.screen.hpi || '-'}</p>
                            </div>
                            <div className="complaint-item">
                              <strong>ประวัติอดีต (PMH):</strong>
                              <p>{detail.screen.pmh || '-'}</p>
                            </div>
                          </div>
                        </div>

                        <div className="diagnosis-box">
                          <h3>การวินิจฉัยโรค (Diagnosis)</h3>
                          <ul className="diagnosis-list">
                            <li><strong>โรคหลัก (Primary dx):</strong> {detail.screen.dxMain || '-'}</li>
                            <li><strong>โรครอง 1:</strong> {detail.screen.dxSub0 || '-'}</li>
                            <li><strong>โรครอง 2:</strong> {detail.screen.dxSub1 || '-'}</li>
                            <li><strong>โรครอง 3:</strong> {detail.screen.dxSub2 || '-'}</li>
                          </ul>
                        </div>
                      </div>
                    )}

                    {activeTab === 'drugs' && (
                      <div className="drugs-tab">
                        {detail.drugs.length > 0 ? (
                          <div className="detail-table-wrapper">
                            <table className="detail-table">
                              <thead>
                                <tr>
                                  {detail.type === 'IPD' && <th>วันที่จ่ายยา</th>}
                                  <th>ชื่อยา</th>
                                  <th>จำนวน</th>
                                  <th>วิธีใช้</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.drugs.map((drug, index) => (
                                  <tr key={index}>
                                    {detail.type === 'IPD' && <td className="nowrap">{drug.dateText}</td>}
                                    <td className="text-bold">{drug.name} {drug.strength}</td>
                                    <td>{drug.qty} {drug.units}</td>
                                    <td>{drug.usage}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="no-data-text">ไม่มีประวัติรายการจ่ายยาในการรับบริการนี้</p>
                        )}
                      </div>
                    )}

                    {activeTab === 'labs' && (
                      <div className="labs-tab">
                        {detail.labs.length > 0 ? (
                          <div className="detail-table-wrapper">
                            <table className="detail-table">
                              <thead>
                                <tr>
                                  {detail.type === 'IPD' && <th>วันที่รายงาน</th>}
                                  <th>LAB Form</th>
                                  <th>รายการ LAB</th>
                                  <th>ผล LAB</th>
                                  <th>ค่าอ้างอิงปกติ</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.labs.map((lab, index) => (
                                  <tr key={index}>
                                    {detail.type === 'IPD' && <td className="nowrap">{lab.dateText}</td>}
                                    <td>{lab.formName}</td>
                                    <td className="text-bold">{lab.itemName}</td>
                                    <td className="lab-result-value">{lab.result}</td>
                                    <td>{lab.refValue || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="no-data-text">ไม่มีบันทึกรายงานผลแลป (LAB) ในการรับบริการนี้</p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={handleCloseDetail}>
                ปิดหน้าต่างรายละเอียด
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
