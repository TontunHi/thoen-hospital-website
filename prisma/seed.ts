import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');
  
  // Enforce session charset to be utf8mb4 for Thai language compatibility
  await prisma.$executeRawUnsafe('SET NAMES utf8mb4');

  // 1. Clear existing data
  console.log('Clearing old data...');
  await prisma.admin.deleteMany({});
  await prisma.news.deleteMany({});
  await prisma.contact.deleteMany({});

  // 2. Create Admin
  const adminPassword = 'admin1234';
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.admin.create({
    data: {
      username: 'admin',
      passwordHash: passwordHash,
      name: 'ผู้ดูแลระบบ โรงพยาบาลเถิน',
    },
  });
  console.log(`Created admin: ${admin.username}`);

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
