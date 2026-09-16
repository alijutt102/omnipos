import React, { useState, useEffect } from 'react';
import { User, CashSession } from '../../types.ts';
import { api } from '../../services/api.ts';
import { Modal } from '../common/Modal.tsx';
import {
  Landmark, ArrowDownRight, ArrowUpRight, Plus, CheckCircle2,
  AlertTriangle, Clock, Calendar, RefreshCw, ShoppingBag, DollarSign,
  TrendingDown, TrendingUp, History, Lock, Unlock, Eye, FileText
} from 'lucide-react';

interface CashRegisterViewProps {
  user: User;
  activeBranchId: string;
  onNavigate?: (tab: string) => void;
}

export const CashRegisterView: React.FC<CashRegisterViewProps> = ({
  user,
  activeBranchId,
  onNavigate,
}) => {
  const [currentSession, setCurrentSession] = useState<any | null>(null);
  const [pastSessions, setPastSessions] = useState<any[]>([]);
  const [sessionTransactions, setSessionTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  // Modals
  const [isOpenShiftModal, setIsOpenShiftModal] = useState(false);
  const [openingAmount, setOpeningAmount] = useState<number>(100);
  const [openingNotes, setOpeningNotes] = useState('');

  const [isCloseShiftModal, setIsCloseShiftModal] = useState(false);
  const [closingAmount, setClosingAmount] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState('');

  const [isCashInOutModal, setIsCashInOutModal] = useState(false);
  const [cashTxType, setCashTxType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [cashTxAmount, setCashTxAmount] = useState<number>(0);
  const [cashTxDescription, setCashTxDescription] = useState('');

  const [inspectingSession, setInspectingSession] = useState<any | null>(null);
  const [inspectingTransactions, setInspectingTransactions] = useState<any[]>([]);
  const [loadingInspection, setLoadingInspection] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeBranchId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [curRes, histRes] = await Promise.all([
        api.getCurrentSession(),
        api.getCashSessions({ branch_id: activeBranchId || undefined }),
      ]);

      setCurrentSession(curRes.session);
      setPastSessions(histRes.sessions || []);

      if (curRes.session?.id) {
        const txRes = await api.getCashTransactions(curRes.session.id);
        setSessionTransactions(txRes.transactions || []);
      } else {
        setSessionTransactions([]);
      }
    } catch (err) {
      console.error('Failed to load cash register data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.openShift(openingAmount, openingNotes);
      setIsOpenShiftModal(false);
      setOpeningAmount(100);
      setOpeningNotes('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to open register shift.');
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return;
    try {
      const res = await api.closeShift(currentSession.id, closingAmount, closingNotes);
      setIsCloseShiftModal(false);
      setClosingAmount(0);
      setClosingNotes('');
      alert(`Shift successfully closed!\nActual Counted: $${res.actual.toFixed(2)}\nExpected Cash: $${res.expected.toFixed(2)}\nDiscrepancy: ${res.difference >= 0 ? '+' : ''}$${res.difference.toFixed(2)}`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to close register shift.');
    }
  };

  const handleRecordCashTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession || cashTxAmount <= 0) return;
    try {
      await api.recordCashTransaction({
        session_id: currentSession.id,
        type: cashTxType === 'DEPOSIT' ? 'DEPOSIT_CASH' : 'WITHDRAWAL_CASH',
        amount: cashTxAmount,
        description: cashTxDescription,
      });
      setIsCashInOutModal(false);
      setCashTxAmount(0);
      setCashTxDescription('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to record cash transaction.');
    }
  };

  const handleInspectSession = async (session: any) => {
    setInspectingSession(session);
    setLoadingInspection(true);
    try {
      const res = await api.getCashTransactions(session.id);
      setInspectingTransactions(res.transactions || []);
    } catch (err) {
      console.error('Failed to load inspection transactions:', err);
    } finally {
      setLoadingInspection(false);
    }
  };

  const expectedAmount = currentSession ? Number(currentSession.calculated_expected || currentSession.opening_amount || 0) : 0;
  const differenceClosing = closingAmount - expectedAmount;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <Landmark className="w-6 h-6 text-indigo-600 mr-2" />
            Cash Drawer & Shifts
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Count your starting cash in the morning, track money added or taken out, and count money when closing.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="bg-slate-200/80 p-1 rounded-xl flex space-x-1 text-xs">
            <button
              onClick={() => setActiveTab('current')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'current'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Current Shift
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Past Shifts ({pastSessions.length})
            </button>
          </div>

          <button
            onClick={loadData}
            className="p-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl transition-colors shadow-2xs cursor-pointer"
            title="Refresh Drawer Status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {activeTab === 'current' ? (
        <div className="space-y-6">
          {/* Active Shift Card or No Shift State */}
          {currentSession ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="px-6 py-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm tracking-tight text-white">
                        {currentSession.register_name || 'Register 01'} • SHIFT OPEN
                      </h3>
                      <span className="font-mono text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        OPEN
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      Cashier: <strong className="text-slate-200">{currentSession.cashier_name}</strong> • Opened: {new Date(currentSession.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(currentSession.opened_at).toLocaleDateString()})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setCashTxType('DEPOSIT');
                      setIsCashInOutModal(true);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Put Money In</span>
                  </button>
                  <button
                    onClick={() => {
                      setCashTxType('WITHDRAWAL');
                      setIsCashInOutModal(true);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                    <span>Take Money Out</span>
                  </button>
                  <button
                    onClick={() => {
                      setClosingAmount(expectedAmount);
                      setIsCloseShiftModal(true);
                    }}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Count & Close Shift</span>
                  </button>
                </div>
              </div>

              {/* Shift Metrics Breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 p-4 bg-slate-50/50">
                <div className="p-3">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Starting Cash</span>
                  <span className="font-mono text-lg font-bold text-slate-900">${Number(currentSession.opening_amount).toFixed(2)}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Morning drawer money</span>
                </div>

                <div className="p-3">
                  <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">+ Cash Sales</span>
                  <span className="font-mono text-lg font-bold text-emerald-700">${Number(currentSession.cash_sales || 0).toFixed(2)}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Sales paid in cash</span>
                </div>

                <div className="p-3">
                  <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">+ Added Money</span>
                  <span className="font-mono text-lg font-bold text-emerald-700">${Number(currentSession.cash_deposits || 0).toFixed(2)}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Cash added for change</span>
                </div>

                <div className="p-3">
                  <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider block">- Small Expenses</span>
                  <span className="font-mono text-lg font-bold text-rose-700">${Number(currentSession.cash_expenses || 0).toFixed(2)}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Store bills paid</span>
                </div>

                <div className="p-3">
                  <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider block">- Taken Out</span>
                  <span className="font-mono text-lg font-bold text-rose-700">${(Number(currentSession.cash_withdrawals || 0) + Number(currentSession.cash_refunds || 0)).toFixed(2)}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Put in safe or refunded</span>
                </div>

                <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100">
                  <span className="text-[11px] font-extrabold text-indigo-900 uppercase tracking-wider block">Expected In Drawer</span>
                  <span className="font-mono text-xl font-extrabold text-indigo-700">${expectedAmount.toFixed(2)}</span>
                  <span className="text-[10px] text-indigo-600 font-semibold block mt-0.5">Should match your count</span>
                </div>
              </div>

              {/* Transactions in this shift */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Real-time Shift Cash Drawer Movements</span>
                  </h4>
                  <span className="text-xs text-slate-400 font-mono">
                    {sessionTransactions.length} event(s) recorded
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                        <th className="py-2.5 px-3">Time</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3">Reference / Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-xs">
                      {sessionTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400 font-sans">
                            No cash transactions recorded in this shift yet.
                          </td>
                        </tr>
                      ) : (
                        sessionTransactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 text-slate-600 font-sans text-[11px]">
                              {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              {tx.transaction_type === 'SALE_CASH' && (
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                                  Cash Sale
                                </span>
                              )}
                              {tx.transaction_type === 'DEPOSIT_CASH' && (
                                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200">
                                  Cash In / Deposit
                                </span>
                              )}
                              {tx.transaction_type === 'EXPENSE_CASH' && (
                                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold text-[10px] border border-rose-200">
                                  Cash Expense
                                </span>
                              )}
                              {tx.transaction_type === 'WITHDRAWAL_CASH' && (
                                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold text-[10px] border border-amber-200">
                                  Cash Out / Drop
                                </span>
                              )}
                              {tx.transaction_type === 'REFUND_CASH' && (
                                <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold text-[10px] border border-purple-200">
                                  Cash Refund
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold tabular-nums">
                              {tx.transaction_type.includes('SALE') || tx.transaction_type.includes('DEPOSIT') ? (
                                <span className="text-emerald-700">+${Number(tx.amount).toFixed(2)}</span>
                              ) : (
                                <span className="text-rose-700">-${Number(tx.amount).toFixed(2)}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 font-sans text-xs">
                              {tx.description || tx.reference_type || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
                <Lock className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-base font-bold text-slate-900">
                  Cash Drawer is Currently Closed
                </h3>
                <p className="text-xs text-slate-500">
                  To take cash payments at checkout and give change, open the cash drawer by entering your starting cash.
                </p>
              </div>
              <button
                onClick={() => setIsOpenShiftModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Unlock className="w-4 h-4" />
                <span>Open Cash Drawer</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* History & Audit Logs */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Past Cash Drawer Shifts
              </h3>
              <p className="text-[11px] text-slate-500">
                History of all opened shifts, starting cash, cash counted at closing, and any differences.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <th className="py-3 px-4">Register & Store</th>
                  <th className="py-3 px-4">Cashier</th>
                  <th className="py-3 px-4">Opened</th>
                  <th className="py-3 px-4">Closed</th>
                  <th className="py-3 px-4 text-right">Starting Cash</th>
                  <th className="py-3 px-4 text-right">Expected Cash</th>
                  <th className="py-3 px-4 text-right">Counted Cash</th>
                  <th className="py-3 px-4 text-right">Difference (+/-)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {pastSessions.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 font-sans">
                      No shift records found for this branch.
                    </td>
                  </tr>
                ) : (
                  pastSessions.map((s) => {
                    const diff = Number(s.difference || 0);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-sans">
                          <span className="font-bold text-slate-900 block">{s.register_name || 'Register 01'}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{s.branch_code || s.branch_name}</span>
                        </td>
                        <td className="py-3 px-4 font-sans font-semibold text-slate-800">
                          {s.cashier_name}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-sans text-[11px]">
                          {new Date(s.opened_at).toLocaleDateString()} {new Date(s.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-sans text-[11px]">
                          {s.closed_at ? (
                            `${new Date(s.closed_at).toLocaleDateString()} ${new Date(s.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          ) : (
                            <span className="text-emerald-600 font-bold">Currently Open</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          ${Number(s.opening_amount).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-indigo-950">
                          {s.expected_amount !== null ? `$${Number(s.expected_amount).toFixed(2)}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {s.closing_amount !== null ? `$${Number(s.closing_amount).toFixed(2)}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold font-mono">
                          {s.status === 'CLOSED' ? (
                            diff === 0 ? (
                              <span className="text-emerald-600 font-bold">$0.00 (Balanced)</span>
                            ) : diff > 0 ? (
                              <span className="text-amber-600 font-bold">+${diff.toFixed(2)} (Over)</span>
                            ) : (
                              <span className="text-rose-600 font-bold">-${Math.abs(diff).toFixed(2)} (Short)</span>
                            )
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-sans">
                          {s.status === 'OPEN' ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-200">
                              Closed
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-sans">
                          <button
                            onClick={() => handleInspectSession(s)}
                            className="p-1.5 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                            title="Inspect Drawer Movements"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL: OPEN SHIFT ================= */}
      <Modal
        isOpen={isOpenShiftModal}
        onClose={() => setIsOpenShiftModal(false)}
        title="Open Cashier Shift Register"
        subtitle="Declare opening cash float in the physical drawer before starting transactions"
        maxWidth="md"
      >
        <form onSubmit={handleOpenShift} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Opening Cash Float Amount ($) *
            </label>
            <input
              required
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={openingAmount === 0 ? '' : openingAmount}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const v = e.target.value;
                setOpeningAmount(v === '' ? 0 : parseFloat(v) || 0);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold text-base"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Count all physical currency, bills, and coins placed into the drawer at the start of shift.
            </p>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Opening Shift Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Morning shift started by cashier, standard float verified."
              value={openingNotes}
              onChange={(e) => setOpeningNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsOpenShiftModal(false)}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs cursor-pointer"
            >
              Confirm & Open Shift
            </button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: CLOSE SHIFT ================= */}
      <Modal
        isOpen={isCloseShiftModal}
        onClose={() => setIsCloseShiftModal(false)}
        title="End Shift & Close Cash Register"
        subtitle="Perform physical cash count and reconcile drawer balance against POS records"
        maxWidth="md"
      >
        <form onSubmit={handleCloseShift} className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">System Calculated Expected Cash:</span>
              <span className="font-mono font-bold text-slate-900">${expectedAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200">
              <span className="text-slate-500">Difference (Actual - Expected):</span>
              <span className={`font-mono font-bold ${differenceClosing === 0 ? 'text-emerald-600' : differenceClosing > 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                {differenceClosing >= 0 ? '+' : ''}${differenceClosing.toFixed(2)}
              </span>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Actual Physical Counted Cash ($) *
            </label>
            <input
              required
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={closingAmount === 0 ? '' : closingAmount}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const v = e.target.value;
                setClosingAmount(v === '' ? 0 : parseFloat(v) || 0);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold text-base"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Closing Notes / Discrepancy Reason
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Count matched expected total. Handed over to night manager."
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCloseShiftModal(false)}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-xs cursor-pointer"
            >
              Finalize Shift Closure
            </button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: CASH IN / CASH OUT ================= */}
      <Modal
        isOpen={isCashInOutModal}
        onClose={() => setIsCashInOutModal(false)}
        title={cashTxType === 'DEPOSIT' ? 'Cash In (Deposit / Float Add)' : 'Cash Out (Safe Drop / Withdrawal)'}
        subtitle="Record manual physical drawer movement to maintain strict accounting precision"
        maxWidth="md"
      >
        <form onSubmit={handleRecordCashTx} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Transaction Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCashTxType('DEPOSIT')}
                className={`py-2 px-3 rounded-xl font-bold border transition-colors cursor-pointer ${
                  cashTxType === 'DEPOSIT'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                + Cash In (Deposit)
              </button>
              <button
                type="button"
                onClick={() => setCashTxType('WITHDRAWAL')}
                className={`py-2 px-3 rounded-xl font-bold border transition-colors cursor-pointer ${
                  cashTxType === 'WITHDRAWAL'
                    ? 'bg-amber-50 border-amber-500 text-amber-800'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                - Cash Out (Safe Drop)
              </button>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Amount ($) *</label>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={cashTxAmount === 0 ? '' : cashTxAmount}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const v = e.target.value;
                setCashTxAmount(v === '' ? 0 : parseFloat(v) || 0);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold text-base"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Description / Reason *</label>
            <input
              required
              type="text"
              placeholder={cashTxType === 'DEPOSIT' ? 'e.g. Mid-day change roll replenishment' : 'e.g. Excess cash drop to office safe'}
              value={cashTxDescription}
              onChange={(e) => setCashTxDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCashInOutModal(false)}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs cursor-pointer"
            >
              Record Movement
            </button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: INSPECT SESSION TRANSACTIONS ================= */}
      {inspectingSession && (
        <Modal
          isOpen={Boolean(inspectingSession)}
          onClose={() => setInspectingSession(null)}
          title={`Shift Inspection: ${inspectingSession.register_name || 'Register 01'} (${inspectingSession.cashier_name})`}
          subtitle={`Opened: ${new Date(inspectingSession.opened_at).toLocaleString()} • Status: ${inspectingSession.status}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block uppercase text-[10px]">Opening Float</span>
                <span className="font-mono font-bold text-slate-900 text-sm">${Number(inspectingSession.opening_amount).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[10px]">Actual Counted</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {inspectingSession.closing_amount !== null ? `$${Number(inspectingSession.closing_amount).toFixed(2)}` : 'In Progress'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[10px]">Discrepancy</span>
                <span className="font-mono font-bold text-sm">
                  {inspectingSession.difference !== null ? `$${Number(inspectingSession.difference).toFixed(2)}` : '-'}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {loadingInspection ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400 font-sans">
                        Loading drawer movements...
                      </td>
                    </tr>
                  ) : inspectingTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400 font-sans">
                        No transactions recorded for this shift.
                      </td>
                    </tr>
                  ) : (
                    inspectingTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-slate-600 font-sans text-[11px]">
                          {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <span className="font-semibold text-slate-800">{tx.transaction_type}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold tabular-nums">
                          ${Number(tx.amount).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-sans text-[11px]">
                          {tx.description || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {inspectingSession.notes && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-700">
                <span className="font-bold block text-[11px] text-slate-500 mb-0.5">Shift Notes & Observations:</span>
                <p className="text-xs">{inspectingSession.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
