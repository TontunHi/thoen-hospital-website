import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

async function seedMockMaterials() {
  console.log('--- Seeding Mock Materials & Loanable Assets for Thoen Hospital Events ---')

  // 1. Mock Hospital Materials (วัสดุ/พัสดุสำหรับใช้งานและยืมในกิจกรรม)
  const materialsToSeed = [
    {
      name: 'ปลั๊กพ่วงสายไฟ 5 เมตร (มอก.)',
      category: 'ELECTRICAL',
      materialType: 'REUSABLE',
      totalQty: 25,
      availableQty: 25,
      unit: 'เส้น',
      location: 'ห้องพัสดุกลาง ชั้น 1 อาคารสนับสนุน',
      notes: 'ปลั๊กไฟ 4 ช่อง มีระบบตัดไฟอัตโนมัติ สำหรับงานอบรมและกิจกรรม',
      isActive: true,
    },
    {
      name: 'ปลั๊กพ่วงสายไฟ 10 เมตร (มอก.)',
      category: 'ELECTRICAL',
      materialType: 'REUSABLE',
      totalQty: 15,
      availableQty: 15,
      unit: 'เส้น',
      location: 'ห้องพัสดุกลาง ชั้น 1 อาคารสนับสนุน',
      notes: 'สายไฟขนาดใหญ่สำหรับงานกลางแจ้งและห้องประชุมใหญ่',
      isActive: true,
    },
    {
      name: 'ไมโครโฟนไร้สาย (ชุดไมค์ลอยคู่)',
      category: 'AUDIO_VISUAL',
      materialType: 'REUSABLE',
      totalQty: 6,
      availableQty: 6,
      unit: 'ชุด',
      location: 'ห้องศูนย์สารสนเทศ ชั้น 2',
      notes: 'ไมค์ลอยคลื่นความถี่ UHF กสทช. พร้อมตัวรับสัญญาณและถ่านชาร์จ',
      isActive: true,
    },
    {
      name: 'ขาตั้งไมโครโฟนแบบปรับระดับได้',
      category: 'AUDIO_VISUAL',
      materialType: 'REUSABLE',
      totalQty: 12,
      availableQty: 12,
      unit: 'ตัว',
      location: 'ห้องประชุมใหญ่ ชั้น 4',
      notes: 'ขาตั้งไมค์เหล็กแข็งแรง ปรับสูง-ต่ำได้',
      isActive: true,
    },
    {
      name: 'พอยเตอร์ไร้สายควบคุมสไลด์ (Wireless Presenter)',
      category: 'IT',
      materialType: 'REUSABLE',
      totalQty: 10,
      availableQty: 10,
      unit: 'อัน',
      location: 'ศูนย์คอมพิวเตอร์',
      notes: 'พอยเตอร์เลเซอร์แสงสีแดง เชื่อมต่อผ่าน USB Dongle ระยะ 15 เมตร',
      isActive: true,
    },
    {
      name: 'สายแปลงสัญญาณ HDMI to Type-C / VGA',
      category: 'IT',
      materialType: 'REUSABLE',
      totalQty: 15,
      availableQty: 15,
      unit: 'เส้น',
      location: 'ศูนย์คอมพิวเตอร์',
      notes: 'สำหรับต่อโน้ตบุ๊กวิทยากรเข้ากับโปรเจกเตอร์',
      isActive: true,
    },
    {
      name: 'ป้ายคล้องคอผู้เข้าร่วมอบรม/กิจกรรม (พร้อมสายคล้องคอ)',
      category: 'GENERAL',
      materialType: 'REUSABLE',
      totalQty: 300,
      availableQty: 300,
      unit: 'อัน',
      location: 'กลุ่มงานบริหารทั่วไป',
      notes: 'ซองใส่บัตรพลาสติกใสพร้อมสายคล้องสีเขียวโรงพยาบาลเถิน',
      isActive: true,
    },
    {
      name: 'กระดานไวท์บอร์ดล้อเลื่อน (ขนาด 120 x 90 ซม.)',
      category: 'GENERAL',
      materialType: 'REUSABLE',
      totalQty: 6,
      availableQty: 6,
      unit: 'แผ่น',
      location: 'ห้องเก็บของหลังห้องประชุม 1',
      notes: 'กระดานสองหน้า หมุนล็อคได้ มีล้อเลื่อนพร้อมตัวล็อคล้อ',
      isActive: true,
    },
    {
      name: 'ปากกาไวท์บอร์ดพร้อมแปรงลบ (ชุด 4 สี)',
      category: 'STATIONERY',
      materialType: 'REUSABLE',
      totalQty: 40,
      availableQty: 40,
      unit: 'ชุด',
      location: 'ห้องพัสดุกลาง',
      notes: 'ชุด 4 ด้าม ดำ แดง น้ำเงิน เขียว และแปรงลบแม่เหล็ก',
      isActive: true,
    },
    {
      name: 'โต๊ะพับหน้าขาวอเนกประสงค์ (1.5 เมตร)',
      category: 'FURNITURE',
      materialType: 'REUSABLE',
      totalQty: 20,
      availableQty: 20,
      unit: 'ตัว',
      location: 'ห้องเก็บของ ชั้น 1',
      notes: 'โต๊ะพับขาเหล็กแข็งแรง สำหรับจุดลงทะเบียนและซุ้มกิจกรรม',
      isActive: true,
    },
    {
      name: 'เก้าอี้พลาสติกสีขาว (สำหรับกิจกรรม)',
      category: 'FURNITURE',
      materialType: 'REUSABLE',
      totalQty: 200,
      availableQty: 200,
      unit: 'ตัว',
      location: 'ห้องเก็บของ ชั้น 1',
      notes: 'เก้าอี้พลาสติกเกรดหนา ซ้อนได้',
      isActive: true,
    },
    {
      name: 'หุ่นจำลองฝึกกู้ชีพผู้ใหญ่ (CPR Adult Manikin with Feedback)',
      category: 'MEDICAL_TRAINING',
      materialType: 'REUSABLE',
      totalQty: 10,
      availableQty: 10,
      unit: 'ตัว',
      location: 'กลุ่มงานการพยาบาล / ห้องฝึกอบรม',
      notes: 'หุ่นฝึก CPR มีไฟแสดงผลความลึกและจังหวะการกดหน้าอก สำหรับโครงการอบรมช่วยฟื้นคืนชีพ',
      isActive: true,
    },
    {
      name: 'เครื่องกระตุกหัวใจไฟฟ้าอัตโนมัติจำลองสำหรับฝึกอบรม (AED Trainer)',
      category: 'MEDICAL_TRAINING',
      materialType: 'REUSABLE',
      totalQty: 5,
      availableQty: 5,
      unit: 'เครื่อง',
      location: 'กลุ่มงานการพยาบาล / ห้องฝึกอบรม',
      notes: 'เครื่อง AED จำลองพร้อมแผ่นแปะซ้อมและรีโมทสั่งสถานการณ์ฝึกอบรม',
      isActive: true,
    },
  ]

  let createdMaterialsCount = 0
  for (const item of materialsToSeed) {
    const existing = await prisma.hospitalMaterial.findFirst({
      where: { name: item.name },
    })

    if (!existing) {
      await prisma.hospitalMaterial.create({
        data: item,
      })
      createdMaterialsCount++
      console.log(`+ Created material: ${item.name} (${item.totalQty} ${item.unit})`)
    } else {
      // Ensure it is active and has qty
      await prisma.hospitalMaterial.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          availableQty: Math.max(existing.availableQty, item.availableQty),
          totalQty: Math.max(existing.totalQty, item.totalQty),
        },
      })
      console.log(`= Updated existing material: ${item.name}`)
    }
  }

  // 2. Mock Hospital Assets (ครุภัณฑ์ที่ให้ยืมได้ isLoanable = true)
  const assetsToSeed = [
    {
      articleNum: '7440-001-0012/65',
      fsnNum: '7440',
      name: 'เครื่องฉายโปรเจคเตอร์ Epson Full HD 4,000 Lumens',
      brand: 'Epson',
      model: 'EB-FH52',
      serialNo: 'X8Y9012345',
      category: 'IT',
      locationFullName: 'ศูนย์คอมพิวเตอร์ อาคารอำนวยการ ชั้น 2',
      department: 'ศูนย์คอมพิวเตอร์และสารสนเทศ',
      isLoanable: true,
      status: 'ACTIVE',
      notes: 'เครื่องฉายโปรเจคเตอร์เคลื่อนที่ พร้อมกระเป๋าใส่และสายสัญญาณ HDMI',
    },
    {
      articleNum: '7440-002-0005/65',
      fsnNum: '7440',
      name: 'จอรับภาพโปรเจคเตอร์แบบตั้งพื้นขาตั้ง 100 นิ้ว (Tripod Screen)',
      brand: 'Vertex',
      model: '100-Inch Tripod',
      serialNo: 'SCR-2022-005',
      category: 'IT',
      locationFullName: 'ห้องพัสดุกลาง ชั้น 1',
      department: 'กลุ่มงานบริหารทั่วไป',
      isLoanable: true,
      status: 'ACTIVE',
      notes: 'จอฉายม้วนเก็บได้ มีขาตั้ง 3 ขา พกพาสะดวก',
    },
    {
      articleNum: '7440-003-0008/66',
      fsnNum: '7440',
      name: 'ตู้ลำโพงเคลื่อนที่อเนกประสงค์พร้อมล้อลากและแบตเตอรี่ในตัว (Portable PA Speaker)',
      brand: 'Sherman',
      model: 'APS-110',
      serialNo: 'SPK-2023-008',
      category: 'IT',
      locationFullName: 'กลุ่มงานสุขศึกษาและประชาสัมพันธ์',
      department: 'กลุ่มงานสุขศึกษา',
      isLoanable: true,
      status: 'ACTIVE',
      notes: 'ลำโพงล้อลาก 80W พร้อมไมค์ลอย 2 ตัว รองรับบลูทูธและ USB สำหรับงานกิจกรรมกลางแจ้ง',
    },
    {
      articleNum: '7440-001-0089/66',
      fsnNum: '7440',
      name: 'คอมพิวเตอร์พกพาสำหรับวิทยากร Dell Latitude 3420 Core i5',
      brand: 'Dell',
      model: 'Latitude 3420',
      serialNo: 'DLL-9876543',
      category: 'IT',
      locationFullName: 'ศูนย์คอมพิวเตอร์ อาคารอำนวยการ ชั้น 2',
      department: 'ศูนย์คอมพิวเตอร์และสารสนเทศ',
      isLoanable: true,
      status: 'ACTIVE',
      notes: 'โน้ตบุ๊กสำรองสำหรับจัดอบรมและงานนำเสนอวิทยากร',
    },
    {
      articleNum: '6515-001-0042/66',
      fsnNum: '6515',
      name: 'เครื่องตรวจวัดความดันโลหิตแบบดิจิตอลชนิดสอดแขนสำหรับหน่วยคัดกรองกิจกรรม',
      brand: 'Omron',
      model: 'HBP-9030',
      serialNo: 'OMR-2023-42',
      category: 'MEDICAL',
      locationFullName: 'กลุ่มงานบริการด้านปฐมภูมิและองค์รวม',
      department: 'เวชปฏิบัติครอบครัว',
      isLoanable: true,
      status: 'ACTIVE',
      notes: 'เครื่องวัดความดันพร้อมล้อเลื่อน สำหรับออกหน่วยตรวจสุขภาพในกิจกรรมโรงพยาบาล',
    },
  ]

  let createdAssetsCount = 0
  for (const asset of assetsToSeed) {
    const existing = await prisma.hospitalAsset.findUnique({
      where: { articleNum: asset.articleNum },
    })

    if (!existing) {
      await prisma.hospitalAsset.create({
        data: asset,
      })
      createdAssetsCount++
      console.log(`+ Created loanable asset: ${asset.name} [${asset.articleNum}]`)
    } else {
      await prisma.hospitalAsset.update({
        where: { id: existing.id },
        data: {
          isLoanable: true,
          status: 'ACTIVE',
          name: asset.name,
        },
      })
      console.log(`= Updated loanable asset: ${asset.name} [${asset.articleNum}]`)
    }
  }

  // Summary
  const totalMaterials = await prisma.hospitalMaterial.count({ where: { isActive: true } })
  const totalLoanableAssets = await prisma.hospitalAsset.count({ where: { isLoanable: true, status: 'ACTIVE' } })

  console.log('--- Seeding Completed Successfully ---')
  console.log(`Active Materials in DB: ${totalMaterials}`)
  console.log(`Loanable Assets in DB: ${totalLoanableAssets}`)
}

seedMockMaterials()
  .catch((err) => {
    console.error('Seeding failed with error:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
