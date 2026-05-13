import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding data...');

  // 1. Create Store
  const store = await prisma.store.upsert({
    where: { storeCode: 'RESTO001' },
    update: {},
    create: {
      storeCode: 'RESTO001',
      name: 'Resto Prhatara',
      address: 'Jl. Raya No. 1, Jakarta',
      phone: '08123456789',
      email: 'owner@prhatara.online',
      taxPercentage: 11,
      serviceChargePercentage: 5,
      currency: 'IDR',
      isActive: true,
    },
  });
  console.log('Store created:', store.name);

  // 2. Create Owner User
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const owner = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { password: hashedPassword },
    create: {
      username: 'admin',
      password: hashedPassword,
      fullName: 'Owner Resto',
      role: 'owner',
      pinCode: '123456',
      isActive: true,
    },
  });
  console.log('Owner created:', owner.username);

  // 3. Create Basic Expense Categories
  const categories = [
    { name: 'Bahan Baku (HPP)', isForHpp: true, icon: 'ShoppingOutlined' },
    { name: 'Operasional', isForHpp: false, icon: 'ToolOutlined' },
    { name: 'Gaji Karyawan', isForHpp: false, icon: 'UserOutlined' },
    { name: 'Listrik & Air', isForHpp: false, icon: 'ThunderboltOutlined' },
  ];

  for (const cat of categories) {
    await prisma.expenseCategory.create({
      data: cat,
    });
  }
  console.log('Expense categories created');

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
