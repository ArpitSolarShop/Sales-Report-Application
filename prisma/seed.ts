import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

async function getSeedClient() {
  const mod = await import("../src/generated/prisma/client.js");
  const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
  return new mod.PrismaClient({ adapter });
}

import fs from 'fs';
import path from 'path';

type PrismaClient = Awaited<ReturnType<typeof getSeedClient>>;

async function main(prisma: PrismaClient) {
  console.log("🌱 Seeding database from initial_sales.tsv...");

  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.salesAgent.deleteMany();

  const product = await prisma.product.create({
    data: {
      name: "Solar System",
      sku: "SOLAR-SYS-01",
      category: "Hardware",
      price: 0,
      description: "Solar Power System Installation",
    }
  });

  const agentsMap = new Map();
  const customersMap = new Map();
  let invoiceCounter = 1;

  const tsvPath = path.join(__dirname, 'initial_sales.tsv');
  const rawData = fs.readFileSync(tsvPath, 'utf8');

  const lines = rawData.trim().split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split('\t');
    if (parts.length < 9) continue;
    
    const customerName = parts[1].trim();
    const salespersonName = parts[2].trim();
    const mobile = parts[3].trim();
    const capacity = parseFloat(parts[4].trim());
    const company = parts[5].trim();
    const location = parts[6].trim();
    const amountRaw = parts[7].trim().replace(/,/g, '');
    const amount = parseFloat(amountRaw);
    
    // date is DD/MM/YYYY
    const dateParts = parts[8].trim().split('/');
    let saleDate = new Date();
    if (dateParts.length === 3) {
      saleDate = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T12:00:00Z`);
    }

    const telecaller = parts.length > 9 ? parts[9].trim() : null;

    let agentId = agentsMap.get(salespersonName);
    if (!agentId) {
      const agentEmail = `${salespersonName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'agent'}@solarsales.com`;
      let agent = await prisma.salesAgent.findUnique({ where: { email: agentEmail } });
      if (!agent) {
        agent = await prisma.salesAgent.create({
            data: {
                name: salespersonName,
                email: agentEmail,
                region: "HQ",
            }
        });
      }
      agentId = agent.id;
      agentsMap.set(salespersonName, agentId);
    }

    let customerId = customersMap.get(mobile);
    if (!customerId) {
      const customerEmail = `c${mobile}@solarsales.com`;
      let customer = await prisma.customer.findUnique({ where: { email: customerEmail }});
      if (!customer) {
        customer = await prisma.customer.create({
            data: {
                name: customerName,
                email: customerEmail,
                phone: mobile,
                company: company,
                address: location
            }
        });
      }
      customerId = customer.id;
      customersMap.set(mobile, customerId);
    }

    await prisma.sale.create({
        data: {
            invoiceNumber: `INV-2026-${String(invoiceCounter++).padStart(4, "0")}`,
            status: "completed",
            totalAmount: amount,
            netAmount: amount,
            saleDate: saleDate,
            agentId: agentId,
            customerId: customerId,
            telecaller: telecaller || null,
            notes: `Capacity: ${capacity} kW | Company: ${company} | Location: ${location}`,
            items: {
                create: [{
                    quantity: 1,
                    price: amount,
                    total: amount,
                    productId: product.id,
                }]
            }
        }
    });
  }

  console.log(`✅ Seeded ${lines.length} records!`);
}

getSeedClient()
  .then((prisma) =>
    main(prisma)
      .catch((e) => {
        console.error("❌ Seed error:", e);
        process.exit(1);
      })
      .finally(async () => {
        await prisma.$disconnect();
      })
  );
