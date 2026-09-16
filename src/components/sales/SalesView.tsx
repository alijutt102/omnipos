import React, { useState, useEffect } from 'react';
import { Sale, User } from '../../types.ts';
import { api } from '../../services/api.ts';
import { Badge } from '../common/Badge.tsx';
import { InvoiceModal } from './InvoiceModal.tsx';
import { Modal } from '../common/Modal.tsx';
import {
  Receipt, Search, Eye, RotateCcw, AlertTriangle,
  Printer, DollarSign, Calendar, Building, CheckCircle2,
  FileText, Store, RefreshCw, Undo2, ArrowLeftRight
} from 'lucide-react';

interface SalesViewProps {
  user: User;
  activeBranchId: string;
  branches?: any[];
  onSelectBranch?: (branchId: string) => void;
  onNavigate?: (tab: string) => void;
}

export const SalesView: React.FC<SalesViewProps> = ({
  user,
  activeBranchId,
  branches = [],
  onSelectBranch,
  onNavigate,
}) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'returns'>('invoices');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranchId || 'ALL');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'ALL' | 'WALK_IN' | 'REGISTERED'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync selectedBranchId if activeBranchId changes externally
  useEffect(() => {
    if (activeBranchId) {
      setSelectedBranchId(activeBranchId);
    }
  }, [activeBranchId]);

  // Invoice Inspection Modal
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [salePayments, setSalePayments] = useState<any[]>([]);

  // Cancel / Void Modal
  const [cancellingSale, setCancellingSale] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Return / RMA Processing Modal
  const [returningSale, setReturningSale] = useState<Sale | null>(null);
  const [returnSaleItems, setReturnSaleItems] = useState<any[]>([]);
  const [selectedReturnItems, setSelectedReturnItems] = useState<{ [productId: string]: { selected: boolean; quantity: number; reason: string; condition: string } }>({});
  const [returnRefundMethod, setReturnRefundMethod] = useState<'Cash' | 'Bank Transfer' | 'Credit'>('Cash');
  const [returnGeneralReason, setReturnGeneralReason] = useState('Customer changed mind');
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);

  const loadData = async (branchToFetch?: string) => {
    setLoading(true);
    setErrorMessage(null);
    const targetBranch = branchToFetch !== undefined ? branchToFetch : selectedBranchId;
    const branchParam = targetBranch && targetBranch !== 'ALL' ? targetBranch : undefined;

    try {
      const [salesRes, returnsRes] = await Promise.all([
        api.getSales({ branch_id: branchParam }),
        api.getReturns(),
      ]);
      setSales(salesRes.sales || []);
      setReturnsList(returnsRes.returns || []);
    } catch (err: any) {
      console.error('Failed to load sales data:', err);
      setErrorMessage(err.message || 'Failed to fetch sales records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedBranchId);
  }, [selectedBranchId]);

  const handleInspectInvoice = async (saleId: string) => {
    try {
      const res = await api.getSaleDetails(saleId);
      setSelectedSale(res.sale);
      setSaleItems(res.items);
      setSalePayments(res.payments);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch invoice details');
    }
  };

  const handleOpenReturnModal = async (sale: Sale) => {
    try {
      const res = await api.getSaleDetails(sale.id);
      setReturningSale(sale);
      setReturnSaleItems(res.items);
      const initialMap: any = {};
      res.items.forEach((it: any) => {
        initialMap[it.product_id] = {
          selected: false,
          quantity: 1,
          reason: 'Customer changed mind',
          condition: 'GOOD',
        };
      });
      setSelectedReturnItems(initialMap);
    } catch (err: any) {
      alert(err.message || 'Failed to load items for return.');
    }
  };

  const handleProcessReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningSale) return;

    const itemsToReturn = returnSaleItems
      .filter((it) => selectedReturnItems[it.product_id]?.selected)
      .map((it) => {
        const conf = selectedReturnItems[it.product_id];
        return {
          product_id: it.product_id,
          quantity: conf.quantity,
          condition: conf.condition,
          reason: conf.reason,
          unit_price: Number(it.unit_price),
        };
      });

    if (itemsToReturn.length === 0) {
      alert('Please select at least one item to return.');
      return;
    }

    const calculatedRefund = itemsToReturn.reduce(
      (sum, it) => sum + it.unit_price * it.quantity,
      0
    );

    setIsProcessingReturn(true);
    try {
      await api.processReturn({
        sale_id: returningSale.id,
        branch_id: returningSale.branch_id,
        reason: returnGeneralReason,
        refund_amount: calculatedRefund,
        refund_method: returnRefundMethod,
        items: itemsToReturn,
      });

      alert(`Return processed successfully! Refund Amount: $${calculatedRefund.toFixed(2)}`);
      setReturningSale(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to process return.');
    } finally {
      setIsProcessingReturn(false);
    }
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingSale || !cancelReason.trim()) return;

    setIsCancelling(true);
    try {
      await api.cancelSale(cancellingSale.id, cancelReason);
      setCancellingSale(null);
      setCancelReason('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel invoice');
    } finally {
      setIsCancelling(false);
    }
  };

  const filtered = sales.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    const customer = (s.customer_name || 'Walk-in Retail Customer').toLowerCase();
    const invoiceMatches = s.invoice_number.toLowerCase().includes(q);
    const customerMatches = customer.includes(q);
    const cashierMatches = s.cashier_name && s.cashier_name.toLowerCase().includes(q);

    const matchesSearch = !q || invoiceMatches || customerMatches || cashierMatches;

    // Filter by branch
    const matchesBranch = !selectedBranchId || selectedBranchId === 'ALL' || s.branch_id === selectedBranchId;

    // Filter by payment status
    const matchesStatus = !statusFilter || statusFilter === 'ALL' || s.payment_status === statusFilter;

    // Filter by customer type
    const isWalkIn = !s.customer_name || s.customer_name.toLowerCase().includes('walk-in');
    const matchesCustType =
      customerTypeFilter === 'ALL'
        ? true
        : customerTypeFilter === 'WALK_IN'
        ? isWalkIn
        : !isWalkIn;

    return matchesSearch && matchesBranch && matchesStatus && matchesCustType;
  });

  const totalGrossRevenue = filtered.reduce((sum, s) => sum + Number(s.total || 0), 0);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans antialiased">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center">
              <Receipt className="w-5 h-5 text-indigo-600 mr-2" />
              Sales History & Returns
            </h2>
            <div className="bg-slate-100 p-1 rounded-xl flex space-x-1 text-xs">
              <button
                onClick={() => setActiveSubTab('invoices')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  activeSubTab === 'invoices'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sales & Receipts ({sales.length})
              </button>
              <button
                onClick={() => setActiveSubTab('returns')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  activeSubTab === 'returns'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Returns & Refunds ({returnsList.length})
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            View past sales, print receipt copies, and handle customer returns or refunds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeSubTab === 'invoices' && (
            <div className="text-right hidden sm:block">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Shown</span>
              <span className="font-mono text-sm font-extrabold text-slate-900">${totalGrossRevenue.toFixed(2)}</span>
            </div>
          )}
          {onNavigate && (
            <button
              onClick={() => onNavigate('pos')}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Launch Checkout"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Start New Sale</span>
            </button>
          )}
          <button
            onClick={loadData}
            title="Refresh List"
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Message Banner */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={loadData}
            className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold rounded-lg transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {activeSubTab === 'invoices' ? (
        <>
          {/* Search Bar & Comprehensive Filters */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Search invoice #, walk-in customer, cashier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-400/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Branch Filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                <Store className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={selectedBranchId}
                  onChange={(e) => {
                    const newB = e.target.value;
                    setSelectedBranchId(newB);
                    if (onSelectBranch && newB !== 'ALL') onSelectBranch(newB);
                  }}
                  className="bg-transparent text-slate-800 font-semibold focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Stores</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.branch_name} ({b.branch_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer Type Filter */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs">
                <button
                  onClick={() => setCustomerTypeFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    customerTypeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({sales.length})
                </button>
                <button
                  onClick={() => setCustomerTypeFilter('WALK_IN')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    customerTypeFilter === 'WALK_IN' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Walk-in
                </button>
                <button
                  onClick={() => setCustomerTypeFilter('REGISTERED')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    customerTypeFilter === 'REGISTERED' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Saved Accounts
                </button>
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Payment Statuses</option>
                <option value="PAID">Fully Paid</option>
                <option value="PARTIAL">Partially Paid</option>
                <option value="UNPAID">Not Paid Yet</option>
              </select>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Receipt #</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Store</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4 text-right">Total Price</th>
                    <th className="py-3 px-4 text-right">Paid</th>
                    <th className="py-3 px-4 text-right">Owed</th>
                    <th className="py-3 px-4">Paid?</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 font-sans text-xs">
                        Loading sales transactions...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 font-sans text-xs">
                        No sales invoices found matching filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {s.invoice_number}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-sans text-[11px]">
                          {new Date(s.sale_date).toLocaleDateString()} {new Date(s.sale_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-sans font-medium text-[11px]">
                          {s.branch_name}
                        </td>
                        <td className="py-3 px-4 font-sans">
                          {s.customer_name ? (
                            <div>
                              <span className="font-semibold text-slate-900 block">
                                {s.customer_name}
                              </span>
                              {s.customer_phone && (
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  {s.customer_phone}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-800">Walk-in Retail</span>
                              <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200/60">
                                POS
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                          ${Number(s.total).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-700 font-bold tabular-nums">
                          ${Number(s.paid_amount).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          {Number(s.balance_due) > 0 ? (
                            <span className="text-rose-700 font-bold">${Number(s.balance_due).toFixed(2)}</span>
                          ) : (
                            <span className="text-slate-400">$0.00</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <Badge status={s.payment_status} />
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <Badge status={s.sale_status} />
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 font-sans">
                          <button
                            onClick={() => handleInspectInvoice(s.id)}
                            className="inline-flex items-center px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                            title="View / Print Receipt"
                          >
                            <Printer className="w-3.5 h-3.5 mr-1" />
                            Print
                          </button>

                          {s.sale_status === 'COMPLETED' && (
                            <>
                              <button
                                onClick={() => handleOpenReturnModal(s)}
                                className="inline-flex items-center px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                title="Process RMA / Item Return"
                              >
                                <Undo2 className="w-3.5 h-3.5 mr-1 text-amber-600" />
                                Return
                              </button>

                              <button
                                onClick={() => setCancellingSale(s)}
                                className="inline-flex items-center px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                title="Void / Cancel Sale"
                              >
                                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                Void
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Returns Ledger */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                RMA Returns, Warranty Replacements & Refund Ledger
              </h3>
              <p className="text-[11px] text-slate-500">
                Audit trail of returned customer merchandise, inventory restock adjustments, and customer refund credits.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <th className="py-3 px-4">Return #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Original Invoice</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4 text-right">Refund Amount</th>
                  <th className="py-3 px-4">Refund Method</th>
                  <th className="py-3 px-4">Processed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {returnsList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-sans">
                      No returns recorded yet.
                    </td>
                  </tr>
                ) : (
                  returnsList.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-indigo-700">
                        {r.return_number}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-sans text-[11px]">
                        {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {r.invoice_number}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-700">
                        {r.branch_name}
                      </td>
                      <td className="py-3 px-4 font-sans font-semibold text-slate-800">
                        {r.customer_name || 'Walk-in Retail'}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-600">
                        {r.reason}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-700">
                        ${Number(r.refund_amount).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-200">
                          {r.refund_method}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-700">
                        {r.processed_by_name || 'Cashier'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Invoice & Receipt Viewer */}
      <InvoiceModal
        isOpen={Boolean(selectedSale)}
        onClose={() => setSelectedSale(null)}
        sale={selectedSale}
        items={saleItems}
        payments={salePayments}
        onNavigate={onNavigate}
      />

      {/* Modal: Process RMA / Sales Return */}
      {returningSale && (
        <Modal
          isOpen={Boolean(returningSale)}
          onClose={() => setReturningSale(null)}
          title={`Process Return: Invoice #${returningSale.invoice_number}`}
          subtitle="Select items to return, inspect condition, and issue refund or store credit"
          maxWidth="lg"
        >
          <form onSubmit={handleProcessReturnSubmit} className="space-y-4 text-xs font-sans">
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1 text-xs text-amber-900">
              <span className="font-bold block">Return Policy Verification:</span>
              <p>Items returned in 'GOOD' condition will be automatically restocked into active branch inventory. Serial numbers will be marked available.</p>
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-2">Select Items to Return from Invoice:</label>
              <div className="space-y-2 border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                {returnSaleItems.map((item) => {
                  const conf = selectedReturnItems[item.product_id] || { selected: false, quantity: 1, reason: 'Customer changed mind', condition: 'GOOD' };
                  return (
                    <div key={item.product_id} className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${conf.selected ? 'bg-indigo-50/40' : 'bg-white'}`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={conf.selected}
                          onChange={(e) => {
                            setSelectedReturnItems({
                              ...selectedReturnItems,
                              [item.product_id]: { ...conf, selected: e.target.checked },
                            });
                          }}
                          className="mt-1 w-4 h-4 rounded text-indigo-600 cursor-pointer"
                        />
                        <div>
                          <span className="font-bold text-slate-900 block">{item.product_name}</span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            SKU: {item.sku} • Purchased: {item.quantity} units @ ${Number(item.unit_price).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {conf.selected && (
                        <div className="flex items-center gap-2">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-semibold">Qty (Max {item.quantity}):</span>
                            <input
                              type="number"
                              min="1"
                              max={item.quantity}
                              value={conf.quantity === 0 ? '' : conf.quantity}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const v = e.target.value;
                                const val = v === '' ? 0 : Math.min(item.quantity, Math.max(1, parseInt(v, 10) || 1));
                                setSelectedReturnItems({
                                  ...selectedReturnItems,
                                  [item.product_id]: { ...conf, quantity: val },
                                });
                              }}
                              className="w-16 px-2 py-1 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-center"
                            />
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 block font-semibold">Condition:</span>
                            <select
                              value={conf.condition}
                              onChange={(e) => {
                                setSelectedReturnItems({
                                  ...selectedReturnItems,
                                  [item.product_id]: { ...conf, condition: e.target.value },
                                });
                              }}
                              className="px-2 py-1 border border-slate-300 rounded-lg text-slate-900"
                            >
                              <option value="GOOD">Good (Restock)</option>
                              <option value="DEFECTIVE">Defective (Quarantine)</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Return Reason *</label>
                <select
                  value={returnGeneralReason}
                  onChange={(e) => setReturnGeneralReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900"
                >
                  <option value="Customer changed mind">Customer changed mind</option>
                  <option value="Defective / Malfunctioning">Defective / Malfunctioning</option>
                  <option value="Wrong product delivered">Wrong product delivered</option>
                  <option value="Warranty claim replacement">Warranty claim replacement</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Refund Method *</label>
                <select
                  value={returnRefundMethod}
                  onChange={(e) => setReturnRefundMethod(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900"
                >
                  <option value="Cash">Cash (Cash Drawer Refund)</option>
                  <option value="Bank Transfer">Bank Transfer / Card Reversal</option>
                  <option value="Credit">Store Credit / Customer Account</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReturningSale(null)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessingReturn}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isProcessingReturn ? 'Processing Return...' : 'Confirm Return & Refund'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Cancel / Void Sale */}
      {cancellingSale && (
        <Modal
          isOpen={Boolean(cancellingSale)}
          onClose={() => setCancellingSale(null)}
          title={`Void Invoice #${cancellingSale.invoice_number}`}
          subtitle="This action will reverse inventory stock deductions and record a financial reversal."
          maxWidth="md"
        >
          <form onSubmit={handleConfirmCancel} className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Audit Warning</span>
                <p>Voiding this invoice will restore associated serialized hardware into stock and reverse cash/card reconciliation.</p>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Reason for Void / Cancellation *</label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Customer returned goods immediately, cashier barcode scanning error..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-hidden"
              />
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setCancellingSale(null)}
                className="px-3.5 py-1.5 text-slate-600 hover:text-slate-800 font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCancelling}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isCancelling ? 'Processing...' : 'Confirm Void Invoice'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
