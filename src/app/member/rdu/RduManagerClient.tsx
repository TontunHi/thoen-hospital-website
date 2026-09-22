'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  FolderPlus,
  FileUp,
  Trash2,
  Edit2,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  FileText,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Folder,
  Loader2,
  Pill,
  Save,
  X
} from 'lucide-react'

interface RduFile {
  id: number
  folder_id: number
  display_name: string
  file_name: string
  file_path: string
  file_size: number | null
  display_order: number
}

interface RduFolder {
  id: number
  folder_name: string
  display_order: number
  is_active: number
  files: RduFile[]
}

interface Props {
  initialFolders: RduFolder[]
  userRole: string
}

export default function RduManagerClient({ initialFolders }: Props) {
  const [folders, setFolders] = useState<RduFolder[]>(initialFolders)
  const [newFolderName, setNewFolderName] = useState('')
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [editingFolderId, setEditingFolderId] = useState<number | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')

  // Uploading state: mapping folderId to boolean
  const [uploadingFolderId, setUploadingFolderId] = useState<number | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadDisplayName, setUploadDisplayName] = useState('')

  // Editing file state
  const [editingFileId, setEditingFileId] = useState<number | null>(null)
  const [editingFileName, setEditingFileName] = useState('')

  // Alert/toast message
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  // Refresh folders data from server
  const reloadData = async () => {
    try {
      const res = await fetch('/api/member/rdu/folders', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setFolders(data.folders)
        }
      }
    } catch (err) {
      console.error('Failed to reload RDU folders:', err)
    }
  }

  // Create Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) return

    setIsCreatingFolder(true)
    try {
      const res = await fetch('/api/member/rdu/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_name: newFolderName.trim() })
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดในการสร้างโฟลเดอร์')
      }

      notify('สร้างโฟลเดอร์สำเร็จ')
      setNewFolderName('')
      await reloadData()
    } catch (err: any) {
      notify(err.message, 'error')
    } finally {
      setIsCreatingFolder(false)
    }
  }

  // Edit Folder Name
  const handleSaveFolderName = async (folderId: number) => {
    if (!editingFolderName.trim()) return
    try {
      const res = await fetch('/api/member/rdu/folders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: folderId, folder_name: editingFolderName.trim() })
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'ไม่สามารถแก้ไขชื่อได้')

      notify('แก้ไขชื่อโฟลเดอร์เรียบร้อยแล้ว')
      setEditingFolderId(null)
      await reloadData()
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  // Delete Folder
  const handleDeleteFolder = async (folder: RduFolder) => {
    if (!confirm(`คุณต้องการลบโฟลเดอร์ "${folder.folder_name}" พร้อมไฟล์ทั้งหมดในโฟลเดอร์นี้หรือไม่?`)) return

    try {
      const res = await fetch(`/api/member/rdu/folders?id=${folder.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'ไม่สามารถลบโฟลเดอร์ได้')

      notify('ลบโฟลเดอร์เรียบร้อยแล้ว')
      await reloadData()
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  // Reorder Folders (Up/Down)
  const handleMoveFolder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= folders.length) return

    const newFolders = [...folders]
    const temp = newFolders[index]
    newFolders[index] = newFolders[targetIndex]
    newFolders[targetIndex] = temp

    // Reassign display_order
    const orders = newFolders.map((f, idx) => ({ id: f.id, display_order: idx }))
    setFolders(newFolders)

    try {
      await fetch('/api/member/rdu/folders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', orders })
      })
    } catch (err) {
      console.error('Failed to update folder order:', err)
      await reloadData()
    }
  }

  // Handle File Selection: Auto-clean name
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, folderId: number) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadFile(file)
    setUploadingFolderId(folderId)

    // Auto-clean name: Antibiogram_All.pdf -> Antibiogram All
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
    const cleanName = nameWithoutExt.replace(/[_\-]+/g, ' ').trim()
    setUploadDisplayName(cleanName)
  }

  // Submit File Upload
  const handleUploadSubmit = async (folderId: number) => {
    if (!uploadFile) return
    const formData = new FormData()
    formData.append('folder_id', String(folderId))
    formData.append('file', uploadFile)
    formData.append('display_name', uploadDisplayName)

    try {
      const res = await fetch('/api/member/rdu/files', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'ไม่สามารถอัปโหลดไฟล์ได้')

      notify('อัปโหลดไฟล์ PDF สำเร็จ')
      setUploadFile(null)
      setUploadingFolderId(null)
      setUploadDisplayName('')
      await reloadData()
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  // Edit File Display Name
  const handleSaveFileName = async (fileId: number) => {
    if (!editingFileName.trim()) return
    try {
      const res = await fetch('/api/member/rdu/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: fileId, display_name: editingFileName.trim() })
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'ไม่สามารถบันทึกชื่อไฟล์ได้')

      notify('แก้ไขชื่อไฟล์สำเร็จ')
      setEditingFileId(null)
      await reloadData()
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  // Delete File
  const handleDeleteFile = async (file: RduFile) => {
    if (!confirm(`คุณต้องการลบไฟล์ "${file.display_name}" หรือไม่?`)) return

    try {
      const res = await fetch(`/api/member/rdu/files?id=${file.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'ไม่สามารถลบไฟล์ได้')

      notify('ลบไฟล์เรียบร้อยแล้ว')
      await reloadData()
    } catch (err: any) {
      notify(err.message, 'error')
    }
  }

  // Move File (Up/Down) within folder
  const handleMoveFile = async (folder: RduFolder, fileIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? fileIndex - 1 : fileIndex + 1
    if (targetIndex < 0 || targetIndex >= folder.files.length) return

    const newFiles = [...folder.files]
    const temp = newFiles[fileIndex]
    newFiles[fileIndex] = newFiles[targetIndex]
    newFiles[targetIndex] = temp

    const updatedFolders = folders.map((f) => (f.id === folder.id ? { ...f, files: newFiles } : f))
    setFolders(updatedFolders)

    const orders = newFiles.map((file, idx) => ({ id: file.id, display_order: idx }))

    try {
      await fetch('/api/member/rdu/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', orders })
      })
    } catch (err) {
      console.error('Failed to update file order:', err)
      await reloadData()
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="rduManager">
      {/* Top Bar */}
      <div className="rduTopNav">
        <Link href="/member" className="backLink">
          <ArrowLeft size={16} />
          <span>กลับแดชบอร์ดสมาชิก</span>
        </Link>
        <Link href="/rdu" target="_blank" className="previewPageLink">
          <ExternalLink size={16} />
          <span>ดูหน้าเว็บเผยแพร่ (/rdu)</span>
        </Link>
      </div>

      {/* Header */}
      <div className="rduHeader">
        <div className="rduHeaderIcon">
          <Pill size={28} />
        </div>
        <div>
          <h1>จัดการเอกสาร RDU (Rational Drug Use)</h1>
          <p>สร้างโฟลเดอร์ปี/หมวดหมู่ และอัปโหลดไฟล์ PDF เพื่อนำเสนอข้อมูลบน Navbar และหน้าเว็บไซต์</p>
        </div>
      </div>

      {/* Notification Toast */}
      {message && (
        <div className={`notificationAlert ${message.type}`}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Create Folder Box */}
      <div className="createFolderCard">
        <div className="createFolderTitle">
          <FolderPlus size={20} className="text-teal-600" />
          <h3>สร้างโฟลเดอร์ใหม่ (เช่น RDU ปี 2569)</h3>
        </div>
        <form onSubmit={handleCreateFolder} className="createFolderForm">
          <input
            type="text"
            placeholder="ระบุชื่อโฟลเดอร์ เช่น RDU ปี 2569"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            className="folderInput"
          />
          <button type="submit" disabled={isCreatingFolder || !newFolderName.trim()} className="btnCreateFolder">
            {isCreatingFolder ? <Loader2 size={16} className="animate-spin" /> : <FolderPlus size={16} />}
            <span>สร้างโฟลเดอร์</span>
          </button>
        </form>
      </div>

      {/* Folders List */}
      <div className="foldersContainer">
        {folders.length === 0 ? (
          <div className="emptyFoldersState">
            <Folder size={48} className="emptyIcon" />
            <h4>ยังไม่มีโฟลเดอร์เอกสาร RDU</h4>
            <p>เริ่มต้นด้วยการพิมพ์ชื่อโฟลเดอร์ เช่น "RDU ปี 2569" แล้วกดสร้างโฟลเดอร์ด้านบน</p>
          </div>
        ) : (
          folders.map((folder, folderIdx) => (
            <div key={folder.id} className="folderCard">
              {/* Folder Header */}
              <div className="folderCardHeader">
                <div className="folderHeaderLeft">
                  <Folder size={22} className="folderIcon" />
                  {editingFolderId === folder.id ? (
                    <div className="folderEditRow">
                      <input
                        type="text"
                        value={editingFolderName}
                        onChange={(e) => setEditingFolderName(e.target.value)}
                        className="folderEditInput"
                        autoFocus
                      />
                      <button onClick={() => handleSaveFolderName(folder.id)} className="btnSaveSmall">
                        <Save size={14} />
                      </button>
                      <button onClick={() => setEditingFolderId(null)} className="btnCancelSmall">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="folderTitleRow">
                      <span className="folderName">{folder.folder_name}</span>
                      <span className="fileCountBadge">{folder.files.length} ไฟล์</span>
                    </div>
                  )}
                </div>

                <div className="folderActions">
                  <button
                    type="button"
                    onClick={() => handleMoveFolder(folderIdx, 'up')}
                    disabled={folderIdx === 0}
                    className="btnIconAction"
                    title="เลื่อนขึ้น"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveFolder(folderIdx, 'down')}
                    disabled={folderIdx === folders.length - 1}
                    className="btnIconAction"
                    title="เลื่อนลง"
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFolderId(folder.id)
                      setEditingFolderName(folder.folder_name)
                    }}
                    className="btnIconAction"
                    title="แก้ไขชื่อโฟลเดอร์"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteFolder(folder)}
                    className="btnIconAction btnDelete"
                    title="ลบโฟลเดอร์"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Upload Zone */}
              <div className="uploadZone">
                {uploadingFolderId === folder.id && uploadFile ? (
                  <div className="uploadPreviewBox">
                    <div className="uploadFileInfo">
                      <FileText size={20} className="text-teal-600" />
                      <div className="uploadFileMeta">
                        <span className="fileNameLabel">ไฟล์ที่เลือก: {uploadFile.name}</span>
                        <input
                          type="text"
                          value={uploadDisplayName}
                          onChange={(e) => setUploadDisplayName(e.target.value)}
                          placeholder="ชื่อแสดงผลบนเว็บไซต์"
                          className="displayNameInput"
                        />
                      </div>
                    </div>
                    <div className="uploadActionBtns">
                      <button
                        type="button"
                        onClick={() => handleUploadSubmit(folder.id)}
                        className="btnConfirmUpload"
                      >
                        <FileUp size={14} />
                        <span>ยืนยันอัปโหลด</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadFile(null)
                          setUploadingFolderId(null)
                        }}
                        className="btnCancelUpload"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="uploadButtonLabel">
                    <FileUp size={16} />
                    <span>อัปโหลดไฟล์ PDF ลงโฟลเดอร์นี้</span>
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(e) => handleFileSelect(e, folder.id)}
                      className="hiddenFileInput"
                    />
                  </label>
                )}
              </div>

              {/* Files List in this Folder */}
              {folder.files.length > 0 ? (
                <div className="filesList">
                  {folder.files.map((file, fileIdx) => (
                    <div key={file.id} className="fileItemRow">
                      <div className="fileItemLeft">
                        <FileText size={18} className="fileIcon" />
                        {editingFileId === file.id ? (
                          <div className="fileEditRow">
                            <input
                              type="text"
                              value={editingFileName}
                              onChange={(e) => setEditingFileName(e.target.value)}
                              className="fileEditInput"
                              autoFocus
                            />
                            <button onClick={() => handleSaveFileName(file.id)} className="btnSaveSmall">
                              <Save size={14} />
                            </button>
                            <button onClick={() => setEditingFileId(null)} className="btnCancelSmall">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="fileMetaDetails">
                            <a
                              href={file.file_path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="fileDisplayName"
                              title="คลิกเพื่อเปิดอ่าน PDF"
                            >
                              {file.display_name}
                              <ExternalLink size={12} className="linkArrowIcon" />
                            </a>
                            <span className="fileSubMeta">
                              ({file.file_name} {file.file_size ? `• ${formatFileSize(file.file_size)}` : ''})
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="fileActions">
                        <button
                          type="button"
                          onClick={() => handleMoveFile(folder, fileIdx, 'up')}
                          disabled={fileIdx === 0}
                          className="btnIconSmall"
                          title="เลื่อนขึ้น"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveFile(folder, fileIdx, 'down')}
                          disabled={fileIdx === folder.files.length - 1}
                          className="btnIconSmall"
                          title="เลื่อนลง"
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFileId(file.id)
                            setEditingFileName(file.display_name)
                          }}
                          className="btnIconSmall"
                          title="แก้ไขชื่อแสดงผล"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFile(file)}
                          className="btnIconSmall btnDeleteSmall"
                          title="ลบไฟล์"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="emptyFilesState">ยังไม่มีไฟล์ PDF ในโฟลเดอร์นี้</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
