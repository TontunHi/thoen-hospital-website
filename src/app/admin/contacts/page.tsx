'use client'

import { useState, useEffect } from 'react'
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

  useEffect(() => {
    async function fetchContacts() {
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

    fetchContacts()
  }, [])

  if (loading) {
    return <div className="loadingState">กำลังโหลดข้อมูล...</div>
  }

  return (
    <div className="contactsAdminPage">
      <h1>✉️ ข้อความติดต่อ</h1>

      <div className="tableContainer">
        {contacts.length > 0 ? (
          <table className="contactsTable">
            <thead>
              <tr>
                <th>ID</th>
                <th>ชื่อ</th>
                <th>อีเมล</th>
                <th>โทรศัพท์</th>
                <th>ข้อความ</th>
                <th>สถานะ</th>
                <th>วันที่</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className={contact.isRead ? '' : 'unreadRow'}
                >
                  <td>{contact.id}</td>
                  <td>{contact.name}</td>
                  <td>{contact.email}</td>
                  <td>{contact.phone || '-'}</td>
                  <td className="messageCell" title={contact.message}>
                    {contact.message}
                  </td>
                  <td>
                    <span
                      className={
                        contact.isRead ? 'readBadge' : 'unreadBadge'
                      }
                    >
                      {contact.isRead ? 'อ่านแล้ว' : 'ยังไม่อ่าน'}
                    </span>
                  </td>
                  <td>
                    {new Date(contact.createdAt).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="emptyState">ยังไม่มีข้อความติดต่อ</div>
        )}
      </div>
    </div>
  )
}
