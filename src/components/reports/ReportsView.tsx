import React, { useState, useEffect } from 'react';
import { User, Branch } from '../../types.ts';
import { api } from '../../services/api.ts';
import {
  FileText, TrendingUp, TrendingDown, DollarSign, Building,
  Printer, ArrowUpRight, BarChart3, PieChart
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend
} from 'recharts';

interface ReportsViewProps {
  user: User;
  activeBranchId: string;
}

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

export const ReportsView: React.FC<ReportsViewProps> = ({ user, activeBranchId }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, [activeBranchId]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const res = await api.getDashboard({ branch_id: activeBranchId || undefined });
      setData(res);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const metrics = data?.metrics || {};
  const totalSales = Number(metrics.totalSales || 0);
  const totalCogs = Number(metrics.totalCogs || 0);
  const grossProfit = Number(metrics.grossProfit || 0);
  const totalExpenses = Number(metrics.totalExpenses || 0);
  const netProfit = Number(metrics.netProfit || 0);
  const grossMarginPct = totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(1) : '0.0';
  const netMarginPct = totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) : '0.0';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <FileText className="w-6 h-6 text-indigo-600 mr-2" />
            Financial Reports & Profit Summary
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            See total sales, cost of goods, shop expenses, and overall profit across your stores.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          <Printer className="w-4 h-4 mr-1.5" />
          Print Report
        </button>
      </div>

      {/* P&L Statement Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Profit & Loss Summary
            </h3>
            <p className="text-[11px] text-slate-500">
              Clear breakdown of store earnings, item costs, and expenses
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-slate-500">
            Currency: USD ($)
          </span>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {/* Revenue */}
          <div className="flex justify-between items-center py-2 border-b border-slate-100 font-semibold text-sm text-slate-900">
            <span>Total Sales Revenue</span>
            <span className="font-mono text-base">${totalSales.toFixed(2)}</span>
          </div>

          {/* Cost of Goods Sold */}
          <div className="pl-4 space-y-2 text-slate-600 border-b border-slate-100 pb-3">
            <div className="flex justify-between items-center">
              <span>Minus: Cost of Items Sold (Purchase Cost)</span>
              <span className="font-mono text-rose-600 font-semibold">-${totalCogs.toFixed(2)}</span>
            </div>
          </div>

          {/* Gross Profit */}
          <div className="flex justify-between items-center py-2 bg-emerald-50/60 px-4 rounded-lg font-bold text-sm text-emerald-900">
            <span>Gross Profit (Sales minus Item Costs, Margin: {grossMarginPct}%)</span>
            <span className="font-mono text-base text-emerald-700">${grossProfit.toFixed(2)}</span>
          </div>

          {/* Operating Overhead Expenses */}
          <div className="pl-4 space-y-2 text-slate-600 border-b border-slate-100 pb-3 pt-2">
            <div className="flex justify-between items-center">
              <span>Minus: Shop Rent, Utilities & Other Expenses</span>
              <span className="font-mono text-amber-700 font-semibold">-${totalExpenses.toFixed(2)}</span>
            </div>
          </div>

          {/* Net Profit */}
          <div className="flex justify-between items-center py-3 bg-slate-900 px-4 rounded-lg font-bold text-sm text-white">
            <span className="flex items-center">
              NET PROFIT (Take-home profit after all costs, Margin: {netMarginPct}%)
            </span>
            <span className="font-mono text-lg text-emerald-400">
              ${netProfit.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Analytical Breakdown Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branch Profitability Comparison */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-slate-900">Sales Comparison by Store Location</h4>
            <p className="text-xs text-slate-500">Total sales across your active branches</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.branchComparison || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="branch_name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Amount']}
                  contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '8px', border: 'none', fontSize: '12px' }}
                />
                <Bar dataKey="total_sales" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Sales" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Product Revenue Contributors */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-slate-900">Top Selling Products</h4>
            <p className="text-xs text-slate-500">Products that generated the most sales revenue</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.topProducts || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis dataKey="product_name" type="category" width={110} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip
                  formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Revenue']}
                  contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '8px', border: 'none', fontSize: '12px' }}
                />
                <Bar dataKey="total_revenue" fill="#06b6d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
