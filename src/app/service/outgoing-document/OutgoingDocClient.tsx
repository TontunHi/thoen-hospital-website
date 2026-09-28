'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Settings, RefreshCw, ExternalLink, Search } from 'lucide-react';
import './page.css';

interface OutgoingDocItem {
  id: number;
  year: string;
  label: string;
  note: string | null;
  url: string;
  status: string;
  displayOrder: number;
}

export default function OutgoingDocClient() {
  const [documents, setDocuments] = useState<OutgoingDocItem[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/service/outgoing-document');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDocuments(data.documents || []);
          setCanManage(Boolean(data.canManage));
        }
      }
    } catch (err) {
      console.error('Failed to load outgoing documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const filteredDocs = documents.filter((doc) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      doc.label.toLowerCase().includes(q) ||
      doc.year.toLowerCase().includes(q) ||
      (doc.note && doc.note.toLowerCase().includes(q))
    );
  });

  return (
    <div className="container outgoing-doc-page">
      {/* Header section */}
      <div className="doc-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '2rem' }}>📑</span>
          <h1 style={{ margin: 0 }}>ระบบลงทะเบียนหนังสือส่งออก Online</h1>
        </div>
        <p className="doc-subtitle">
          สืบค้นประวัติและลงทะเบียนหนังสือส่งออกราชการของโรงพยาบาลเถิน แยกตามปีงบประมาณผ่านระบบออนไลน์
        </p>

        {canManage && (
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
            <Link
              href="/member/outgoing-document"
              className="btn btn-outline"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderColor: '#10b981',
                color: '#059669',
                backgroundColor: '#ecfdf5',
                fontWeight: 600,
                borderRadius: '8px',
                fontSize: '0.9rem',
                textDecoration: 'none'
              }}
            >
              <Settings size={16} />
              <span>จัดการลิงก์ Sheet ⚙️</span>
            </Link>
          </div>
        )}
      </div>

      {/* Control / Search Panel */}
      <div className="doc-control-panel card">
        <div className="doc-search-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <Search size={18} style={{ color: '#9ca3af' }} />
          <input
            type="text"
            className="doc-search-input"
            placeholder="ค้นหาตามปีงบประมาณหรือหมายเหตุ (เช่น 2569, ล่าสุด)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {searchQuery && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setSearchQuery('')}
            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
          >
            ล้างค้นหา
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: '12px' }}>
          <RefreshCw size={28} className="spinner" style={{ color: '#10b981', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#6b7280', margin: 0 }}>กำลังโหลดรายการหนังสือส่งออก...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="no-docs-found card">
          <p className="no-docs-text">ไม่พบรายการหนังสือส่งออกที่ค้นหา</p>
        </div>
      ) : (
        /* Grid List */
        <div className="doc-grid">
          {filteredDocs.map((doc) => (
            <div key={doc.id} className="doc-card card">
              <div className="doc-card-header">
                <div className="sheet-icon-wrapper">
                  📊
                </div>
                <div className="doc-card-info">
                  <h3>{doc.label}</h3>
                  <span className={`status-badge ${doc.status === 'ล่าสุด' ? 'latest' : 'archived'}`}>
                    {doc.status}
                  </span>
                </div>
              </div>
              <div className="doc-card-body">
                <p className="doc-note">{doc.note || '\u00A0'}</p>
              </div>
              <div className="doc-card-actions">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`btn ${doc.status === 'ล่าสุด' ? 'btn-primary' : 'btn-outline'} btn-block`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <span>เปิด Google Sheets</span>
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

