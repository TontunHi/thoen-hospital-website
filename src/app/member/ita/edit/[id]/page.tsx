'use client'

import { useState, useRef, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Bold, Link as LinkIcon } from 'lucide-react'
import '../../page.css'

interface Props {
  params: Promise<{ id: string }>
}

export default function EditBlogPage(props: Props) {
  const params = use(props.params)
  const id = params.id

  const router = useRouter()
  const [title, setTitle] = useState('')
  const [fontSize, setFontSize] = useState(16)
  const [activeColor, setActiveColor] = useState('#000000')
  const [isBoldActive, setIsBoldActive] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const editorRef = useRef<HTMLDivElement>(null)
  const initialContentRef = useRef('')

  // Load existing blog details
  useEffect(() => {
    async function loadBlog() {
      try {
        const res = await fetch(`/api/ita/blogs/${id}`)
        const data = await res.json()
        if (data.success) {
          setTitle(data.data.title)
          initialContentRef.current = data.data.content
        } else {
          alert(data.error?.message || 'ไม่สามารถโหลดข้อมูลบทความได้')
          router.push('/member/ita')
        }
      } catch (e) {
        console.error('Fetch blog error:', e)
        alert('เกิดข้อผิดพลาดในการดึงข้อมูล')
        router.push('/member/ita')
      } finally {
        setIsLoading(false)
      }
    }

    loadBlog()
  }, [id, router])

  // Populate editor once loading is complete
  useEffect(() => {
    if (!isLoading && editorRef.current && initialContentRef.current) {
      editorRef.current.innerHTML = initialContentRef.current
    }
  }, [isLoading])

  // Setup styleWithCSS
  useEffect(() => {
    if (typeof document !== 'undefined') {
      try {
        document.execCommand('styleWithCSS', false, 'true')
      } catch (e) {}
    }
  }, [])

  const updateActiveState = () => {
    if (typeof document !== 'undefined') {
      setIsBoldActive(document.queryCommandState('bold'))
    }
  }

  const executeCommand = (command: string, value: string = '') => {
    if (typeof document !== 'undefined') {
      editorRef.current?.focus()
      document.execCommand(command, false, value)
      updateActiveState()
    }
  }

  const handleBold = () => {
    executeCommand('bold')
  }

  const handleAddLink = () => {
    const url = prompt('กรุณากรอกลิงก์ที่ต้องการแนบ (เช่น https://google.com):')
    if (url) {
      executeCommand('createLink', url)
    }
  }

  const changeFontSize = (direction: 'increase' | 'decrease') => {
    const step = 2
    let newSize = fontSize
    if (direction === 'increase' && fontSize < 48) {
      newSize = fontSize + step
    } else if (direction === 'decrease' && fontSize > 12) {
      newSize = fontSize - step
    }
    setFontSize(newSize)

    if (typeof window !== 'undefined') {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        if (!range.collapsed) {
          const span = document.createElement('span')
          span.style.fontSize = `${newSize}px`
          try {
            span.appendChild(range.extractContents())
            range.insertNode(span)
            selection.removeAllRanges()
            const newRange = document.createRange()
            newRange.selectNodeContents(span)
            selection.addRange(newRange)
          } catch (e) {
            console.error('Failed to apply font size:', e)
          }
        }
      }
    }
  }

  const handleColorChange = (color: string) => {
    setActiveColor(color)
    executeCommand('foreColor', color)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      alert('กรุณากรอกชื่อเรื่อง')
      return
    }

    const contentHtml = editorRef.current?.innerHTML || ''
    if (!contentHtml.trim() || contentHtml === '<br>') {
      alert('กรุณากรอกเนื้อหาบทความ')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/ita/blogs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content: contentHtml,
        }),
      })

      const data = await res.json()
      if (data.success) {
        alert('แก้ไขบทความสำเร็จ')
        router.push('/member/ita')
      } else {
        alert(data.error?.message || 'เกิดข้อผิดพลาดในการบันทึก')
      }
    } catch (error) {
      console.error('Save blog error:', error)
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setIsSubmitting(false)
    }
  }

  const colors = [
    { name: 'ดำ', value: '#000000' },
    { name: 'เขียวหลัก', value: '#0D7446' },
    { name: 'เขียวสว่าง', value: '#22C55E' },
    { name: 'ทอง', value: '#C8A835' },
    { name: 'น้ำเงิน', value: '#2563EB' },
    { name: 'ฟ้า', value: '#06B6D4' },
    { name: 'ม่วง', value: '#8B5CF6' },
    { name: 'ส้ม', value: '#F97316' },
    { name: 'แดง', value: '#DC2626' },
    { name: 'ชมพู', value: '#EC4899' },
    { name: 'เทา', value: '#64748B' },
  ]

  if (isLoading) {
    return (
      <div className="editor-page-container" style={{ textAlign: 'center', paddingTop: '8rem' }}>
        <p>กำลังโหลดข้อมูลบทความ...</p>
      </div>
    )
  }

  return (
    <div className="editor-page-container">
      <Link href="/member/ita" className="back-link">
        <ArrowLeft size={16} />
        <span>ย้อนกลับไปหน้ารายการ</span>
      </Link>

      <form onSubmit={handleSubmit} className="editor-form">
        <h1>แก้ไขบทความ (ITA)</h1>
        
        {/* Title Input */}
        <div className="form-group">
          <label className="form-label" htmlFor="blog-title">ชื่อเรื่องบทความ</label>
          <input
            id="blog-title"
            type="text"
            placeholder="พิมพ์ชื่อเรื่องที่นี่..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="title-input"
            required
            maxLength={255}
          />
        </div>

        {/* Content Rich Text Editor */}
        <div className="form-group">
          <label className="form-label">เนื้อหาบทความ</label>
          
          <div className="editor-wrapper">
            {/* Toolbar */}
            <div className="editor-toolbar">
              
              {/* Bold */}
              <button
                type="button"
                onClick={handleBold}
                className={`toolbar-btn ${isBoldActive ? 'active' : ''}`}
                title="ตัวหนา"
              >
                <Bold size={16} />
              </button>

              {/* Link */}
              <button
                type="button"
                onClick={handleAddLink}
                className="toolbar-btn"
                title="แนบลิงก์ (จะขีดเส้นใต้คำนั้นอัตโนมัติ)"
              >
                <LinkIcon size={16} />
              </button>

              <div className="toolbar-separator"></div>

              {/* Font Size controls */}
              <div className="font-size-control">
                <button
                  type="button"
                  onClick={() => changeFontSize('decrease')}
                  className="font-size-btn"
                  title="ลดขนาดตัวอักษร"
                >
                  -
                </button>
                <span className="font-size-display">{fontSize}px</span>
                <button
                  type="button"
                  onClick={() => changeFontSize('increase')}
                  className="font-size-btn"
                  title="เพิ่มขนาดตัวอักษร"
                >
                  +
                </button>
              </div>

              <div className="toolbar-separator"></div>

              {/* Color picker */}
              <div className="color-picker-wrapper">
                {colors.map((c) => (
                  <span
                    key={c.value}
                    onClick={() => handleColorChange(c.value)}
                    className={`color-dot ${activeColor === c.value ? 'active' : ''}`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>

            </div>

            {/* Editable Content Area */}
            <div
              ref={editorRef}
              className="rich-editor-content"
              contentEditable
              suppressContentEditableWarning
              data-placeholder="พิมพ์เนื้อหาข่าวหรือบทความของคุณที่นี่..."
              onKeyUp={updateActiveState}
              onMouseUp={updateActiveState}
              onSelect={updateActiveState}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="editor-actions">
          <Link href="/member/ita" className="btn-cancel">
            ยกเลิก
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-save-blog"
          >
            <Save size={18} />
            <span>{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
