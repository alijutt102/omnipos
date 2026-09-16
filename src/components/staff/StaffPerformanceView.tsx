import React, { useState, useEffect, useMemo } from 'react';
import { StaffPerformance, StaffTarget, User } from '../../types.ts';
import { api } from '../../services/api.ts';
import {
  Award, TrendingUp, DollarSign, Target, Calendar,
  Users, CheckCircle2, Wrench, ShoppingBag, Edit,
  Save, ArrowUpRight, BarChart2, ShieldCheck
} from 'lucide-react';

interface StaffPerformanceViewProps {
  user: User;
  activeBranchId: string;
}

export const StaffPerformanceView: React.FC<StaffPerformanceViewProps> = ({
  user,
  activeBranchId,
}) => {
  const [monthPeriod, setMonthPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [performanceList, setPerformanceList] = useState<StaffPerformance[]>([]);
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Target Modal
  const [editingTargetUser, setEditingTargetUser] = useState<StaffPerformance | null>(null);
  const [targetSales, setTargetSales] = useState<number>(10000);
  const [salesCommRate, setSalesCommRate] = useState<number>(3.0);
  const [repairCommRate, setRepairCommRate] = useState<number>(15.0);
  const [savingTarget, setSavingTarget] = useState(false);

  useEffect(() => {
    loadPerformance();
  }, [monthPeriod, activeBranchId]);

  const loadPerformance = async () => {
    setLoading(true);
    try {
      const [perfRes, usersRes] = await Promise.all([
        api.getStaffPerformance(monthPeriod),
        api.getUsers(),
      ]);
      setPerformanceList(perfRes.performance || []);
      setStaffUsers(usersRes.users || []);
    } catch (err) {
      console.error('Failed to load staff performance:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditTarget = (perf: StaffPerformance) => {
    setEditingTargetUser(perf);
    setTargetSales(perf.sales_target || 10000);
    setSalesCommRate(perf.sales_commission_rate || 3.0);
    setRepairCommRate(perf.repair_commission_rate || 15.0);
  };

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTargetUser) return;
    setSavingTarget(true);
    try {
      const res = await api.saveStaffTarget({
        user_id: editingTargetUser.user_id,
        branch_id: activeBranchId || undefined,
        month_period: monthPeriod,
        sales_target: targetSales,
        sales_commission_rate: salesCommRate,
        repair_commission_rate: repairCommRate,
      });

      if (res.success) {
        setEditingTargetUser(null);
        await loadPerformance();
      }
    } catch (err: any) {
      alert(`Error saving target: ${err.message || 'Failed'}`);
    } finally {
      setSavingTarget(false);
    }
  };

  const totalTeamSales = useMemo(() => {
    return performanceList.reduce((acc, p) => acc + (p.actual_sales || 0), 0);
  }, [performanceList]);

  const totalTeamCommission = useMemo(() => {
    return performanceList.reduce((acc, p) => acc + (p.total_commission || 0), 0);
  }, [performanceList]);

  const totalRepairsCompleted = useMemo(() => {
    return performanceList.reduce((acc, p) => acc + (p.repair_count || 0), 0);
  }, [performanceList]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              Incentives & KPI Engine
            </span>
            <span className="text-xs text-slate-400">• Dynamic POS & Technician Commissions</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600" />
            Staff Sales Targets & Technician Commissions
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure monthly revenue quotas, automatically calculate retail sales percentages and repair labor commissions.
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
          <Calendar className="w-4 h-4 text-slate-500 ml-2" />
          <input
            type="month"
            value={monthPeriod}
            onChange={(e) => setMonthPeriod(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden pr-2 cursor-pointer"
          />
        </div>
      </div>

      {/* Aggregate KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Total Team Sales ({monthPeriod})
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              ${totalTeamSales.toFixed(2)}
            </span>
            <span className="text-xs text-emerald-600 font-bold flex items-center">
              <TrendingUp className="w-3 h-3 mr-0.5" /> Gross
            </span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Accrued Staff Commissions
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-indigo-700">
              ${totalTeamCommission.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400">Total Payout</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Workshop Repairs Completed
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {totalRepairsCompleted} Jobs
            </span>
            <span className="text-xs text-indigo-600 font-bold">Bench RMAs</span>
          </div>
        </div>
      </div>

      {/* Staff Leaderboard & Targets Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              Staff Performance & Commission Roster
            </h3>
            <p className="text-xs text-slate-500">
              Individual target progress, commission rates, and calculated payouts for period {monthPeriod}.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading staff performance data...</div>
        ) : performanceList.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No active staff found for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Role / Branch</th>
                  <th className="py-3 px-4 text-center">Monthly Target</th>
                  <th className="py-3 px-4 text-center">Actual Sales</th>
                  <th className="py-3 px-4 w-44">Target Progress</th>
                  <th className="py-3 px-4 text-center">Repairs Done</th>
                  <th className="py-3 px-4 text-right">Commission Rate</th>
                  <th className="py-3 px-4 text-right">Earned Commission</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {performanceList.map((p) => {
                  const isTechnician = p.role.toUpperCase().includes('TECH');

                  return (
                    <tr key={p.user_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{p.name}</span>
                        <span className="text-[10px] text-slate-400">{p.email}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {p.role}
                        </span>
                        {p.branch_name && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">{p.branch_name}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                        ${Number(p.sales_target).toFixed(0)}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-indigo-900">
                        ${Number(p.actual_sales).toFixed(2)} ({p.sales_count} sales)
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span className="font-semibold text-slate-600">{p.progress_percent}% of Quota</span>
                            {p.progress_percent >= 100 && (
                              <span className="text-emerald-600 font-bold">Goal Hit!</span>
                            )}
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                p.progress_percent >= 100
                                  ? 'bg-emerald-500'
                                  : p.progress_percent >= 60
                                  ? 'bg-indigo-600'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.min(100, p.progress_percent)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-bold text-slate-800">
                          {p.repair_count} jobs
                        </span>
                        {p.labor_revenue > 0 && (
                          <span className="text-[10px] text-slate-400 block">
                            ${Number(p.labor_revenue).toFixed(0)} labor
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 text-[11px]">
                        <div>Sales: {p.sales_commission_rate}%</div>
                        <div>Labor: {p.repair_commission_rate}%</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 text-sm">
                        ${Number(p.total_commission).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenEditTarget(p)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ml-auto"
                        >
                          <Edit className="w-3 h-3" />
                          <span>Set Target</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= EDIT STAFF TARGET MODAL ================= */}
      {editingTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-600" />
                Configure Target & Commission Rates
              </h3>
              <button
                onClick={() => setEditingTargetUser(null)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSaveTarget} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                <span className="text-[10px] uppercase font-bold text-indigo-600 block">Staff Member</span>
                <span className="font-bold text-sm text-indigo-950">{editingTargetUser.name}</span>
                <span className="text-xs text-indigo-700 block">Role: {editingTargetUser.role} • Period: {monthPeriod}</span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Monthly Sales Revenue Target ($)
                </label>
                <input
                  type="number"
                  step="100"
                  required
                  value={targetSales}
                  onChange={(e) => setTargetSales(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    POS Sales Commission (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    required
                    value={salesCommRate}
                    onChange={(e) => setSalesCommRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Applied to retail items</span>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Repair Labor Commission (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    value={repairCommRate}
                    onChange={(e) => setRepairCommRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Applied to bench repair labor</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTargetUser(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTarget}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingTarget ? 'Saving...' : 'Save Target & Rates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
