'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  ExternalLink, 
  ArrowLeft, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  FileSpreadsheet,
  Eye,
  Check,
  Search
} from 'lucide-react';
import './page.css';

interface OutgoingDoc {
  id: number;
  year: string;
  label: string;
  note: string | null;
  url: string;
  status: string;
  displayOrder: number;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

interface OutgoingDocAdminClientProps {
  username: string;
}

export default function OutgoingDocAdminClient({ username }: OutgoingDocAdminClientProps) {
  const [documents, setDocuments] = useState<OutgoingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<OutgoingDoc | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirmation Modal State
  const [deletingDoc, setDeletingDoc] = useState<OutgoingDoc | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    year: '',
    label: '',
    note: '',
    url: '',
    status: 'เสร็จสิ้น',
    displayOrder: 0,
    isActive: true,
  });

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/member/outgoing-document');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDocuments(data.documents || []);
        }
      } else {
        const data = await res.json();
        notify(data.error || 'ไม่สามารถโหลดข้อมูลได้', 'error');
      }
    } catch (err: any) {
      notify(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const openCreateModal = () => {
    setEditingDoc(null);
    setFormData({
      year: '',
      label: '',
      note: '',
      url: '',
      status: 'เสร็จสิ้น',
      displayOrder: (documents.length > 0 ? Math.max(...documents.map(d => d.displayOrder)) + 1 : 1),
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (doc: OutgoingDoc) => {
    setEditingDoc(doc);
    setFormData({
      year: doc.year,
      label: doc.label,
      note: doc.note || '',
      url: doc.url,
      status: doc.status,
      displayOrder: doc.displayOrder,
      isActive: doc.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const isEdit = Boolean(editingDoc);
      const url = '/api/member/outgoing-document';
      const method = isEdit ? 'PUT' : 'POST';
      const payload = isEdit ? { id: editingDoc!.id, ...formData } : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการบันทึก');
      }

      notify(isEdit ? 'อัปเดตข้อมูลสำเร็จ' : 'เพิ่มลิงก์หนังสือส่งออกสำเร็จ', 'success');
      setIsModalOpen(false);
      fetchDocuments();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingDoc) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/member/outgoing-document?id=${deletingDoc.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการลบรายการ');
      }

      notify('ลบรายการหนังสือส่งออกสำเร็จ', 'success');
      setDeletingDoc(null);
      fetchDocuments();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

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
    <div className="container adminDocPage">
      {/* Top Navigation */}
      <div className="topNavHeader">
        <Link href="/member" className="backBtn">
          <ArrowLeft size={16} />
          <span>กลับสู่หน้าหลักสมาชิก</span>
        </Link>
        <div className="topNavActions">
          <Link
            href="/service/outgoing-document"
            target="_blank"
            className="backBtn"
            style={{ color: '#059669', borderColor: '#a7f3d0' }}
          >
            <Eye size={16} />
            <span>ดูหน้าบริการจริง</span>
          </Link>
        </div>
      </div>

      {/* Hero Header */}
      <div className="pageHeaderSection">
        <div className="pageHeaderInfo">
          <h1>
            <FileSpreadsheet size={28} />
            <span>จัดการระบบหนังสือส่งออก Online</span>
          </h1>
          <p>
            เพิ่ม แก้ไข และเรียงลำดับลิงก์ Google Sheets สำหรับลงทะเบียนหนังสือส่งออกทางราชการ
          </p>
        </div>
        <button type="button" onClick={openCreateModal} className="btnPrimaryCreate">
          <Plus size={18} />
          <span>เพิ่มลิงก์ Google Sheets ใหม่</span>
        </button>
      </div>

      {/* Floating Notification */}
      {message && (
        <div className={`alertNotification ${message.type}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <div className="tableContainerCard">
        <div className="tableHeaderToolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3>รายการลิงก์หนังสือส่งออกทั้งหมด</h3>
            <span className="itemCountBadge">{documents.length} รายการ</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', color: '#9ca3af' }} />
              <input
                type="text"
                placeholder="ค้นหา..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '6px 12px 6px 32px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
            </div>
            <button
              type="button"
              onClick={fetchDocuments}
              className="btnIconEdit"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={16} className={loading ? 'spinner' : ''} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
            <RefreshCw size={24} className="spinner" style={{ margin: '0 auto 12px', color: '#10b981' }} />
            <p style={{ margin: 0 }}>กำลังดึงข้อมูล...</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
            <p style={{ margin: 0 }}>ไม่พบรายการหนังสือส่งออก</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="docTable">
              <thead>
                <tr>
                  <th style={{ width: '60px', textAlign: 'center' }}>ลำดับ</th>
                  <th style={{ width: '100px' }}>ปีงบ</th>
                  <th>ชื่อแสดงผล</th>
                  <th>หมายเหตุ</th>
                  <th style={{ width: '100px' }}>สถานะ</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>แสดงผล</th>
                  <th>ลิงก์ Sheets</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc) => (
                  <tr key={doc.id}>
                    <td style={{ textAlign: 'center', color: '#9ca3af' }}>{doc.displayOrder}</td>
                    <td>
                      <span className="yearPill">{doc.year}</span>
                    </td>
                    <td>
                      <strong style={{ color: '#111827' }}>{doc.label}</strong>
                    </td>
                    <td style={{ color: '#6b7280' }}>{doc.note || '-'}</td>
                    <td>
                      <span className={`status-badge ${doc.status === 'ล่าสุด' ? 'latest' : 'archived'}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {doc.isActive ? (
                        <span style={{ color: '#059669', fontSize: '0.8rem', fontWeight: 600 }}>เปิด</span>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>ซ่อน</span>
                      )}
                    </td>
                    <td>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="urlTruncated"
                        title={doc.url}
                      >
                        {doc.url}
                      </a>
                    </td>
                    <td>
                      <div className="actionBtnGroup" style={{ justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openEditModal(doc)}
                          className="btnIconEdit"
                          title="แก้ไข"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingDoc(doc)}
                          className="btnIconDelete"
                          title="ลบ"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="modalBackdrop">
          <div className="modalContent">
            <div className="modalHeader">
              <h2>
                <FileSpreadsheet size={20} style={{ color: '#059669' }} />
                <span>{editingDoc ? 'แก้ไขข้อมูลหนังสือส่งออก' : 'เพิ่มลิงก์หนังสือส่งออกใหม่'}</span>
              </h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="closeBtn">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modalBody">
                <div className="formGrid">
                  <div className="formGroup">
                    <label>ปีงบประมาณ *</label>
                    <input
                      type="text"
                      className="formInput"
                      placeholder="เช่น 2570"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                      required
                    />
                  </div>

                  <div className="formGroup">
                    <label>ลำดับแสดงผล (น้อยไปมาก)</label>
                    <input
                      type="number"
                      className="formInput"
                      value={formData.displayOrder}
                      onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="formGroup fullWidth">
                  <label>ชื่อแสดงผล (หัวข้อการ์ด) *</label>
                  <input
                    type="text"
                    className="formInput"
                    placeholder="เช่น ปีงบประมาณ 2570"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    required
                  />
                </div>

                <div className="formGroup fullWidth">
                  <label>ลิงก์ Google Sheets (URL) *</label>
                  <input
                    type="url"
                    className="formInput"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    required
                  />
                </div>

                <div className="formGroup fullWidth">
                  <label>หมายเหตุ / วันที่เริ่มใช้งาน</label>
                  <input
                    type="text"
                    className="formInput"
                    placeholder="เช่น เริ่มใช้วันที่ 1 ตุลาคม 2569"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  />
                </div>

                <div className="formGrid">
                  <div className="formGroup">
                    <label>ป้ายสถานะ</label>
                    <select
                      className="formSelect"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="ล่าสุด">ล่าสุด</option>
                      <option value="เสร็จสิ้น">เสร็จสิ้น</option>
                      <option value="ร่าง">ร่าง</option>
                    </select>
                  </div>

                  <div className="formGroup">
                    <label>การเปิดให้เข้าถึง</label>
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id="isActiveCheck"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
                      />
                      <label htmlFor="isActiveCheck" style={{ margin: 0, cursor: 'pointer', fontSize: '0.85rem' }}>
                        เปิดใช้งาน (แสดงผลหน้าบริการ)
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modalFooter">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-outline"
                  disabled={isSubmitting}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#059669', borderColor: '#059669' }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={16} className="spinner" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <span>บันทึกข้อมูล</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingDoc && (
        <div className="modalBackdrop">
          <div className="modalContent" style={{ maxWidth: '440px' }}>
            <div className="modalHeader" style={{ borderBottom: 'none' }}>
              <h2>
                <AlertCircle size={22} style={{ color: '#ef4444' }} />
                <span>ยืนยันการลบรายการ</span>
              </h2>
              <button type="button" onClick={() => setDeletingDoc(null)} className="closeBtn">
                <X size={20} />
              </button>
            </div>
            <div className="modalBody" style={{ paddingTop: 0 }}>
              <p style={{ color: '#4b5563', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
                คุณแน่ใจหรือไม่ว่าต้องการลบลิงก์หนังสือส่งออก <strong>{deletingDoc.label}</strong> (ปี {deletingDoc.year})?
                การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </p>
            </div>
            <div className="modalFooter">
              <button
                type="button"
                onClick={() => setDeletingDoc(null)}
                className="btn btn-outline"
                disabled={isDeleting}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="btn btn-danger"
                style={{ backgroundColor: '#dc2626', borderColor: '#dc2626', color: '#ffffff' }}
                disabled={isDeleting}
              >
                {isDeleting ? 'กำลังลบ...' : 'ลบรายการนี้'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
