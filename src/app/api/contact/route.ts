import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { verifySession } from '@/lib/auth'
import { requireRole } from '@/lib/roles'
import { contactCreateSchema, contactUpdateSchema } from '@/lib/schemas/contact'
import { checkRateLimit } from '@/lib/rateLimit'

const CONTACTS_FILE = path.join(process.cwd(), 'contacts.json')

interface ContactItem {
  id: number
  name: string
  email: string
  phone: string | null
  message: string
  isRead: boolean
  createdAt: string
}

function readContacts(): ContactItem[] {
  try {
    if (!fs.existsSync(CONTACTS_FILE)) {
      // Write initial empty array
      fs.writeFileSync(CONTACTS_FILE, JSON.stringify([], null, 2), 'utf-8')
      return []
    }
    const data = fs.readFileSync(CONTACTS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading contacts file:', error)
    return []
  }
}

function writeContacts(contacts: ContactItem[]) {
  try {
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error writing contacts file:', error)
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === 'true'
    
    // Check session and role for admin view
    if (all) {
      const authResult = await requireRole(['admin'])
      if (authResult.error) return authResult.error
    }

    const contacts = readContacts()
    
    // Sort contacts by latest first
    const sortedContacts = [...contacts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json({ contacts: sortedContacts })
  } catch (error) {
    console.error('GET contacts error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการโหลดข้อความ' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const rateCheck = await checkRateLimit({ key: 'contact-form', maxAttempts: 5, windowSeconds: 900 })
    if (!rateCheck.allowed) return rateCheck.response!

    const body = await request.json()
    const { name, email, phone, message } = body

    const parsed = contactCreateSchema.safeParse({ name, email, phone, message })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const contacts = readContacts()
    const nextId = contacts.length > 0 ? Math.max(...contacts.map(c => c.id)) + 1 : 1

    const newContact: ContactItem = {
      id: nextId,
      name,
      email,
      phone: phone || null,
      message,
      isRead: false,
      createdAt: new Date().toISOString()
    }

    contacts.push(newContact)
    writeContacts(contacts)

    return NextResponse.json(
      { success: true, message: 'ส่งข้อความเรียบร้อยแล้ว', contact: newContact },
      { status: 201 }
    )
  } catch (error) {
    console.error('Contact submit error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการส่งข้อความ' },
      { status: 500 }
    )
  }
}

// PUT to mark as read or update status
export async function PUT(request: Request) {
  try {
    const authResult = await requireRole(['admin'])
    if (authResult.error) return authResult.error

    const body = await request.json()
    const { id, isRead } = body

    const parsed = contactUpdateSchema.safeParse({ id, isRead })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const contacts = readContacts()
    const contactIndex = contacts.findIndex(c => c.id === id)

    if (contactIndex === -1) {
      return NextResponse.json(
        { error: 'ไม่พบข้อความที่ต้องการแก้ไข' },
        { status: 404 }
      )
    }

    contacts[contactIndex].isRead = isRead !== undefined ? isRead : true
    writeContacts(contacts)

    return NextResponse.json({ success: true, contact: contacts[contactIndex] })
  } catch (error) {
    console.error('PUT contact error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการแก้ไขสถานะข้อความ' },
      { status: 500 }
    )
  }
}

// DELETE to remove a contact message
export async function DELETE(request: Request) {
  try {
    const authResult = await requireRole(['admin'])
    if (authResult.error) return authResult.error

    const { searchParams } = new URL(request.url)
    const idStr = searchParams.get('id')
    
    if (!idStr) {
      return NextResponse.json(
        { error: 'กรุณาระบุ ID ของข้อความที่ต้องการลบ' },
        { status: 400 }
      )
    }

    const id = parseInt(idStr)
    const contacts = readContacts()
    const updatedContacts = contacts.filter(c => c.id !== id)

    if (contacts.length === updatedContacts.length) {
      return NextResponse.json(
        { error: 'ไม่พบข้อความที่ต้องการลบ' },
        { status: 404 }
      )
    }

    writeContacts(updatedContacts)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE contact error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบข้อความ' },
      { status: 500 }
    )
  }
}
