import { prisma } from '../src/lib/prisma'
import fs from 'fs'
import path from 'path'

function getFileSize(filePath: string): bigint | null {
  try {
    const fullPath = path.join(process.cwd(), 'public', filePath.replace(/^\//, ''))
    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath)
      return BigInt(stat.size)
    }
  } catch (e) {
    console.error(`Failed to get size for ${filePath}:`, e)
  }
  return null
}

const initialEthicsData = [
  {
    year: '2569',
    displayOrder: 1,
    isActive: true,
    documents: [
      {
        title: '1. คำสั่งคณะทำงานขับเคลื่อนชมรมจริยธรรมของหน่วยงาน',
        filePath: '/documents/ethics/2569/command.pdf',
        displayOrder: 1,
      },
      {
        title: '2. แผนปฏิบัติการส่งเสริมคุณธรรมของชมรมจริยธรรมของหน่วยงาน',
        filePath: '/documents/ethics/2569/action-plan.pdf',
        displayOrder: 2,
      },
      {
        title: '3. รายงานผลการดำเนินงานตามแผนปฏิบัติการส่งเสริมคุณธรรมของชมรมจริยธรรมโรงพยาบาลเถิน',
        filePath: '/documents/ethics/2569/report.pdf',
        displayOrder: 3,
      },
    ],
  },
  {
    year: '2568',
    displayOrder: 2,
    isActive: true,
    documents: [
      {
        title: '1. คำสั่งคณะทำงานขับเคลื่อนชมรมจริยธรรมของหน่วยงาน',
        filePath: '/documents/ethics/2568/command.pdf',
        displayOrder: 1,
      },
      {
        title: '2. แผนปฏิบัติการส่งเสริมคุณธรรมของชมรมจริยธรรมของหน่วยงาน',
        filePath: '/documents/ethics/2568/action-plan.pdf',
        displayOrder: 2,
      },
      {
        title: '3. รายงานผลการดำเนินงานตามแผนปฏิบัติการส่งเสริมคุณธรรมของชมรมจริยธรรมโรงพยาบาลเถิน',
        filePath: null,
        displayOrder: 3,
        children: [
          {
            title: 'รายงานผลการดำเนินงานตามแผนปฏิบัติการส่งเสริมคุณธรรมของหน่วยงาน รอบ 6 เดือน',
            filePath: '/documents/ethics/2568/report-6m.pdf',
            displayOrder: 1,
          },
          {
            title: 'รายงานผลการดำเนินงานตามแผนปฏิบัติการส่งเสริมคุณธรรมของหน่วยงาน รอบ 12 เดือน',
            filePath: '/documents/ethics/2568/report-12m.pdf',
            displayOrder: 2,
          },
        ],
      },
    ],
  },
  {
    year: '2567',
    displayOrder: 3,
    isActive: true,
    documents: [
      {
        title: '1. คำสั่งคณะทำงานขับเคลื่อนชมรมจริยธรรมของหน่วยงาน',
        filePath: '/documents/ethics/2567/command.pdf',
        displayOrder: 1,
      },
      {
        title: '2. แผนปฏิบัติการส่งเสริมคุณธรรมของชมรมจริยธรรมของหน่วยงาน',
        filePath: '/documents/ethics/2567/action-plan.pdf',
        displayOrder: 2,
      },
      {
        title: '3. รายงานผลการดำเนินงานตามแผนปฏิบัติการส่งเสริมคุณธรรมของชมรมจริยธรรมโรงพยาบาลเถิน',
        filePath: '/documents/ethics/2567/report.pdf',
        displayOrder: 3,
      },
    ],
  },
]

async function seedEthics() {
  const existingYears = await prisma.ethicsYear.count()
  console.log(`Current ethics years count: ${existingYears}`)
  if (existingYears === 0) {
    for (const yearData of initialEthicsData) {
      const createdYear = await prisma.ethicsYear.create({
        data: {
          year: yearData.year,
          displayOrder: yearData.displayOrder,
          isActive: yearData.isActive,
        },
      })

      for (const doc of yearData.documents) {
        const parentDoc = await prisma.ethicsDocument.create({
          data: {
            yearId: createdYear.id,
            title: doc.title,
            filePath: doc.filePath,
            fileSize: doc.filePath ? getFileSize(doc.filePath) : null,
            displayOrder: doc.displayOrder,
            isActive: true,
          },
        })

        if (doc.children && doc.children.length > 0) {
          for (const child of doc.children) {
            await prisma.ethicsDocument.create({
              data: {
                yearId: createdYear.id,
                parentId: parentDoc.id,
                title: child.title,
                filePath: child.filePath,
                fileSize: child.filePath ? getFileSize(child.filePath) : null,
                displayOrder: child.displayOrder,
                isActive: true,
              },
            })
          }
        }
      }
    }
    console.log('Seeded ethics documents for 2567, 2568, and 2569 successfully.')
  } else {
    console.log('Ethics years already exist. Skipping seed.')
  }
}

seedEthics()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    process.exit(0)
  })
