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
  Scale,
  Calendar,
  FileText,
  FolderOpen,
  Eye,
  Upload,
  ArrowUpRight
} from 'lucide-react';
import './page.css';

interface EthicsDocItem {
  id: number;
  yearId: number;
  parentId: number | null;
  title: string;
  filePath: string | null;
  fileSize: string | null;
  displayOrder: number;
  isActive: boolean;
}

interface EthicsYearItem {
  id: number;
  year: string;
  displayOrder: number;
  isActive: boolean;
  documents: EthicsDocItem[];
}

interface EthicsAdminClientProps {
  username: string;
  initialYears?: EthicsYearItem[];
}

export default function EthicsAdminClient({ username, initialYears = [] }: EthicsAdminClientProps) {
  // Sort initial years by latest first for tab display
  const sortedInitial = [...initialYears].sort((a, b) =>
    b.year.localeCompare(a.year, undefined, { numeric: true }) || b.displayOrder - a.displayOrder
  );

  const [years, setYears] = useState<EthicsYearItem[]>(sortedInitial);
  const [activeYearId, setActiveYearId] = useState<number | null>(
    sortedInitial.length > 0 ? sortedInitial[0].id : null
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);


  // Year Modal
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<EthicsYearItem | null>(null);
  const [yearForm, setYearForm] = useState({ year: '', displayOrder: 0, isActive: true });
  const [isSubmittingYear, setIsSubmittingYear] = useState(false);

  // Document Modal
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<EthicsDocItem | null>(null);
  const [parentForSubDoc, setParentForSubDoc] = useState<EthicsDocItem | null>(null);
  const [docForm, setDocForm] = useState<{
    title: string;
    displayOrder: number;
    isActive: boolean;
    file: File | null;
  }>({
    title: '',
    displayOrder: 0,
    isActive: true,
    file: null,
  });
  const [isSubmittingDoc, setIsSubmittingDoc] = useState(false);

  // Delete Modal
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'year' | 'doc';
    id: number;
    title: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchYears = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/member/ethics/years');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.years) {
          setYears(data.years);
          if (data.years.length > 0) {
            // Find the latest year (highest year string/displayOrder)
            const sortedByLatest = [...data.years].sort((a: EthicsYearItem, b: EthicsYearItem) =>
              b.year.localeCompare(a.year, undefined, { numeric: true }) || b.displayOrder - a.displayOrder
            );
            setActiveYearId((prev) => {
              if (prev && data.years.some((y: EthicsYearItem) => y.id === prev)) return prev;
              return sortedByLatest[0].id;
            });
          } else {
            setActiveYearId(null);
          }

        }
      }
    } catch (err: any) {
      notify(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchYears();
  }, []);

  const activeYear = years.find((y) => y.id === activeYearId);

  // Separate parent documents and children sub-documents for the active year (sorted by displayOrder asc)
  const parentDocuments = activeYear
    ? [...activeYear.documents.filter(d => !d.parentId)].sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)
    : [];
  const childDocuments = activeYear
    ? [...activeYear.documents.filter(d => d.parentId)].sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)
    : [];

  // Year Handlers
  const handleOpenCreateYear = () => {
    setEditingYear(null);
    const nextOrder = years.length > 0 ? Math.max(...years.map(y => y.displayOrder)) + 1 : 1;
    setYearForm({ year: '', displayOrder: nextOrder, isActive: true });
    setIsYearModalOpen(true);
  };

  const handleOpenEditYear = (y: EthicsYearItem) => {
    setEditingYear(y);
    setYearForm({ year: y.year, displayOrder: y.displayOrder, isActive: y.isActive });
    setIsYearModalOpen(true);
  };

  const handleSubmitYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingYear(true);
    try {
      const isEdit = Boolean(editingYear);
      const url = '/api/member/ethics/years';
      const method = isEdit ? 'PUT' : 'POST';
      const payload = isEdit ? { id: editingYear!.id, ...yearForm } : yearForm;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');

      notify(isEdit ? 'อัปเดตข้อมูลปีงบประมาณสำเร็จ' : 'เพิ่มปีงบประมาณสำเร็จ', 'success');
      setIsYearModalOpen(false);
      await fetchYears();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setIsSubmittingYear(false);
    }
  };

  // Document Handlers
  const handleOpenCreateDoc = (parentDoc: EthicsDocItem | null = null) => {
    setEditingDoc(null);
    setParentForSubDoc(parentDoc);
    const relevantDocs = parentDoc 
      ? childDocuments.filter(c => c.parentId === parentDoc.id)
      : parentDocuments;
    const nextOrder = relevantDocs.length > 0 ? Math.max(...relevantDocs.map(d => d.displayOrder)) + 1 : 1;

    setDocForm({
      title: '',
      displayOrder: nextOrder,
      isActive: true,
      file: null,
    });
    setIsDocModalOpen(true);
  };

  const handleOpenEditDoc = (doc: EthicsDocItem) => {
    setEditingDoc(doc);
    setParentForSubDoc(null);
    setDocForm({
      title: doc.title,
      displayOrder: doc.displayOrder,
      isActive: doc.isActive,
      file: null,
    });
    setIsDocModalOpen(true);
  };

  const handleSubmitDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeYearId) return;
    setIsSubmittingDoc(true);

    try {
      const isEdit = Boolean(editingDoc);
      const url = '/api/member/ethics/documents';
      const method = isEdit ? 'PUT' : 'POST';

      const formData = new FormData();
      if (isEdit) {
        formData.append('id', editingDoc!.id.toString());
      } else {
        formData.append('yearId', activeYearId.toString());
        if (parentForSubDoc) {
          formData.append('parentId', parentForSubDoc.id.toString());
        }
      }

      formData.append('title', docForm.title);
      formData.append('displayOrder', docForm.displayOrder.toString());
      formData.append('isActive', docForm.isActive ? 'true' : 'false');
      if (docForm.file) {
        formData.append('file', docForm.file);
      }

      const res = await fetch(url, {
        method,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการบันทึกเอกสาร');

      notify(isEdit ? 'อัปเดตเอกสารสำเร็จ' : 'เพิ่มเอกสารสำเร็จ', 'success');
      setIsDocModalOpen(false);
      await fetchYears();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setIsSubmittingDoc(false);
    }
  };

  // Delete Handler
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const url = deleteTarget.type === 'year'
        ? `/api/member/ethics/years?id=${deleteTarget.id}`
        : `/api/member/ethics/documents?id=${deleteTarget.id}`;

      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการลบ');

      notify('ลบข้อมูลสำเร็จ', 'success');
      setDeleteTarget(null);
      await fetchYears();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container adminEthicsPage">
      {/* Top Nav */}
      <div className="topNavHeader">
        <Link href="/member" className="backBtn">
          <ArrowLeft size={16} />
          <span>กลับสู่หน้าหลักสมาชิก</span>
        </Link>
        <div className="topNavActions">
          <Link
            href="/ethics"
            target="_blank"
            className="backBtn"
            style={{ color: '#4f46e5', borderColor: '#c7d2fe' }}
          >
            <Eye size={16} />
            <span>ดูหน้าชมรมจริยธรรมสาธารณะ</span>
          </Link>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="pageHeaderSection">
        <div className="pageHeaderInfo">
          <h1>
            <Scale size={28} />
            <span>จัดการเอกสารชมรมจริยธรรม</span>
          </h1>
          <p>
            เพิ่มปีงบประมาณ จัดการคำสั่ง แผนปฏิบัติการส่งเสริมคุณธรรม และอัปโหลดไฟล์ PDF รายงานผล
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleOpenCreateDoc(null)}
          className="btnPrimaryCreate"
          disabled={!activeYearId}
        >
          <Plus size={18} />
          <span>เพิ่มหัวข้อเอกสารใหม่</span>
        </button>
      </div>

      {/* Notification */}
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

      {/* Year Tabs */}
      <div className="adminYearTabs">
        {years.map((y) => (
          <button
            key={y.id}
            type="button"
            className={`adminYearTab ${activeYearId === y.id ? 'active' : ''}`}
            onClick={() => setActiveYearId(y.id)}
          >
            <Calendar size={15} />
            <span>ปีงบประมาณ {y.year}</span>
          </button>
        ))}
        <button type="button" onClick={handleOpenCreateYear} className="btnAddYear">
          <Plus size={15} />
          <span>เพิ่มปีงบประมาณ</span>
        </button>
      </div>

      {/* Main Container */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#6b7280' }}>
          <RefreshCw size={24} className="spinner" style={{ margin: '0 auto 12px', color: '#4f46e5' }} />
          <p>กำลังโหลดข้อมูล...</p>
        </div>
      ) : !activeYear ? (
        <div className="ethicsCardContainer" style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
          <p>ยังไม่มีปีงบประมาณในระบบ กรุณากด "เพิ่มปีงบประมาณ" เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="ethicsCardContainer">
          {/* Year Header Toolbar */}
          <div className="yearHeaderBar">
            <h3 className="yearHeaderTitle">
              <span>รายการเอกสาร ประจำปีงบประมาณ {activeYear.year}</span>
              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '999px', backgroundColor: activeYear.isActive ? '#dcfce7' : '#f3f4f6', color: activeYear.isActive ? '#15803d' : '#6b7280' }}>
                {activeYear.isActive ? 'เปิดใช้งาน' : 'ซ่อน'}
              </span>
            </h3>

            <div className="yearActions">
              <button
                type="button"
                onClick={() => handleOpenCreateDoc(null)}
                className="btnActionIcon"
                title="เพิ่มเอกสารในปีกรอบนี้"
              >
                <Plus size={16} />
              </button>
              <button
                type="button"
                onClick={() => handleOpenEditYear(activeYear)}
                className="btnActionIcon"
                title="แก้ไขข้อมูลปีงบประมาณ"
              >
                <Edit2 size={16} />
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget({ type: 'year', id: activeYear.id, title: `ปีงบประมาณ ${activeYear.year}` })}
                className="btnActionIcon delete"
                title="ลบปีงบประมาณนี้"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Document List */}
          {parentDocuments.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
              ยังไม่มีหัวข้อเอกสารสำหรับปีงบประมาณนี้ กดปุ่ม "เพิ่มหัวข้อเอกสารใหม่" เพื่อเริ่มสร้าง
            </div>
          ) : (
            <div className="docItemList">
              {parentDocuments.map((doc) => {
                const subDocs = childDocuments.filter(c => c.parentId === doc.id);
                return (
                  <div key={doc.id} className="docItemRow">
                    <div className="docItemMain">
                      <div className="docItemInfo">
                        <div className={doc.filePath ? "docIconBadge" : "docFolderBadge"}>
                          {doc.filePath ? <FileText size={18} /> : <FolderOpen size={18} />}
                        </div>
                        <div className="docTitleText">
                          <h4>{doc.title}</h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#6b7280' }}>
                            <span>ลำดับที่: {doc.displayOrder}</span>
                            {doc.filePath ? (
                              <a
                                href={doc.filePath}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#4f46e5', textDecoration: 'none' }}
                              >
                                <span>เปิดไฟล์ PDF</span>
                                <ArrowUpRight size={12} />
                              </a>
                            ) : (
                              <span style={{ color: '#d97706' }}>หมวดหมู่โฟลเดอร์ ({subDocs.length} ข้อย่อย)</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditDoc(doc)}
                          className="btnActionIcon"
                          title="แก้ไขเอกสาร"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ type: 'doc', id: doc.id, title: doc.title })}
                          className="btnActionIcon delete"
                          title="ลบเอกสาร"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Sub documents list */}
                    {subDocs.length > 0 && (
                      <div className="docSubList">
                        {subDocs.map((sub) => (
                          <div key={sub.id} className="docSubRow">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <FileText size={15} style={{ color: '#dc2626' }} />
                              <span style={{ fontSize: '0.85rem', color: '#374151' }}>{sub.title}</span>
                              {sub.filePath && (
                                <a
                                  href={sub.filePath}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: '#4f46e5', display: 'flex', alignItems: 'center' }}
                                >
                                  <ArrowUpRight size={12} />
                                </a>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenEditDoc(sub)}
                                className="btnActionIcon"
                                title="แก้ไขข้อย่อย"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget({ type: 'doc', id: sub.id, title: sub.title })}
                                className="btnActionIcon delete"
                                title="ลบข้อย่อย"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Sub-Doc Button if it's a folder or user wants to add nested items */}
                    <div style={{ marginTop: '8px', paddingLeft: '48px' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenCreateDoc(doc)}
                        className="btnAddSubDoc"
                      >
                        <Plus size={13} />
                        <span>เพิ่มข้อย่อยในหมวดนี้</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Year Modal */}
      {isYearModalOpen && (
        <div className="modalBackdrop">
          <div className="modalContent">
            <div className="modalHeader">
              <h2>
                <Calendar size={18} style={{ color: '#4f46e5' }} />
                <span>{editingYear ? 'แก้ไขปีงบประมาณ' : 'เพิ่มปีงบประมาณใหม่'}</span>
              </h2>
              <button type="button" onClick={() => setIsYearModalOpen(false)} className="closeBtn">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitYear}>
              <div className="modalBody">
                <div className="formGroup">
                  <label>ปีงบประมาณ (เช่น 2570) *</label>
                  <input
                    type="text"
                    className="formInput"
                    placeholder="2570"
                    value={yearForm.year}
                    onChange={(e) => setYearForm({ ...yearForm, year: e.target.value })}
                    required
                  />
                </div>
                <div className="formGroup">
                  <label>ลำดับแสดงผล (น้อยไปมาก)</label>
                  <input
                    type="number"
                    className="formInput"
                    value={yearForm.displayOrder}
                    onChange={(e) => setYearForm({ ...yearForm, displayOrder: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="formGroup">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="yearActiveCheck"
                      checked={yearForm.isActive}
                      onChange={(e) => setYearForm({ ...yearForm, isActive: e.target.checked })}
                      style={{ width: '18px', height: '18px', accentColor: '#4f46e5' }}
                    />
                    <label htmlFor="yearActiveCheck" style={{ margin: 0, cursor: 'pointer' }}>
                      เปิดแสดงผลหน้าสาธารณะ
                    </label>
                  </div>
                </div>
              </div>
              <div className="modalFooter">
                <button type="button" onClick={() => setIsYearModalOpen(false)} className="btn btn-outline">
                  ยกเลิก
                </button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#4f46e5', borderColor: '#4f46e5' }} disabled={isSubmittingYear}>
                  {isSubmittingYear ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Modal */}
      {isDocModalOpen && (
        <div className="modalBackdrop">
          <div className="modalContent">
            <div className="modalHeader">
              <h2>
                <FileText size={18} style={{ color: '#4f46e5' }} />
                <span>
                  {editingDoc
                    ? 'แก้ไขเอกสาร'
                    : parentForSubDoc
                    ? `เพิ่มข้อย่อยใน "${parentForSubDoc.title}"`
                    : 'เพิ่มหัวข้อเอกสารใหม่'}
                </span>
              </h2>
              <button type="button" onClick={() => setIsDocModalOpen(false)} className="closeBtn">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitDoc}>
              <div className="modalBody">
                <div className="formGroup">
                  <label>ชื่อเอกสาร / หัวข้อ *</label>
                  <input
                    type="text"
                    className="formInput"
                    placeholder="เช่น 1. คำสั่งคณะทำงานขับเคลื่อนชมรมจริยธรรม..."
                    value={docForm.title}
                    onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                    required
                  />
                </div>

                <div className="formGroup">
                  <label>อัปโหลดไฟล์ PDF (เว้นว่างไว้ได้หากเป็นหมวดโฟลเดอร์แม่)</label>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="formInput"
                    onChange={(e) => setDocForm({ ...docForm, file: e.target.files ? e.target.files[0] : null })}
                  />
                  {editingDoc?.filePath && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                      ไฟล์ปัจจุบัน: {editingDoc.filePath} (หากไม่ต้องการเปลี่ยนไฟล์ ไม่ต้องเลือกไฟล์ใหม่)
                    </p>
                  )}
                </div>

                <div className="formGroup">
                  <label>ลำดับแสดงผล (น้อยไปมาก)</label>
                  <input
                    type="number"
                    className="formInput"
                    value={docForm.displayOrder}
                    onChange={(e) => setDocForm({ ...docForm, displayOrder: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="formGroup">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="docActiveCheck"
                      checked={docForm.isActive}
                      onChange={(e) => setDocForm({ ...docForm, isActive: e.target.checked })}
                      style={{ width: '18px', height: '18px', accentColor: '#4f46e5' }}
                    />
                    <label htmlFor="docActiveCheck" style={{ margin: 0, cursor: 'pointer' }}>
                      เปิดแสดงผลหน้าสาธารณะ
                    </label>
                  </div>
                </div>
              </div>
              <div className="modalFooter">
                <button type="button" onClick={() => setIsDocModalOpen(false)} className="btn btn-outline">
                  ยกเลิก
                </button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#4f46e5', borderColor: '#4f46e5' }} disabled={isSubmittingDoc}>
                  {isSubmittingDoc ? 'กำลังบันทึก...' : 'บันทึกเอกสาร'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modalBackdrop">
          <div className="modalContent" style={{ maxWidth: '420px' }}>
            <div className="modalHeader" style={{ borderBottom: 'none' }}>
              <h2>
                <AlertCircle size={20} style={{ color: '#ef4444' }} />
                <span>ยืนยันการลบ</span>
              </h2>
              <button type="button" onClick={() => setDeleteTarget(null)} className="closeBtn">
                <X size={18} />
              </button>
            </div>
            <div className="modalBody" style={{ paddingTop: 0 }}>
              <p style={{ color: '#4b5563', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
                คุณแน่ใจหรือไม่ว่าต้องการลบ <strong>{deleteTarget.title}</strong>?
                {deleteTarget.type === 'year' && (
                  <span style={{ display: 'block', marginTop: '6px', color: '#dc2626', fontWeight: 600 }}>
                    * คำเตือน: เอกสารและไฟล์ทั้งหมดในปีนี้จะถูกลบออกไปด้วย
                  </span>
                )}
              </p>
            </div>
            <div className="modalFooter">
              <button type="button" onClick={() => setDeleteTarget(null)} className="btn btn-outline" disabled={isDeleting}>
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
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
