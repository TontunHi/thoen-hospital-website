'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FileText, Calendar, ArrowUpRight, FolderOpen, Settings, RefreshCw } from 'lucide-react';
import './page.css';

interface SubDocumentItem {
  id: number;
  title: string;
  fileUrl: string;
  displayOrder: number;
}

interface DocumentItem {
  id: number;
  title: string;
  fileUrl?: string;
  displayOrder: number;
  subItems?: SubDocumentItem[];
}

interface YearItem {
  id: number;
  year: string;
  displayOrder: number;
  documents: DocumentItem[];
}

function EthicsPageContent() {
  const searchParams = useSearchParams();
  const yearParam = searchParams.get('year');
  const [yearsData, setYearsData] = useState<YearItem[]>([]);
  const [activeYear, setActiveYear] = useState<string>('');
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchEthics = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ethics');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.years) {
          setYearsData(data.years);
          setCanManage(Boolean(data.canManage));

          // Set default active year
          if (data.years.length > 0) {
            if (yearParam && data.years.some((y: YearItem) => y.year === yearParam)) {
              setActiveYear(yearParam);
            } else {
              setActiveYear(data.years[0].year);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load ethics documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEthics();
  }, []);

  useEffect(() => {
    if (yearParam && yearsData.some((y) => y.year === yearParam)) {
      setActiveYear(yearParam);
    }
  }, [yearParam, yearsData]);

  const currentYearItem = yearsData.find((y) => y.year === activeYear);
  const documents = currentYearItem ? currentYearItem.documents : [];

  return (
    <div className="ethics-page">
      <div className="container">
        
        {/* Ethics Header */}
        <div className="ethics-header">
          <h1 className="ethics-header__title">ชมรมจริยธรรม</h1>
          <p className="ethics-subtitle">
            ศูนย์รวมเอกสาร แผนการดำเนินงาน และคำสั่งคณะทำงานขับเคลื่อนชมรมจริยธรรม โรงพยาบาลเถิน
          </p>

          {canManage && (
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
              <Link
                href="/member/ethics"
                className="btn btn-outline"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 18px',
                  borderColor: '#4f46e5',
                  color: '#4338ca',
                  backgroundColor: '#eef2ff',
                  fontWeight: 600,
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  textDecoration: 'none'
                }}
              >
                <Settings size={16} />
                <span>จัดการเอกสารจริยธรรม ⚙️</span>
              </Link>
            </div>
          )}
        </div>

        {/* Loading state */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: '12px' }}>
            <RefreshCw size={28} className="spinner" style={{ color: '#4f46e5', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#6b7280', margin: 0 }}>กำลังโหลดข้อมูลเอกสาร...</p>
          </div>
        ) : yearsData.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#6b7280' }}>
            <p>ยังไม่มีข้อมูลเอกสารชมรมจริยธรรม</p>
          </div>
        ) : (
          <>
            {/* Year Selector tab controller */}
            <div className="ethics-year-selector-container">
              <div className="ethics-year-selector">
                {yearsData.map((y) => (
                  <button
                    key={y.id}
                    className={`year-tab ${activeYear === y.year ? 'active' : ''}`}
                    onClick={() => setActiveYear(y.year)}
                  >
                    <Calendar size={15} />
                    <span>ปีงบประมาณ {y.year}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content Area */}
            <div className="ethics-content">
              <h2 className="section-title">
                เอกสารจริยธรรม ประจำปีงบประมาณ {activeYear}
              </h2>

              {documents.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed #e5e7eb' }}>
                  ยังไม่มีรายการเอกสารสำหรับปีงบประมาณนี้
                </div>
              ) : (
                <div className="document-list">
                  {documents.map((item) => (
                    <div key={item.id} className={`document-card ${!item.fileUrl ? 'group-card' : ''}`}>
                      {item.fileUrl ? (
                        <div className="document-row">
                          <div className="document-info">
                            <span className="pdf-icon">
                              <FileText size={20} />
                            </span>
                            <div className="document-info__text">
                              <h3 className="document-title">{item.title}</h3>
                              <span className="pdf-badge">PDF Document</span>
                            </div>
                          </div>
                          <a
                            href={item.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="document-download-btn"
                          >
                            <span>เปิดดูเอกสาร</span>
                            <ArrowUpRight size={14} />
                          </a>
                        </div>
                      ) : (
                        <div className="document-group">
                          <div className="document-group-header">
                            <span className="group-folder-icon">
                              <FolderOpen size={20} />
                            </span>
                            <h3 className="document-group-title">{item.title}</h3>
                          </div>
                          {item.subItems && item.subItems.length > 0 && (
                            <div className="sub-document-list">
                              {item.subItems.map((sub) => (
                                <div key={sub.id} className="sub-document-row">
                                  <div className="document-info">
                                    <span className="pdf-icon sub-icon">
                                      <FileText size={14} />
                                    </span>
                                    <span className="sub-document-title">{sub.title}</span>
                                  </div>
                                  <a
                                    href={sub.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="sub-document-download-btn"
                                  >
                                    <span>เปิดดูเอกสาร</span>
                                    <ArrowUpRight size={12} />
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default function EthicsPage() {
  return (
    <Suspense fallback={<div className="ethics-page"><div className="container text-center">กำลังโหลด...</div></div>}>
      <EthicsPageContent />
    </Suspense>
  );
}

