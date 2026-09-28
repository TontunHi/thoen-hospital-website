import { prisma } from '../src/lib/prisma'

const initialDocuments = [
  {
    year: '2569',
    label: 'ปีงบประมาณ 2569',
    note: 'เริ่มใช้วันที่ 1 ตุลาคม 2568',
    url: 'https://docs.google.com/spreadsheets/d/10xY81Mg8Z6OapMsmdDczM18pedFgpjlVzvh85VsCNz4/edit?gid=1877960154#gid=1877960154',
    status: 'ล่าสุด',
    displayOrder: 1,
    isActive: true,
  },
  {
    year: '2568',
    label: 'ปีงบประมาณ 2568',
    note: 'เริ่มใช้วันที่ 1 ตุลาคม 2567',
    url: 'https://docs.google.com/spreadsheets/d/19Nwk-OZt3kCSFBz3F6CeM-QQOVPMf1qVyPg1u4AkXzg/edit?gid=1110029885#gid=1110029885',
    status: 'เสร็จสิ้น',
    displayOrder: 2,
    isActive: true,
  },
  {
    year: '2567',
    label: 'ปีงบประมาณ 2567',
    note: 'เริ่มใช้วันที่ 1 ตุลาคม 2566',
    url: 'https://docs.google.com/spreadsheets/d/1JPfegyNT6S0zGP1l3UDeMrHDuDJlC-YomQ6hgStyIgE/edit?usp=sharing',
    status: 'เสร็จสิ้น',
    displayOrder: 3,
    isActive: true,
  },
  {
    year: '2566',
    label: 'ปีงบประมาณ 2566',
    note: 'เริ่มใช้วันที่ 1 ตุลาคม 2565',
    url: 'https://docs.google.com/spreadsheets/d/1Ht8rUioZNsxZkkBzCm2IO6kCQiI9-LXlnIUSrPxlbyY/edit?usp=sharing',
    status: 'เสร็จสิ้น',
    displayOrder: 4,
    isActive: true,
  },
  {
    year: '2565',
    label: 'ปีงบประมาณ 2565',
    note: 'เริ่มใช้วันที่ 1 ตุลาคม 2564',
    url: 'https://docs.google.com/spreadsheets/d/1Dxa0csyspb3RAoN8kSo4TOod2zOz1hbsyTJ9CmYPzow/edit?usp=sharing',
    status: 'เสร็จสิ้น',
    displayOrder: 5,
    isActive: true,
  },
  {
    year: '2564',
    label: 'ปีงบประมาณ 2564',
    note: 'เริ่มใช้วันที่ 1 ตุลาคม 2563',
    url: 'https://docs.google.com/spreadsheets/d/13z4h84YEdxNvl7NInAbx-ZuEKQ1bLJJNm2nBmSHbXs0/edit#gid=0',
    status: 'เสร็จสิ้น',
    displayOrder: 6,
    isActive: true,
  },
  {
    year: '2563',
    label: 'ปีงบประมาณ 2563',
    note: 'เริ่มใช้วันที่ 1 ตุลาคม 2562',
    url: 'https://docs.google.com/spreadsheets/d/1WDdgkljF2K1P-uFrRhVmWeXOJX7ipkyxy-oNmFUx-b8/edit#gid=0',
    status: 'เสร็จสิ้น',
    displayOrder: 7,
    isActive: true,
  },
  {
    year: '2562',
    label: 'ปีงบประมาณ 2562',
    note: 'เริ่มใช้วันที่ 1 ตุลาคม 2561',
    url: 'https://docs.google.com/spreadsheets/d/1QOyXQT_eQ2cEUIv12KcYzJi2gMraJMdEhnV1Cd8xn8M/edit?usp=sharing',
    status: 'เสร็จสิ้น',
    displayOrder: 8,
    isActive: true,
  },
  {
    year: '2561',
    label: 'ปีงบประมาณ 2561',
    note: '',
    url: 'https://docs.google.com/spreadsheets/d/1Str95qCk31a7eeQJNbOdID_RkfjSWZEzg8hkjqrEOOo/edit?usp=sharing',
    status: 'เสร็จสิ้น',
    displayOrder: 9,
    isActive: true,
  },
]

async function seed() {
  const count = await prisma.outgoingDocument.count()
  console.log(`Current outgoing documents count: ${count}`)
  if (count === 0) {
    for (const doc of initialDocuments) {
      await prisma.outgoingDocument.create({
        data: doc,
      })
    }
    console.log('Seeded 9 historical outgoing documents successfully.')
  } else {
    console.log('Table already populated. Skipping seed.')
  }
}

seed()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    process.exit(0)
  })
