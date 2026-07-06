'use client'

import { useState, useEffect } from 'react'
import { Mail, MailOpen, Trash2, Eye, Calendar, User, Phone, X, Filter } from 'lucide-react'
import './page.css'

interface ContactItem {
  id: number
  name: string
  email: string
  phone: string | null
  message: string
  isRead: boolean
  createdAt: string
}

export default function AdminContactsPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL')
  const [selectedContact, setSelectedContact] = useState<ContactItem | null>(null)

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/contact?all=true')
      const data = await res.json()
      if (Array.isArray(data.contacts)) {
        setContacts(data.contacts)
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContacts()
  }, [])

  const handleMarkAsRead = async (id: number, currentReadState: boolean) => {
    try {
      const res = await fetch('/api/contact', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isRead: !currentReadState }),
      })
      if (res.ok) {
        setContacts(
          contacts.map((c) => (c.id === id ? { ...c, isRead: !currentReadState } : c))
        )
        if (selectedContact && selectedContact.id === id) {
          setSelectedContact({ ...selectedContact, isRead: !currentReadState })
        }
      }
    } catch (error) {
      console.error('Failed to update read state:', error)
    }
  }

  const handleViewDetails = async (contact: ContactItem) => {
    setSelectedContact(contact)
    if (!contact.isRead) {
      // Automatically mark as read when viewed
      await handleMarkAsRead(contact.id, false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`ต้องการลบข้อความของ "${name}" หรือไม่?`)) return

    try {
      const res = await fetch(`/api/contact?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setContacts(contacts.filter((c) => c.id !== id))
        if (selectedContact && selectedContact.id === id) {
          setSelectedContact(null)
        }
      } else {
        alert('เกิดข้อผิดพลาดในการลบข้อความ')
      }
    } catch {
      alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    }
  }

  const filteredContacts = contacts.filter((c) => {
    if (filter === 'UNREAD') return !c.isRead
    if (filter === 'READ') return c.isRead
    return true
  })

  if (loading) {
    return (
      <div className="loadingState">
        <div className="spinner" />
        <p>กำลังโหลดข้อความติดต่อ...</p>
      </div>
    )
  }

  return (
    <div className="contactsAdminPage">
      <div className="pageHeader">
        <div>
          <h1>ข้อความติดต่อสอบถาม</h1>
          <p className="subtext">จัดการและอ่านข้อความที่ผู้ใช้บริการส่งติดต่อสอบถามผ่านหน้าเว็บไซต์โรงพยาบาลเถิน</p>
        </div>
        
        {/* Filter buttons */}
        <div className="filterToolbar">
          <div className="filterSelectWrapper">
            <Filter size={14} className="filterSelectIcon" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="filterSelect"
            >
              <option value="ALL">ข้อความทั้งหมด ({contacts.length})</option>
              <option value="UNREAD">ยังไม่อ่าน ({contacts.filter((c) => !c.isRead).length})</option>
              <option value="READ">อ่านแล้ว ({contacts.filter((c) => c.isRead).length})</option>
            </select>
          </div>
        </div>
      </div>

      <div className="tableContainer card">
        {filteredContacts.length > 0 ? (
          <div className="tableResponsive">
            <table className="contactsTable">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>ID</th>
                  <th>ผู้ส่งข้อความ</th>
                  <th>ข้อมูลติดต่อ</th>
                  <th>ข้อความย่อ</th>
                  <th style={{ width: '130px' }}>สถานะ</th>
                  <th style={{ width: '160px' }}>วันที่ส่ง</th>
                  <th style={{ width: '185px', textAlign: 'center' }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className={`contactRow ${contact.isRead ? 'readRow' : 'unreadRow'}`}
                  >
                    <td className="idCell">{contact.id}</td>
                    <td className="senderCell">
                      <div className="senderName">{contact.name}</div>
                    </td>
                    <td className="contactInfoCell">
                      <div className="emailText">{contact.email}</div>
                      {contact.phone && <div className="phoneText">{contact.phone}</div>}
                    </td>
                    <td className="messageCell" title={contact.message}>
                      {contact.message}
                    </td>
                    <td>
                      <span className={`statusBadge ${contact.isRead ? 'badgeRead' : 'badgeUnread'}`}>
                        {contact.isRead ? (
                          <>
                            <MailOpen size={12} style={{ marginRight: '4px' }} />
                            อ่านแล้ว
                          </>
                        ) : (
                          <>
                            <Mail size={12} style={{ marginRight: '4px' }} />
                            ยังไม่อ่าน
                          </>
                        )}
                      </span>
                    </td>
                    <td className="dateCell">
                      {new Date(contact.createdAt).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })} น.
                    </td>
                    <td>
                      <div className="actionButtons">
                        <button
                          onClick={() => handleViewDetails(contact)}
                          className="viewBtn"
                          title="ดูข้อความ"
                        >
                          <Eye size={14} />
                          <span>ดู</span>
                        </button>
                        <button
                          onClick={() => handleMarkAsRead(contact.id, contact.isRead)}
                          className="toggleReadBtn"
                          title={contact.isRead ? 'ทำเป็นยังไม่อ่าน' : 'ทำเป็นอ่านแล้ว'}
                        >
                          {contact.isRead ? <Mail size={14} /> : <MailOpen size={14} />}
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id, contact.name)}
                          className="deleteBtn"
                          title="ลบข้อความ"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptyState">
            <p>ไม่มีข้อความติดต่อสอบถามตามเงื่อนไขที่เลือก</p>
          </div>
        )}
      </div>

      {/* Modern Modal details popup */}
      {selectedContact && (
        <div 
          className="modalOverlay" 
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedContact(null)
          }}
          role="button"
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
              setSelectedContact(null)
            }
          }}
        >
          <div className="modalContent">
            <div className="modalHeader">
              <h2>รายละเอียดข้อความติดต่อ #{selectedContact.id}</h2>
              <button className="closeBtn" onClick={() => setSelectedContact(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modalBody">
              <div className="metaGrid">
                <div className="metaItem">
                  <User size={16} className="metaIcon" />
                  <div>
                    <label>ผู้ส่งข้อความ</label>
                    <p>{selectedContact.name}</p>
                  </div>
                </div>
                <div className="metaItem">
                  <Mail size={16} className="metaIcon" />
                  <div>
                    <label>อีเมล</label>
                    <p><a href={`mailto:${selectedContact.email}`}>{selectedContact.email}</a></p>
                  </div>
                </div>
                {selectedContact.phone && (
                  <div className="metaItem">
                    <Phone size={16} className="metaIcon" />
                    <div>
                      <label>เบอร์โทรศัพท์</label>
                      <p><a href={`tel:${selectedContact.phone}`}>{selectedContact.phone}</a></p>
                    </div>
                  </div>
                )}
                <div className="metaItem">
                  <Calendar size={16} className="metaIcon" />
                  <div>
                    <label>วันที่ส่งข้อความ</label>
                    <p>
                      {new Date(selectedContact.createdAt).toLocaleString('th-TH', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })} น.
                    </p>
                  </div>
                </div>
              </div>

              <div className="messageSection">
                <label>เนื้อหาข้อความ</label>
                <div className="messageBodyText">{selectedContact.message}</div>
              </div>
            </div>
            <div className="modalFooter">
              <button
                onClick={() => handleMarkAsRead(selectedContact.id, selectedContact.isRead)}
                className="modalSecondaryBtn"
              >
                {selectedContact.isRead ? 'ทำเป็นยังไม่อ่าน' : 'ทำเป็นอ่านแล้ว'}
              </button>
              <button
                onClick={() => handleDelete(selectedContact.id, selectedContact.name)}
                className="modalDangerBtn"
              >
                ลบข้อความนี้
              </button>
              <button className="modalPrimaryBtn" onClick={() => setSelectedContact(null)}>
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
