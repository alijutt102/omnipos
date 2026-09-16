import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { DashboardMetrics, Branch, User } from '../../types.ts';
import {
  DollarSign, TrendingUp, TrendingDown, Package, AlertTriangle,
  Receipt, ShoppingBag, ShieldCheck, ArrowUpRight, ArrowDownRight,
  Calendar, Building, RefreshCw, BarChart3, CreditCard, ArrowRight,
  Users, CheckCircle2, Store
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';

interface DashboardViewProps {
  user: User;
  activeBranchId: string;
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  activeBranchId,
  onNavigate,
}) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [salesTrend, setSalesTrend] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [branchComparison, setBranchComparison] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('all');
  const [loading, setLoading] = useState(true);

  // User-defined Low Stock Threshold (synced with Inventory module via localStorage & events)
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('erp_low_stock_threshold');
    return saved ? Math.max(1, parseInt(saved, 10) || 5) : 5;
  });
  const [isEditingThreshold, setIsEditingThreshold] = useState(false);
  const [tempThreshold, setTempThreshold] = useState<number>(lowStockThreshold);

  useEffect(() => {
    loadDashboardData();

    const handleThresholdChange = () => {
      const saved = localStorage.getItem('erp_low_stock_threshold');
      const val = saved ? Math.max(1, parseInt(saved, 10) || 5) : 5;
      setLowStockThreshold(val);
      setTempThreshold(val);
    };

    window.addEventListener('low_stock_threshold_changed', handleThresholdChange);
    window.addEventListener('storage', handleThresholdChange);
    return () => {
      window.removeEventListener('low_stock_threshold_changed', handleThresholdChange);
      window.removeEventListener('storage', handleThresholdChange);
    };
  }, [activeBranchId, timeRange, lowStockThreshold]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const res = await api.getDashboard({
        branch_id: activeBranchId || undefined,
        range: timeRange,
        low_stock_threshold: lowStockThreshold,
      });
      const normalizedTrend = (res.salesTrend || []).map((t: any) => ({
        date: t.date_label || t.date,
        revenue: Number(t.daily_sales || t.revenue || 0),
        transactions: t.transactions,
      }));
      const normalizedTop = (res.topProducts || []).map((p: any) => ({
        product_name: p.product_name,
        total_sold: p.units_sold || p.total_sold || 0,
        total_revenue: Number(p.revenue || p.total_revenue || 0),
      }));
      setMetrics(res.metrics);
      setLowStockItems(res.lowStockItems || []);
      setSalesTrend(normalizedTrend);
      setTopProducts(normalizedTop);
      setBranchComparison(res.branchComparison || []);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateThreshold = (newVal: number) => {
    const val = Math.max(1, newVal);
    setLowStockThreshold(val);
    setTempThreshold(val);
    localStorage.setItem('erp_low_stock_threshold', val.toString());
    window.dispatchEvent(new Event('low_stock_threshold_changed'));
    setIsEditingThreshold(false);
  };

  const isOwner = user.role_name === 'TENANT_OWNER' || user.role_name === 'SUPER_ADMIN';

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans antialiased">
      {/* Top Header & Range Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              {isOwner && !activeBranchId ? 'All Stores Overview' : 'Store Dashboard & Daily Numbers'}
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold">
              ● Live Sync
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Live sales numbers, profit, inventory stock value, and store alerts.
          </p>
        </div>

        <div className="flex items-center space-x-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200/70">
          {(['today', 'week', 'month', 'year', 'all'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                timeRange === r
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {r === 'all' ? 'All Time' : r}
            </button>
          ))}
          <button
            onClick={loadDashboardData}
            title="Refresh Data"
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Visual Low Stock Alert Banner (Triggered by user-defined threshold) */}
      {Number(metrics?.lowStockCount || 0) > 0 && (
        <div className="bg-amber-50/90 border-2 border-amber-300/80 rounded-2xl p-4 sm:p-5 shadow-xs transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-amber-950">
                    Low Stock Alert: {metrics?.lowStockCount} items running low (≤ {lowStockThreshold} in stock)
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                    Action Required
                  </span>
                </div>
                <p className="text-xs text-amber-800 mt-0.5">
                  These items are running out. Reorder from your suppliers soon so you don't run out of stock.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              {/* Threshold Quick Tuner */}
              <div className="flex items-center bg-white/90 border border-amber-300 rounded-xl px-2.5 py-1.5 text-xs text-amber-950 shadow-2xs">
                <span className="text-slate-500 mr-1.5 font-medium">Alert When Below:</span>
                {isEditingThreshold ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={tempThreshold}
                      onChange={(e) => setTempThreshold(parseInt(e.target.value, 10) || 1)}
                      className="w-12 px-1 py-0.5 bg-amber-50 border border-amber-400 rounded text-center font-bold text-xs"
                      autoFocus
                    />
                    <button
                      onClick={() => handleUpdateThreshold(tempThreshold)}
                      className="px-2 py-0.5 bg-amber-600 text-white rounded text-[11px] font-bold hover:bg-amber-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditingThreshold(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditingThreshold(true)}
                    className="font-bold text-amber-900 hover:underline flex items-center gap-1 cursor-pointer"
                    title="Click to change low stock limit"
                  >
                    <span>{lowStockThreshold} units</span>
                    <span className="text-[10px] text-amber-700 font-normal bg-amber-100 px-1.5 py-0.5 rounded">Change</span>
                  </button>
                )}
              </div>

              <button
                onClick={() => onNavigate('inventory')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <span>View in Inventory</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick List of Affected Products */}
          {lowStockItems.length > 0 && (
            <div className="mt-3.5 pt-3 border-t border-amber-200/80 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-amber-900">Running Low:</span>
              {lowStockItems.slice(0, 6).map((item: any) => {
                const isOut = Number(item.current_stock) <= 0;
                return (
                  <div
                    key={item.id}
                    onClick={() => onNavigate('inventory')}
                    className="flex items-center gap-1.5 bg-white/95 border border-amber-200/90 rounded-lg px-2.5 py-1 text-xs cursor-pointer hover:border-amber-400 transition-colors shadow-2xs"
                    title="Click to view and adjust in inventory"
                  >
                    <span className="font-semibold text-slate-900 max-w-[150px] truncate">{item.product_name}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                        isOut ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.current_stock} {item.unit || 'pcs'}
                    </span>
                  </div>
                );
              })}
              {lowStockItems.length > 6 && (
                <button
                  onClick={() => onNavigate('inventory')}
                  className="text-xs text-amber-800 font-semibold hover:underline"
                >
                  +{lowStockItems.length - 6} more in inventory →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Total Sales */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Sales</span>
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tracking-tight tabular-nums">
              ${Number(metrics?.totalSales || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center text-xs text-slate-500 mt-1 font-mono">
              <Receipt className="w-3.5 h-3.5 mr-1 text-slate-400" />
              <span>{metrics?.salesCount || 0} receipts completed</span>
            </div>
          </div>
        </div>

        {/* Gross Profit */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Profit Made</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/80">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 tracking-tight tabular-nums">
              ${Number(metrics?.grossProfit || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-mono">
              Item Costs: ${Number(metrics?.totalCogs || 0).toFixed(0)}
            </div>
          </div>
        </div>

        {/* Operating Expenses */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bills & Expenses</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/80">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-bold font-mono text-amber-800 tracking-tight tabular-nums">
              ${Number(metrics?.totalExpenses || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Net Profit: <strong className="text-slate-800 font-mono">${Number(metrics?.netProfit || 0).toFixed(2)}</strong>
            </div>
          </div>
        </div>

        {/* Inventory Value */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Stock Value</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200/80">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tracking-tight tabular-nums">
              ${Number(metrics?.inventoryValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center text-xs mt-1">
              {Number(metrics?.lowStockCount || 0) > 0 ? (
                <button
                  onClick={() => onNavigate('inventory')}
                  className="text-amber-700 hover:text-amber-900 flex items-center font-semibold cursor-pointer hover:underline"
                  title="Click to view low stock items in inventory"
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-500 animate-pulse" />
                  {metrics?.lowStockCount} items ≤ {lowStockThreshold} units
                </button>
              ) : (
                <span className="text-emerald-700 font-semibold flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Healthy stock levels
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate('pos')}
          className="flex items-center justify-between p-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition-all cursor-pointer group"
        >
          <div className="text-left">
            <span className="block text-xs font-bold">Start Selling</span>
            <span className="text-[10px] text-slate-400">Go to checkout register</span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
        </button>

        <button
          onClick={() => onNavigate('serials')}
          className="flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-800 rounded-xl shadow-2xs transition-all cursor-pointer group"
        >
          <div className="text-left">
            <span className="block text-xs font-bold text-slate-900">Serial Numbers</span>
            <span className="text-[10px] text-slate-400">Track serials & warranties</span>
          </div>
          <ShieldCheck className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
        </button>

        <button
          onClick={() => onNavigate('transfers')}
          className="flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-800 rounded-xl shadow-2xs transition-all cursor-pointer group"
        >
          <div className="text-left">
            <span className="block text-xs font-bold text-slate-900">Move Between Stores</span>
            <span className="text-[10px] text-slate-400">Send items to another branch</span>
          </div>
          <Building className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
        </button>

        <button
          onClick={() => onNavigate('repairs')}
          className="flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-800 rounded-xl shadow-2xs transition-all cursor-pointer group"
        >
          <div className="text-left">
            <span className="block text-xs font-bold text-slate-900">Repairs & Fixes</span>
            <span className="text-[10px] text-slate-400">Customer device repair jobs</span>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
        </button>
      </div>

      {/* Analytical Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Revenue Trend Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Revenue & Volume Trend</h4>
              <p className="text-[11px] text-slate-400">Timeline of retail sales transactions</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesTrend}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Revenue']}
                  contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '12px', border: 'none', fontSize: '12px' }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Multi-Branch Revenue Comparison */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Store Location Performance</h4>
              <p className="text-[11px] text-slate-400">Compare sales across your different branches</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={branchComparison}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="branch_name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Sales']}
                  contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '12px', border: 'none', fontSize: '12px' }}
                />
                <Bar dataKey="total_sales" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Products Table & Accounts Receivables/Payables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Hardware Products */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Most Popular Products</h4>
            <span className="text-[10px] text-slate-400 font-mono">By units sold</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/70 text-slate-400 font-semibold text-[10px] uppercase">
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4 text-right">Units Sold</th>
                  <th className="py-3 px-4 text-right">Total Money Made</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {topProducts.map((tp, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">{tp.product_name}</td>
                    <td className="py-3 px-4 text-right text-slate-700">{tp.total_sold} units</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      ${Number(tp.total_revenue).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Working Capital Ledger: Receivables & Payables */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Money Owed & Unpaid Bills</h4>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600 font-medium">Money Owed by Customers:</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                ${Number(metrics?.totalReceivables || 0).toFixed(2)}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Credit or invoices that customers have not paid yet</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600 font-medium">Bills Owed to Suppliers:</span>
              <span className="font-mono font-bold text-rose-700 text-sm">
                ${Number(metrics?.totalPayables || 0).toFixed(2)}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Invoices you still need to pay to your distributors</p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => onNavigate('reports')}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              View Full Profit & Loss Report →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
