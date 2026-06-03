"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  Zap,
  Search,
  Printer,
  Database,
  Target,
  Users,
  Star,
  DollarSign,
  Package,
  TrendingUp,
  Activity,
  BarChart3,
  Award,
  ShieldCheck,
  MapPin,
  X
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartDataLabels
);

ChartJS.defaults.font.family = 'Inter, sans-serif';
ChartJS.defaults.color = '#94a3b8';
// @ts-ignore
ChartJS.defaults.scale.grid.color = '#f1f5f9';

const TARGET_REVENUE = 12000000; // 1.2 Crore

const formatMoney = (num: number) => '₹' + (num || 0).toLocaleString('en-IN');
const toTitleCase = (str: string) => {
    if (!str) return "Unknown";
    return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
};

type RecordData = {
    customer: string;
    mobile: string;
    date: string;
    capacity: number;
    amount: number;
    salesperson: string;
};

export default function DashboardClient({ initialRecords }: { initialRecords: RecordData[] }) {
    const [allData, setAllData] = useState<RecordData[]>(initialRecords);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedRep, setSelectedRep] = useState<string | null>(null);
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    const [syncInput, setSyncInput] = useState("");
    const [currentDate, setCurrentDate] = useState("");
    const [selectedMonth, setSelectedMonth] = useState<string>("All");

    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        allData.forEach(item => {
            const d = new Date(item.date);
            if(!isNaN(d.getTime())) {
                months.add(d.toLocaleString('default', { month: 'long', year: 'numeric' }));
            }
        });
        return Array.from(months).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    }, [allData]);

    useEffect(() => {
        setCurrentDate(new Date().toLocaleDateString('en-IN'));
    }, []);

    const stats = useMemo(() => {
        const filteredData = allData.filter(item => {
            const cleanRepName = toTitleCase(item.salesperson.trim());
            const matchesSearch = String(item.customer || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  cleanRepName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesRep = !selectedRep || cleanRepName === selectedRep;
            
            let matchesMonth = true;
            if (selectedMonth !== "All") {
                const d = new Date(item.date);
                if (!isNaN(d.getTime())) {
                    const itemMonth = d.toLocaleString('default', { month: 'long', year: 'numeric' });
                    matchesMonth = itemMonth === selectedMonth;
                }
            }

            return matchesSearch && matchesRep && matchesMonth;
        });

        let totalRevenue = 0;
        let totalCapacity = 0;
        const bySales: Record<string, any> = {};
        const dailyData: Record<string, any> = {};
        const weekdayMap: Record<string, number> = { "Sun":0, "Mon":0, "Tue":0, "Wed":0, "Thu":0, "Fri":0, "Sat":0 };
        const capSegments: Record<string, number> = { "< 3 kW": 0, "3 kW": 0, "3.1 - 4 kW": 0, "> 4 kW": 0 };

        filteredData.forEach(curr => {
            totalRevenue += curr.amount || 0;
            totalCapacity += curr.capacity || 0;

            const sp = toTitleCase(curr.salesperson || "Unknown");
            if (!bySales[sp]) bySales[sp] = { name: sp, revenue: 0, deals: 0, capacity: 0 };
            bySales[sp].revenue += curr.amount || 0;
            bySales[sp].deals += 1;
            bySales[sp].capacity += curr.capacity || 0;

            const d = curr.date;
            if (!dailyData[d]) dailyData[d] = { date: d, revenue: 0, deals: 0 };
            dailyData[d].revenue += curr.amount || 0;
            dailyData[d].deals += 1;

            const dateObj = new Date(curr.date);
            if(!isNaN(dateObj.getTime())) {
                const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dateObj.getDay()];
                weekdayMap[dayName] += curr.amount || 0;
            }

            if (curr.capacity > 4) capSegments["> 4 kW"] += 1;
            else if (curr.capacity > 3) capSegments["3.1 - 4 kW"] += 1;
            else if (curr.capacity === 3) capSegments["3 kW"] += 1;
            else capSegments["< 3 kW"] += 1;
        });

        const sortedSales = Object.values(bySales).sort((a, b) => b.revenue - a.revenue);
        const timeline = Object.values(dailyData).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const weekdayPerformance = Object.keys(weekdayMap).map(k => ({ name: k, revenue: weekdayMap[k] }));
        const capDist = Object.keys(capSegments).map(k => ({ name: k, value: capSegments[k] }));
        
        const dealCount = filteredData.length;

        return {
            filteredData,
            totalRevenue,
            totalCapacity,
            avgTicket: dealCount ? (totalRevenue / dealCount) : 0,
            revenuePerKw: totalCapacity ? (totalRevenue / totalCapacity) : 0,
            dealCount,
            topSales: sortedSales,
            timeline,
            weekdayPerformance,
            capDist,
            topPerformer: sortedSales[0] || null
        };
    }, [allData, searchTerm, selectedRep, selectedMonth]);

    const handleSyncData = () => {
        if (!syncInput.trim()) return;
        try {
            const rows = syncInput.split('\n').filter(r => r.trim().length > 0);
            const isHeader = rows[0].toLowerCase().includes('customer') || rows[0].toLowerCase().includes('mobile');
            const dataToParse = isHeader ? rows.slice(1) : rows;

            const parsed = dataToParse.map(row => {
                const parts = row.split(/,|\t/);
                return {
                    customer: parts[0]?.trim().replace(/"/g, '') || "N/A",
                    mobile: parts[1]?.trim() || "N/A",
                    date: parts[2]?.trim() || "2026-05-01", 
                    capacity: parseFloat(parts[3]) || 0,
                    amount: parseFloat(parts[4]) || 0,
                    salesperson: (parts[5]?.trim() || "Unknown").replace(/\s+$/, '')
                };
            });

            if (parsed.length > 0) {
                setAllData([...allData, ...parsed]);
                setIsSyncModalOpen(false);
                setSyncInput("");
            }
        } catch (e) { console.error("Sync error", e); }
    };

    const handlePrint = () => {
        window.print();
    };

    const maxRev = stats.topPerformer ? stats.topPerformer.revenue : 1;
    const progress = Math.min((stats.totalRevenue / TARGET_REVENUE) * 100, 100);
    const avgKw = stats.dealCount ? (stats.totalCapacity / stats.dealCount).toFixed(2) : '0';
    const peakDateStr = stats.timeline.length ? [...stats.timeline].sort((a,b) => b.revenue - a.revenue)[0].date : 'N/A';

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 pb-20 print:bg-white print:p-0 print:pb-0">
            <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 print:space-y-4 print:p-4 print:max-w-none">
                
                {/* Header */}
                <header className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-6 border-b-[3px] border-slate-900 pb-6 mb-8 pt-2 print:pt-0 print:pb-4 print:mb-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                        <img src="/logo.png" alt="Krishnanuja Renewables" className="h-16 sm:h-20 w-auto object-contain print:h-14 drop-shadow-sm" />
                        <div>
                            <div className="flex items-center gap-2 mb-2 print:mb-1">
                                <Zap className="text-blue-600 print:text-slate-800 w-5 h-5" />
                                <span className="text-[10px] sm:text-xs print:text-[10px] font-black text-blue-700 print:text-slate-600 uppercase tracking-widest bg-blue-50 print:bg-transparent print:px-0 px-2 py-1 rounded-md">
                                    Data Zone: Verified Audit ({allData.length} Records)
                                </span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl print:text-2xl font-black uppercase tracking-tighter text-slate-900">
                                Krishnanuja Sales Summary
                            </h1>
                        </div>
                    </div>
                    
                    <div className="text-left lg:text-right w-full lg:w-auto">
                        <p className="text-sm print:text-xs font-black uppercase text-slate-800">Report Date: {selectedMonth === "All" ? "All Time" : selectedMonth}</p>
                        <p className="text-xs print:text-[10px] text-slate-500 font-medium mt-0.5">Generated: {currentDate}</p>
                        
                        <div className="flex flex-wrap items-center gap-2 mt-4 print:hidden justify-start lg:justify-end w-full">
                            {selectedRep && (
                                <button onClick={() => setSelectedRep(null)} className="flex text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-xl border border-blue-100 items-center gap-1 hover:bg-blue-100 w-full sm:w-auto justify-center">
                                    Clear Filter: {selectedRep}
                                </button>
                            )}

                            <select 
                                value={selectedMonth} 
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="px-3 py-2 bg-slate-100 border-none rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all outline-none cursor-pointer appearance-none shadow-sm flex-1 sm:flex-none"
                                style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.7rem top 50%', backgroundSize: '0.65rem auto', paddingRight: '2rem' }}
                            >
                                <option value="All">All Time Data</option>
                                {availableMonths.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>

                            <div className="relative w-full sm:w-auto">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                                <input 
                                    type="text" 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search logs..." 
                                    className="pl-8 pr-3 py-2 bg-slate-100 border-none rounded-xl text-xs w-full sm:w-36 focus:ring-2 focus:ring-blue-500 transition-all outline-none" 
                                />
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button onClick={handlePrint} className="flex-1 sm:flex-none justify-center bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-800 shadow-md transition-transform active:scale-95">
                                    <Printer className="w-3.5 h-3.5" /> Print
                                </button>
                                <button onClick={() => setIsSyncModalOpen(true)} className="flex-1 sm:flex-none justify-center bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-blue-700 shadow-md transition-transform active:scale-95">
                                    <Database className="w-3.5 h-3.5" /> Sync
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Target Milestone & High-Level Pulse */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:gap-4">
                    <div className="lg:col-span-2 bg-white p-8 print:p-6 rounded-[2.5rem] print:rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50 group-hover:scale-110 transition-transform duration-700 print:hidden"></div>
                        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Target className="text-blue-600 w-4 h-4" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue Milestone Tracking</span>
                                </div>
                                <h2 className="text-4xl print:text-3xl font-black text-slate-900 tracking-tight">{formatMoney(stats.totalRevenue)}</h2>
                                <p className="text-slate-500 mt-2 text-sm font-medium print:mt-1">Currently at <span className="text-blue-600 font-bold">{progress.toFixed(1)}%</span> of monthly goal (₹1.2 Cr)</p>
                                <div className="mt-6 w-full bg-slate-100 h-4 rounded-full overflow-hidden p-0.5 border border-slate-200">
                                    <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 h-full rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-4 print:gap-2">
                                <div className="bg-slate-50 p-4 print:p-3 rounded-2xl border border-slate-100 flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Month Deals</p>
                                        <p className="text-2xl print:text-xl font-black text-slate-800">{stats.dealCount}</p>
                                    </div>
                                    <Users className="text-blue-300 w-8 h-8 print:w-6 print:h-6" />
                                </div>
                                <div className="grid grid-cols-2 gap-4 print:gap-2">
                                    <div className="bg-slate-50 p-4 print:p-3 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Peak Date</p>
                                        <p className="text-sm font-black text-slate-800 truncate">{peakDateStr}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 print:p-3 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg kW</p>
                                        <p className="text-sm font-black text-slate-800 truncate">{avgKw} kW</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white p-8 print:p-6 rounded-[2.5rem] print:rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-4 print:mb-2">
                            <Star className="text-amber-500 w-4 h-4" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Top Performer</span>
                        </div>
                        <p className="text-2xl print:text-xl font-black tracking-tight text-slate-800">{stats.topPerformer ? stats.topPerformer.name : 'N/A'}</p>
                        <div className="mt-4 flex justify-between items-end border-t border-slate-50 pt-4 print:mt-2 print:pt-2">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Revenue</p>
                                <p className="text-sm font-black text-blue-600">{stats.topPerformer ? formatMoney(stats.topPerformer.revenue) : '₹0'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Deals</p>
                                <p className="text-sm font-black text-slate-800">{stats.topPerformer ? stats.topPerformer.deals : '0'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* KPI Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 print:gap-4">
                    <div className="bg-white p-4 print:p-3 rounded-2xl border border-slate-100 shadow-sm transition-all flex items-center gap-4">
                        <div className="bg-blue-100/50 text-blue-600 w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                            <DollarSign className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Revenue Pulse</p>
                            <h3 className="text-lg print:text-base font-black tracking-tight">{formatMoney(stats.totalRevenue)}</h3>
                        </div>
                    </div>
                    <div className="bg-white p-4 print:p-3 rounded-2xl border border-slate-100 shadow-sm transition-all flex items-center gap-4">
                        <div className="bg-emerald-100/50 text-emerald-600 w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Energy Load</p>
                            <h3 className="text-lg print:text-base font-black tracking-tight">{stats.totalCapacity.toFixed(1)} kW</h3>
                        </div>
                    </div>
                    <div className="bg-white p-4 print:p-3 rounded-2xl border border-slate-100 shadow-sm transition-all flex items-center gap-4">
                        <div className="bg-violet-100/50 text-violet-600 w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Efficiency</p>
                            <h3 className="text-lg print:text-base font-black tracking-tight">{formatMoney(Math.round(stats.revenuePerKw || 0))}</h3>
                        </div>
                    </div>
                    <div className="bg-white p-4 print:p-3 rounded-2xl border border-slate-100 shadow-sm transition-all flex items-center gap-4">
                        <div className="bg-orange-100/50 text-orange-600 w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                            <Zap className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Avg Ticket</p>
                            <h3 className="text-lg print:text-base font-black tracking-tight">{formatMoney(Math.round(stats.avgTicket || 0))}</h3>
                        </div>
                    </div>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:gap-4">
                    <div className="lg:col-span-2 space-y-6 print:space-y-4">
                        
                        {/* Timeline */}
                        <div className="bg-white p-6 print:p-4 rounded-2xl border border-slate-100 shadow-sm h-[300px] print:h-[220px] flex flex-col">
                            <h3 className="text-sm font-bold flex items-center gap-2 mb-2 uppercase tracking-wider text-slate-400 shrink-0">
                                <Activity className="text-blue-500 w-4 h-4" /> Revenue Flux
                            </h3>
                            <div className="flex-1 relative w-full h-full">
                                <Line 
                                    data={{
                                        labels: stats.timeline.map(d => d.date.split('-').slice(1).join('/')),
                                        datasets: [{
                                            data: stats.timeline.map(d => d.revenue),
                                            borderColor: '#3b82f6',
                                            backgroundColor: (context) => {
                                                const chart = context.chart;
                                                const {ctx, chartArea} = chart;
                                                if (!chartArea) return 'rgba(59, 130, 246, 0.2)';
                                                const gradient = ctx.createLinearGradient(0, 0, 0, chartArea.bottom);
                                                gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
                                                gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
                                                return gradient;
                                            },
                                            borderWidth: 2,
                                            pointBackgroundColor: '#3b82f6',
                                            pointBorderColor: '#fff',
                                            pointRadius: 4,
                                            fill: true,
                                            tension: 0.4
                                        }]
                                    }}
                                    options={{
                                        layout: { padding: { top: 20, right: 10 } },
                                        responsive: true, maintainAspectRatio: false,
                                        plugins: { 
                                            legend: { display: false }, 
                                            tooltip: { callbacks: { label: (ctx) => formatMoney(ctx.raw as number) } },
                                            datalabels: {
                                                align: 'top',
                                                anchor: 'end',
                                                offset: 2,
                                                formatter: (val) => val > 0 ? (val/1000).toFixed(0) + 'k' : '',
                                                color: '#3b82f6',
                                                font: { size: 9, weight: 'bold' }
                                            }
                                        },
                                        scales: { 
                                            x: { grid: { display: false } }, 
                                            y: { ticks: { callback: (val) => '₹' + (Number(val)/1000) + 'k' }, border: {display: false} }
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 print:gap-4">
                            <div className="bg-white p-6 print:p-4 rounded-2xl border border-slate-100 shadow-sm h-[200px] print:h-[150px] flex flex-col">
                                <h3 className="text-[10px] font-black mb-2 flex items-center gap-2 text-slate-400 uppercase tracking-widest shrink-0">
                                    <BarChart3 className="w-3 h-3" /> Weekday Flow
                                </h3>
                                <div className="flex-1 relative w-full h-full">
                                    <Bar 
                                        data={{
                                            labels: stats.weekdayPerformance.map(d => d.name),
                                            datasets: [{
                                                data: stats.weekdayPerformance.map(d => d.revenue),
                                                backgroundColor: '#3b82f6',
                                                borderRadius: {topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0},
                                            }]
                                        }}
                                        options={{
                                            layout: { padding: { top: 20 } },
                                            responsive: true, maintainAspectRatio: false,
                                            plugins: { 
                                                legend: { display: false }, 
                                                tooltip: { callbacks: { label: (ctx) => formatMoney(ctx.raw as number) } },
                                                datalabels: {
                                                    align: 'top',
                                                    anchor: 'end',
                                                    formatter: (val) => val > 0 ? '₹' + (val/1000).toFixed(0) + 'k' : '',
                                                    color: '#3b82f6',
                                                    font: { size: 9, weight: 'bold' }
                                                }
                                            },
                                            scales: { x: { grid: { display: false }, border: {display:false} }, y: { display: false } }
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="bg-white p-6 print:p-4 rounded-2xl border border-slate-100 shadow-sm h-[200px] print:h-[150px] flex flex-col">
                                <h3 className="text-[10px] font-black mb-2 flex items-center gap-2 text-slate-400 uppercase tracking-widest shrink-0">
                                    <Package className="w-3 h-3" /> Capacity Segments
                                </h3>
                                <div className="flex-1 relative w-full h-full">
                                    <Doughnut 
                                        data={{
                                            labels: stats.capDist.map(d => d.name),
                                            datasets: [{
                                                data: stats.capDist.map(d => d.value),
                                                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
                                                borderWidth: 0,
                                            }]
                                        }}
                                        options={{
                                            responsive: true, maintainAspectRatio: false,
                                            cutout: '65%',
                                            plugins: { 
                                                legend: { display: false },
                                                tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw} units` } },
                                                datalabels: {
                                                    color: '#ffffff',
                                                    formatter: (val) => val > 0 ? val : '',
                                                    font: { size: 12, weight: 'bold' }
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Systems Sold by Executive Chart */}
                        <div className="bg-white p-6 print:p-4 rounded-2xl border border-slate-100 shadow-sm h-[220px] print:h-[160px] flex flex-col">
                            <h3 className="text-[10px] font-black mb-2 flex items-center gap-2 text-slate-400 uppercase tracking-widest shrink-0">
                                <Users className="w-3 h-3" /> Systems Sold by Executive
                            </h3>
                            <div className="flex-1 relative w-full h-full">
                                <Bar 
                                    data={{
                                        labels: [...stats.topSales].sort((a, b) => b.deals - a.deals).map(d => {
                                            let n = String(d.name || "").trim().split(/\s+/);
                                            return n.length > 1 && n[1] ? n[0] + ' ' + n[1][0] + '.' : n[0];
                                        }), 
                                        datasets: [{
                                            data: [...stats.topSales].sort((a, b) => b.deals - a.deals).map(d => d.deals),
                                            backgroundColor: '#8b5cf6',
                                            borderRadius: {topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0},
                                        }]
                                    }}
                                    options={{
                                        layout: { padding: { top: 20 } },
                                        responsive: true, maintainAspectRatio: false,
                                        plugins: { 
                                            legend: { display: false }, 
                                            tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw} Systems Sold` } },
                                            datalabels: {
                                                align: 'top',
                                                anchor: 'end',
                                                formatter: (val) => val > 0 ? val : '',
                                                color: '#8b5cf6',
                                                font: { size: 9, weight: 'bold' }
                                            }
                                        },
                                        scales: { 
                                            x: { grid: { display: false }, border: {display:false}, ticks: { font: { size: 9 } } }, 
                                            y: { display: true, grid: { color: '#f1f5f9' }, border: {display:false}, ticks: { stepSize: 1, font: { size: 9 } } } 
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Leaderboard */}
                    <div className="bg-white p-6 print:p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                        <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-slate-700">
                            <Award className="text-amber-500 w-4 h-4" /> Force Rankings
                        </h3>
                        <div className="space-y-2 flex-1 w-full overflow-y-auto custom-scrollbar print:max-h-none print:overflow-visible max-h-[750px]">
                            {stats.topSales.map((sp, i) => (
                                <div 
                                    key={i}
                                    onClick={() => setSelectedRep(selectedRep === sp.name ? null : sp.name)} 
                                    className={`group cursor-pointer p-2 rounded-xl transition-all border ${selectedRep === sp.name ? 'bg-blue-50 border-blue-200 shadow-sm' : 'border-slate-50 hover:border-slate-200'} print:p-1.5`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-slate-700">{sp.name}</span>
                                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 rounded-sm">{sp.deals} deals</span>
                                        </div>
                                        <span className="text-[10px] font-black text-blue-600">{formatMoney(sp.revenue)}</span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(sp.revenue / maxRev) * 100}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Audit Table */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden print:shadow-none">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10 print:p-2">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="text-emerald-500 w-5 h-5" />
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Enterprise Audit Register</h3>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">Total Records: <span className="text-slate-900">{stats.dealCount}</span> Visible</span>
                    </div>
                    <div className="overflow-x-auto w-full max-h-[600px] custom-scrollbar print:max-h-none print:overflow-visible">
                        <table className="w-full text-left table-fixed">
                            <thead className="bg-slate-50 text-[9px] uppercase text-slate-400 font-black sticky top-0 z-20">
                                <tr>
                                    <th className="px-4 py-2 w-1/3">Client Profile</th>
                                    <th className="px-4 py-2 w-1/4">Executive</th>
                                    <th className="px-4 py-2 w-1/6 text-center">kW</th>
                                    <th className="px-4 py-2 w-1/4 text-right">Invoice</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[10px]">
                                {stats.filteredData.map((item, i) => (
                                    <tr key={i} className="hover:bg-slate-50/80 transition-colors print:bg-white">
                                        <td className="px-4 py-1.5 border-b border-slate-50">
                                            <div className="font-bold text-slate-800 truncate">{item.customer}</div>
                                            <div className="text-[8px] text-slate-400">{item.mobile} • {item.date}</div>
                                        </td>
                                        <td className="px-4 py-1.5 border-b border-slate-50 font-semibold text-slate-600 truncate">{toTitleCase(item.salesperson)}</td>
                                        <td className="px-4 py-1.5 border-b border-slate-50 text-center font-black text-blue-600">{item.capacity}</td>
                                        <td className="px-4 py-1.5 border-b border-slate-50 text-right font-black text-slate-900">{formatMoney(item.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            <footer className="max-w-7xl mx-auto px-6 text-slate-400 text-[9px] font-bold uppercase tracking-[0.2em] mt-8 flex flex-col sm:flex-row justify-between items-center gap-4 print:mt-4 print:pb-4 print:flex-row">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1 font-black"><MapPin className="w-3 h-3" /> Regional Center</span>
                </div>
                <div className="flex items-center gap-6">
                    <span className="bg-white px-3 py-1 rounded-full border border-slate-200">CONFIDENTIAL • {selectedMonth === "All" ? "ALL TIME" : selectedMonth.toUpperCase()} AUDIT CYCLE</span>
                </div>
            </footer>

            {/* Sync Data Modal */}
            {isSyncModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md print:hidden">
                    <div className="bg-white rounded-[3rem] p-10 max-w-2xl w-full shadow-2xl border border-white/20">
                        <div className="flex justify-between items-start mb-8">
                            <h2 className="text-3xl font-black text-slate-900">Data Synchronization</h2>
                            <button onClick={() => setIsSyncModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <textarea 
                            value={syncInput}
                            onChange={(e) => setSyncInput(e.target.value)}
                            className="w-full h-48 bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-6 text-sm font-mono focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all mb-8" 
                            placeholder="Paste rows..."
                        />
                        <div className="flex justify-end gap-4">
                            <button onClick={() => setIsSyncModalOpen(false)} className="px-8 py-3 font-bold text-slate-400">Discard</button>
                            <button onClick={handleSyncData} className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-black">Sync Database Now</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
