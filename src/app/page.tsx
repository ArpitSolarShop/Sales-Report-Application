import React from 'react';
import DashboardClient from '@/components/DashboardClient';
import prisma from '@/lib/prisma';

export default async function Page() {
  const sales = await prisma.sale.findMany({
    include: {
      customer: true,
      agent: true,
    },
    orderBy: {
      saleDate: 'desc',
    }
  });

  const formattedRecords = sales.map(sale => {
    const capacityMatch = sale.notes?.match(/Capacity: ([\d.]+) kW/);
    const capacity = capacityMatch ? parseFloat(capacityMatch[1]) : 0;
    
    return {
      customer: sale.customer.name,
      mobile: sale.customer.phone || "",
      date: sale.saleDate.toISOString().split('T')[0],
      capacity,
      amount: sale.totalAmount,
      salesperson: sale.agent.name
    };
  });

  return (
    <DashboardClient initialRecords={formattedRecords} />
  );
}
