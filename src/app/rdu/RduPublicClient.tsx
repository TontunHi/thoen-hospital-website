'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  FileText,
  FolderOpen,
  Download,
  ExternalLink,
  Calendar,
  Pill,
  ChevronRight,
  Sparkles,
  BookOpen
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

export default function RduPublicClient() {
  const searchParams = useSearchParams()
  const initialFolderParam = searchParams.get('folder')
  const initialFileParam = searchParams.get('file')

  const [folders, setFolders] = useState<RduFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null)
  const [selectedFile, setSelectedFile] = useState<RduFile | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/rdu')
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.folders.length > 0) {
            setFolders(data.folders)

            // Select folder from URL or default to first folder
            let defaultFolder = data.folders[0]
            if (initialFolderParam) {
              const matched = data.folders.find((f: RduFolder) => f.folder_name === initialFolderParam)
              if (matched) defaultFolder = matched
            }
            setActiveFolderId(defaultFolder.id)

            // Select file if provided in URL
            if (initialFileParam) {
              const foundFile = defaultFolder.files.find((f: RduFile) => f.display_name === initialFileParam || f.file_name === initialFileParam)
              if (foundFile) {
                setSelectedFile(foundFile)
              } else if (defaultFolder.files.length > 0) {
                setSelectedFile(defaultFolder.files[0])
              }
            } else if (defaultFolder.files.length > 0) {
              setSelectedFile(defaultFolder.files[0])
            }
          }
        }
      } catch (err) {
        console.error('Failed to load RDU data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [initialFolderParam, initialFileParam])

  const activeFolder = folders.find((f) => f.id === activeFolderId) || folders[0]

  const handleSelectFolder = (folder: RduFolder) => {
    setActiveFolderId(folder.id)
    if (folder.files.length > 0) {
      setSelectedFile(folder.files[0])
    } else {
      setSelectedFile(null)
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  if (loading) {
    return (
      <div className="rduPageLoading">
        <Pill className="animate-bounce" size={40} />
        <p>กำลังโหลดข้อมูลเอกสาร RDU...</p>
      </div>
    )
  }

  return (
    <div className="rdu-container">
      {/* Header section matching /ita style */}
      <div className="rdu-header animate-fade-in">
        <h1 className="rdu-header__title">Rational Drug Use (RDU)</h1>
        <p className="rdu-subtitle">
          ศูนย์รวมข้อมูล เอกสารคู่มือวิชาการ และข้อมูลความไวของเชื้อต่อยาต้านจุลชีพ (Antibiogram) โรงพยาบาลเถิน
        </p>
      </div>

      {folders.length === 0 ? (
        <div className="rduEmpty">
          <FolderOpen size={48} className="text-gray-400" />
          <h3>ยังไม่มีเอกสาร RDU ที่เผยแพร่ในขณะนี้</h3>
          <p>กรุณาตรวจสอบใหม่อีกครั้งในภายหลัง</p>
        </div>
      ) : (
        <div className="rduMainSection">
          {/* Year/Folder Tabs */}
          <div className="rduTabs">
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => handleSelectFolder(folder)}
                className={`rduTabBtn ${folder.id === activeFolder?.id ? 'active' : ''}`}
              >
                <FolderOpen size={18} />
                <span>{folder.folder_name}</span>
                <span className="tabBadge">{folder.files.length}</span>
              </button>
            ))}
          </div>

          {/* Body: Files List + Preview */}
          <div className="rduGrid">
            {/* Left Sidebar: File Cards */}
            <div className="rduFileListPanel">
              <h3 className="panelHeading">
                <BookOpen size={18} />
                <span>รายการเอกสารใน {activeFolder?.folder_name}</span>
              </h3>

              {activeFolder && activeFolder.files.length > 0 ? (
                <div className="rduFilesList">
                  {activeFolder.files.map((file) => {
                    const isSelected = selectedFile?.id === file.id
                    return (
                      <div
                        key={file.id}
                        onClick={() => setSelectedFile(file)}
                        className={`rduFileCard ${isSelected ? 'active' : ''}`}
                      >
                        <div className="rduFileCardIcon">
                          <FileText size={22} />
                        </div>
                        <div className="rduFileCardDetails">
                          <h4 className="fileTitle">{file.display_name}</h4>
                          <span className="fileMetaText">
                            PDF {file.file_size ? `• ${formatFileSize(file.file_size)}` : ''}
                          </span>
                        </div>
                        <ChevronRight size={18} className="chevron" />
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="emptyFilesAlert">ยังไม่มีไฟล์ในโฟลเดอร์นี้</div>
              )}
            </div>

            {/* Right Panel: PDF Viewer / Detail */}
            <div className="rduViewerPanel">
              {selectedFile ? (
                <div className="viewerWrapper">
                  <div className="viewerHeader">
                    <div className="viewerTitle">
                      <FileText size={20} className="text-rose-500" />
                      <div>
                        <h3>{selectedFile.display_name}</h3>
                        <span className="viewerSubtitle">{activeFolder.folder_name}</span>
                      </div>
                    </div>
                    <div className="viewerActions">
                      <a
                        href={selectedFile.file_path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btnViewAction"
                        title="เปิดในแท็บใหม่"
                      >
                        <ExternalLink size={16} />
                        <span>เปิดแท็บใหม่</span>
                      </a>
                      <a
                        href={selectedFile.file_path}
                        download
                        className="btnViewAction btnDownload"
                        title="ดาวน์โหลดไฟล์"
                      >
                        <Download size={16} />
                        <span>ดาวน์โหลด</span>
                      </a>
                    </div>
                  </div>

                  {/* Embed Iframe for PDF */}
                  <div className="viewerFrameContainer">
                    <iframe
                      src={`${selectedFile.file_path}#toolbar=1&navpanes=0`}
                      title={selectedFile.display_name}
                      className="pdfViewerFrame"
                    />
                  </div>
                </div>
              ) : (
                <div className="noFileSelected">
                  <FileText size={48} className="text-gray-300" />
                  <p>เลือกเอกสารจากรายการด้านซ้ายเพื่อเปิดอ่าน PDF</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
