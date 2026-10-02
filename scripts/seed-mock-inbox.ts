import 'dotenv/config'
import { queryMemberDb } from '../src/lib/memberDb'
import crypto from 'crypto'

async function seedMockInbox() {
  try {
    console.log('--- Starting Inbox Mock Data Seeding ---')

    // 1. Get existing admin or first member
    const members = await queryMemberDb('SELECT id, username, name, department, position, role FROM members LIMIT 5')
    if (!members || members.length === 0) {
      console.error('No member found in database')
      return
    }

    const currentMember = members[0]
    const memberId = currentMember.id
    const memberName = currentMember.name || 'เจ้าหน้าที่โรงพยาบาลเถิน'
    const dept = currentMember.department || 'ศูนย์คอมพิวเตอร์และสารสนเทศ'

    console.log(`Using member: ID ${memberId}, Name: ${memberName}, Dept: ${dept}`)

    // 2. Define 6 Mock Tasks across ALL categories
    const mockTasks = [
      {
        taskType: 'IT_REPAIR',
        taskNo: 'IT-6910-0001',
        title: 'แจ้งซ่อม: เครื่องคอมพิวเตอร์ All-in-One Dell (7440-001-0023/65) - เปิดไม่ติด มีเสียง Beep Code',
        description: 'เครื่องคอมพิวเตอร์ที่โต๊ะพยาบาลคัดกรองเปิดเครื่องไม่ติด มีไฟกระพริบสีส้มและเสียงเตือน 3 ครั้ง ขอให้ทีมไอทีเข้าตรวจสอบด่วนเนื่องจากมีผู้ป่วยรอคัดกรองจำนวนมาก',
        urgency: 'VERY_URGENT',
        status: 'PENDING',
        currentRole: 'นักวิชาการคอมพิวเตอร์',
        customPayload: {
          itemCategory: 'EQUIPMENT',
          itemName: 'คอมพิวเตอร์ All-in-One Dell OptiPlex (7440-001-0023/65)',
          locationFullName: 'อาคารผู้ป่วยนอก (OPD) ชั้น 1 แผนกคัดกรองผู้ป่วย',
        },
        steps: [
          { stepNo: 1, stepName: 'ช่างรับงานและดำเนินการซ่อม', role: 'นักวิชาการคอมพิวเตอร์', status: 'PENDING' },
        ],
        repairDetail: {
          repairType: 'IT_REPAIR',
          itemCategory: 'EQUIPMENT',
          equipmentNumber: '7440-001-0023/65',
          equipmentName: 'คอมพิวเตอร์ All-in-One Dell OptiPlex',
          locationFullName: 'อาคารผู้ป่วยนอก (OPD) ชั้น 1 แผนกคัดกรองผู้ป่วย',
          symptomDetail: 'เครื่องคอมพิวเตอร์ที่โต๊ะพยาบาลคัดกรองเปิดเครื่องไม่ติด มีไฟกระพริบสีส้มและเสียงเตือน 3 ครั้ง',
        },
      },
      {
        taskType: 'GENERAL_REPAIR',
        taskNo: 'GN-6910-0002',
        title: 'แจ้งซ่อม: เครื่องปรับอากาศ Daikin แอร์ไม่เย็น น้ำหยดลงพื้น - ห้องตรวจแพทย์ OPD 2',
        description: 'แอร์มีน้ำหยดลงบนโต๊ะตรวจและพื้นห้องตรวจ มีกลิ่นอับและไม่เย็น ขอความอนุเคราะห์ทีมช่างซ่อมบำรุงเข้าล้างแอร์และเป่าท่อน้ำทิ้ง',
        urgency: 'NORMAL',
        status: 'PENDING',
        currentRole: 'นายช่างเทคนิค',
        customPayload: {
          itemCategory: 'NON_EQUIPMENT',
          itemName: 'เครื่องปรับอากาศ Daikin Wall Type',
          locationFullName: 'อาคารผู้ป่วยนอก (OPD) ชั้น 2 ห้องตรวจแพทย์ 2',
        },
        steps: [
          { stepNo: 1, stepName: 'ช่างรับงานและดำเนินการซ่อม', role: 'นายช่างเทคนิค', status: 'PENDING' },
        ],
        repairDetail: {
          repairType: 'GENERAL_REPAIR',
          itemCategory: 'NON_EQUIPMENT',
          nonEquipmentItem: 'เครื่องปรับอากาศ Daikin Wall Type',
          locationFullName: 'อาคารผู้ป่วยนอก (OPD) ชั้น 2 ห้องตรวจแพทย์ 2',
          symptomDetail: 'แอร์มีน้ำหยดลงบนโต๊ะตรวจและพื้นห้องตรวจ มีกลิ่นอับและไม่เย็น',
        },
      },
      {
        taskType: 'MEDICAL_REPAIR',
        taskNo: 'MED-6910-0003',
        title: 'แจ้งซ่อม: เครื่องตรวจคลื่นไฟฟ้าหัวใจ EKG 12-Lead - สายสัญญาณ Lead II สัญญาณรบกวนสูง/ขาดใน',
        description: 'เครื่องตรวจคลื่นหัวใจ EKG ประจำตึกอุบัติเหตุ สาย Lead II ขาดหลุดทำให้กราฟหัวใจมี Artifact สัญญาณไม่เสถียร ขอทีมวิศวกรรมชีวการแพทย์เปลี่ยนสายสัญญาณ',
        urgency: 'URGENT',
        status: 'PENDING',
        currentRole: 'นักวิทยาศาสตร์การแพทย์',
        customPayload: {
          itemCategory: 'EQUIPMENT',
          itemName: 'เครื่องตรวจคลื่นไฟฟ้าหัวใจ EKG 12-Lead Nihon Kohden (MED-65-0042)',
          locationFullName: 'อาคารอุบัติเหตุและฉุกเฉิน (ER) ชั้น 1 ห้องกู้ชีพ (Resuscitation Room)',
        },
        steps: [
          { stepNo: 1, stepName: 'ช่างรับงานและดำเนินการซ่อม', role: 'นักวิทยาศาสตร์การแพทย์', status: 'PENDING' },
        ],
        repairDetail: {
          repairType: 'MEDICAL_REPAIR',
          itemCategory: 'EQUIPMENT',
          equipmentNumber: 'MED-65-0042',
          equipmentName: 'เครื่องตรวจคลื่นไฟฟ้าหัวใจ EKG 12-Lead Nihon Kohden',
          locationFullName: 'อาคารอุบัติเหตุและฉุกเฉิน (ER) ชั้น 1 ห้องกู้ชีพ (Resuscitation Room)',
          symptomDetail: 'สาย Lead II ขาดหลุดทำให้กราฟหัวใจมี Artifact สัญญาณไม่เสถียร',
        },
      },
      {
        taskType: 'MEDIA_REQUEST',
        taskNo: 'PR-6910-0004',
        title: 'ขอสื่อประชาสัมพันธ์: ป้ายไวนิลและ Infographic สัปดาห์ส่งเสริมสุขภาพและป้องกันโรค NCDs',
        description: 'ขอความอนุเคราะห์กลุ่มงานดิจิทัลฯ ออกแบบและจัดทำป้าย Roll-up ไวนิลขนาด 80x200cm จำนวน 2 ชุด และ Infographic สำหรับเผยแพร่ผ่าน Facebook Page โรงพยาบาลเถิน',
        urgency: 'NORMAL',
        status: 'PENDING',
        currentRole: 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์',
        customPayload: {
          costType: 'NO_COST',
          deliveryDate: '20 ต.ค. 2569',
          mediaCategories: ['INFOGRAPHIC', 'BANNER_VINYL'],
          objective: 'รณรงค์ตรวจคัดกรองเบาหวานและความดันโลหิตสูงแก่ประชาชน',
        },
        steps: [
          { stepNo: 1, stepName: 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์ ตรวจสอบและมอบหมายงาน', role: 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์', status: 'PENDING' },
          { stepNo: 2, stepName: 'นักประชาสัมพันธ์ ดำเนินการออกแบบสื่อและจัดทำ', role: 'นักประชาสัมพันธ์', status: 'WAITING' },
        ],
      },
      {
        taskType: 'ROOM_BOOKING',
        taskNo: 'RM-6910-0005',
        title: 'ขอใช้ห้องประชุม: ห้องประชุมราชพฤกษ์ ชั้น 3 สำหรับอบรมพัฒนาศักยภาพบุคลากร (CPR & First Aid)',
        description: 'ขอใช้ห้องประชุมราชพฤกษ์ วันที่ 25 ต.ค. 2569 เวลา 08:30 - 16:30 น. จำนวนผู้เข้าร่วม 45 คน พร้อมขอสนับสนุนเครื่องเสียง ไมค์ลอย 2 ตัว และโปรเจคเตอร์',
        urgency: 'NORMAL',
        status: 'PENDING',
        currentRole: 'เจ้าพนักงานธุรการ',
        customPayload: {
          roomName: 'ห้องประชุมราชพฤกษ์ (อาคารผู้ป่วยนอก ชั้น 3)',
          meetingDate: '25 ต.ค. 2569',
          meetingTime: '08:30 - 16:30 น.',
          attendeesCount: 45,
          equipments: ['PROJECTOR', 'MIC_WIRELESS', 'SOUND_SYSTEM'],
        },
        steps: [
          { stepNo: 1, stepName: 'ผู้รับผิดชอบห้องประชุม ตรวจสอบคิวห้องและความพร้อม', role: 'เจ้าพนักงานธุรการ', status: 'PENDING' },
          { stepNo: 2, stepName: 'หัวหน้ากลุ่มงานบริหารทั่วไป อนุมัติการใช้สถานที่', role: 'หัวหน้ากลุ่มงานบริหารทั่วไป', status: 'WAITING' },
        ],
      },
      {
        taskType: 'DOC_APPROVAL',
        taskNo: 'DOC-6910-0006',
        title: 'ขออนุมัติเอกสาร: ขออนุมัติจัดซื้อวัสดุสิ้นเปลืองทางการแพทย์ ประจำตึกอุบัติเหตุและฉุกเฉิน (ER)',
        description: 'ขออนุมัติจัดซื้อวัสดุการแพทย์ฉุกเฉิน (Set ทำแผล, สายยางให้ออกซิเจน, ถุงมือปลอดเชื้อ) ประจำไตรมาสที่ 1 วงเงินงบประมาณ 28,500 บาท',
        urgency: 'URGENT',
        status: 'PENDING',
        currentRole: 'เจ้าพนักงานการเงินและบัญชี',
        customPayload: {
          docType: 'PROCUREMENT',
          budgetAmount: 28500,
          budgetSource: 'เงินบำรุงโรงพยาบาลเถิน',
          itemCount: 8,
        },
        steps: [
          { stepNo: 1, stepName: 'งานพัสดุและการเงิน ตรวจสอบงบประมาณและระเบียบพัสดุ', role: 'เจ้าพนักงานการเงินและบัญชี', status: 'PENDING' },
          { stepNo: 2, stepName: 'ผู้อำนวยการโรงพยาบาลเถิน พิจารณาลงนามอนุมัติ', role: 'ผู้อำนวยการโรงพยาบาลเถิน', status: 'WAITING' },
        ],
      },
    ]

    // 3. Insert each task
    for (const item of mockTasks) {
      const taskId = crypto.randomUUID()

      // Check if taskNo already exists
      const existing = await queryMemberDb('SELECT id FROM inbox_tasks WHERE task_no = ? LIMIT 1', [item.taskNo])
      if (existing.length > 0) {
        console.log(`Task ${item.taskNo} already exists, skipping.`)
        continue
      }

      await queryMemberDb(
        `INSERT INTO inbox_tasks 
         (\`id\`, \`task_no\`, \`task_type\`, \`title\`, \`description\`, \`urgency\`, \`requester_id\`, \`requester_name\`, \`requester_dept\`, \`status\`, \`current_step_no\`, \`current_assignee\`, \`current_role\`, \`custom_payload\`, \`created_at\`, \`updated_at\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, NOW(), NOW())`,
        [
          taskId,
          item.taskNo,
          item.taskType,
          item.title,
          item.description,
          item.urgency,
          memberId,
          memberName,
          dept,
          item.status,
          null, // Unassigned individual, routed by role
          item.currentRole,
          JSON.stringify(item.customPayload),
        ]
      )

      // Insert steps
      for (const st of item.steps) {
        const stepId = crypto.randomUUID()
        await queryMemberDb(
          `INSERT INTO inbox_task_steps 
           (id, task_id, step_no, step_name, assignee_type, assigned_to_id, assigned_role, status)
           VALUES (?, ?, ?, ?, 'ROLE', NULL, ?, ?)`,
          [
            stepId,
            taskId,
            st.stepNo,
            st.stepName,
            st.role,
            st.status,
          ]
        )
      }

      // Insert repair details if repair
      if (item.repairDetail) {
        const rd = item.repairDetail
        const rdId = crypto.randomUUID()
        await queryMemberDb(
          `INSERT INTO repair_details 
           (id, task_id, repair_type, item_category, equipment_number, equipment_name, non_equipment_item, location_full_name, symptom_detail, co_workers, repair_nature, repair_status, is_external_repair, cost_type, photos, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 'NORMAL', 'WAITING', 0, 'NO_COST', '[]', NOW(), NOW())`,
          [
            rdId,
            taskId,
            rd.repairType,
            rd.itemCategory,
            rd.equipmentNumber || null,
            rd.equipmentName || null,
            rd.nonEquipmentItem || null,
            rd.locationFullName,
            rd.symptomDetail,
          ]
        )
      }

      console.log(`✓ Inserted task [${item.taskType}] ${item.taskNo}: ${item.title.substring(0, 40)}...`)
    }

    console.log('--- Successfully populated mock data for all categories! ---')
  } catch (err) {
    console.error('Seed error:', err)
  }
}

seedMockInbox()
