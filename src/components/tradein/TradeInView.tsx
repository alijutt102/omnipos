import React, { useState, useEffect, useMemo } from 'react';
import { TradeIn, Customer, User } from '../../types.ts';
import { api } from '../../services/api.ts';
import {
  RefreshCw, Plus, CheckCircle2, AlertTriangle, ShieldCheck,
  Smartphone, Laptop, Cpu, DollarSign, ArrowRight, Tag,
  Clock, FileText, Check, Layers, Filter, Search, UserCheck
} from 'lucide-react';

interface TradeInViewProps {
  user: User;
  activeBranchId: string;
}

const CONDITION_GRADES = [
  { grade: 'A', title: 'Grade A - Like New', desc: 'Flawless condition, no scratches, works 100%', color: 'emerald' },
  { grade: 'B', title: 'Grade B - Good', desc: 'Minor marks or light scratches, fully working', color: 'blue' },
  { grade: 'C', title: 'Grade C - Fair', desc: 'Visible scratches or wear, but hardware works fine', color: 'amber' },
  { grade: 'D', title: 'Grade D - Damaged', desc: 'Cracked screen or physical damage, for parts or repair', color: 'rose' },
];

const DEFAULT_CHECKLIST = [
  { key: 'powers_on', label: 'Turns on and boots up normally' },
  { key: 'display_working', label: 'Screen is clean (no lines, spots, or cracks)' },
  { key: 'battery_health', label: 'Battery holds charge properly' },
  { key: 'ports_working', label: 'USB, display, and charging ports work' },
  { key: 'storage_health', label: 'Hard drive / SSD is in healthy condition' },
  { key: 'no_bios_lock', label: 'No password, BIOS lock, or iCloud lock' },
];

export const TradeInView: React.FC<TradeInViewProps> = ({ user, activeBranchId }) => {
  const [tradeIns, setTradeIns] = useState<TradeIn[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Intake Modal
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestIdNumber, setGuestIdNumber] = useState('');
  const [deviceType, setDeviceType] = useState('Laptop');
  const [brand, setBrand] = useState('Apple');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [specs, setSpecs] = useState('');
  const [conditionGrade, setConditionGrade] = useState<'A' | 'B' | 'C' | 'D'>('B');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    powers_on: true,
    display_working: true,
    battery_health: true,
    ports_working: true,
    storage_health: true,
    no_bios_lock: true,
  });
  const [valuationAmount, setValuationAmount] = useState<number>(350);
  const [resellEstimate, setResellEstimate] = useState<number>(550);
  const [payoutType, setPayoutType] = useState<'STORE_CREDIT' | 'CASH'>('STORE_CREDIT');
  const [notes, setNotes] = useState('');
  const [savingIntake, setSavingIntake] = useState(false);

  // Convert to Refurbished Product Modal
  const [convertingTrade, setConvertingTrade] = useState<TradeIn | null>(null);
  const [refurbProductName, setRefurbProductName] = useState('');
  const [refurbSellingPrice, setRefurbSellingPrice] = useState<number>(0);
  const [refurbWarrantyDays, setRefurbWarrantyDays] = useState<number>(90);
  const [convertingLoading, setConvertingLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeBranchId, statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tradeRes, custRes] = await Promise.all([
        api.getTradeIns({
          branch_id: activeBranchId || undefined,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
        }),
        api.getCustomers(),
      ]);
      setTradeIns(tradeRes.tradeIns || []);
      setCustomers(custRes.customers || []);
    } catch (err) {
      console.error('Failed to load trade-in data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingIntake(true);
    try {
      const payload = {
        branch_id: activeBranchId,
        customer_id: customerId || null,
        customer_name: customerId ? (customers.find((c) => c.id === customerId)?.name || 'Valued Customer') : guestName,
        customer_phone: customerId ? (customers.find((c) => c.id === customerId)?.phone || '') : guestPhone,
        customer_id_number: guestIdNumber,
        device_type: deviceType,
        brand,
        model,
        serial_number_imei: serialNumber,
        specs,
        condition_grade: conditionGrade,
        checklist,
        valuation_amount: valuationAmount,
        resell_estimate: resellEstimate,
        payout_type: payoutType,
        notes,
      };

      const res = await api.createTradeIn(payload);
      if (res.success) {
        setIsIntakeOpen(false);
        resetIntakeForm();
        await loadData();
      }
    } catch (err: any) {
      alert(`Failed to save trade-in intake: ${err.message || 'Error'}`);
    } finally {
      setSavingIntake(false);
    }
  };

  const resetIntakeForm = () => {
    setCustomerId('');
    setGuestName('');
    setGuestPhone('');
    setGuestIdNumber('');
    setModel('');
    setSerialNumber('');
    setSpecs('');
    setNotes('');
    setValuationAmount(350);
    setResellEstimate(550);
  };

  const handleUpdateStatus = async (tradeId: string, status: string) => {
    try {
      const res = await api.updateTradeIn(tradeId, { status });
      if (res.success) {
        await loadData();
      }
    } catch (err: any) {
      alert(`Error updating trade-in status: ${err.message || 'Failed'}`);
    }
  };

  const handleOpenConvert = (trade: TradeIn) => {
    setConvertingTrade(trade);
    setRefurbProductName(`Refurbished ${trade.brand || ''} ${trade.model || trade.device_type} (Grade ${trade.condition_grade})`);
    setRefurbSellingPrice(Number(trade.resell_estimate) || Number(trade.valuation_amount) * 1.4);
    setRefurbWarrantyDays(90);
  };

  const handleConfirmConvert = async () => {
    if (!convertingTrade) return;
    setConvertingLoading(true);
    try {
      const res = await api.convertTradeInToProduct(convertingTrade.id, {
        product_name: refurbProductName,
        selling_price: refurbSellingPrice,
        warranty_days: refurbWarrantyDays,
      });
      if (res.success) {
        alert(`Successfully added to inventory with SKU: ${res.sku}`);
        setConvertingTrade(null);
        await loadData();
      }
    } catch (err: any) {
      alert(`Error converting to product: ${err.message || 'Failed'}`);
    } finally {
      setConvertingLoading(false);
    }
  };

  const filteredTradeIns = useMemo(() => {
    if (!searchQuery.trim()) return tradeIns;
    const q = searchQuery.toLowerCase();
    return tradeIns.filter(
      (t) =>
        t.trade_number.toLowerCase().includes(q) ||
        t.customer_name.toLowerCase().includes(q) ||
        (t.brand && t.brand.toLowerCase().includes(q)) ||
        (t.model && t.model.toLowerCase().includes(q)) ||
        (t.serial_number_imei && t.serial_number_imei.toLowerCase().includes(q))
    );
  }, [tradeIns, searchQuery]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
              Customer Trade-Ins
            </span>
            <span className="text-xs text-slate-400">• Store credit & reselling used items</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-indigo-600" />
            Customer Trade-Ins & Used Items
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Buy used devices from customers, check their condition, pay with cash or store credit, and add them to your store stock.
          </p>
        </div>

        <button
          onClick={() => setIsIntakeOpen(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          <span>New Trade-In</span>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search trade #, customer, serial, or model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { key: 'ALL', label: 'All' },
            { key: 'RECEIVED', label: 'Received' },
            { key: 'INSPECTING', label: 'Checking' },
            { key: 'APPROVED', label: 'Approved' },
            { key: 'REFURBISHING', label: 'Cleaning & Testing' },
            { key: 'READY_FOR_SALE', label: 'Ready to Sell' },
          ].map((st) => (
            <button
              key={st.key}
              onClick={() => setStatusFilter(st.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === st.key
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trade-ins Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading trade-ins...</div>
        ) : filteredTradeIns.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No trade-in records found. Click "New Trade-In" to record a customer trade-in.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Trade #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Item</th>
                  <th className="py-3 px-4 text-center">Condition</th>
                  <th className="py-3 px-4 text-right">Offer Amount</th>
                  <th className="py-3 px-4 text-right">Est. Resell Price</th>
                  <th className="py-3 px-4 text-center">Payment</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTradeIns.map((t) => {
                  const marginPercent = t.resell_estimate > 0
                    ? Math.round(((t.resell_estimate - t.valuation_amount) / t.resell_estimate) * 100)
                    : 0;

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                        {t.trade_number}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{t.customer_name}</span>
                        {t.customer_phone && (
                          <span className="text-[10px] text-slate-400 block">{t.customer_phone}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 block">
                          {t.brand} {t.model || t.device_type}
                        </span>
                        {t.serial_number_imei && (
                          <span className="text-[10px] font-mono text-slate-500 block">
                            Serial: {t.serial_number_imei}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            t.condition_grade === 'A'
                              ? 'bg-emerald-100 text-emerald-800'
                              : t.condition_grade === 'B'
                              ? 'bg-blue-100 text-blue-800'
                              : t.condition_grade === 'C'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          Grade {t.condition_grade}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        ${Number(t.valuation_amount).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        <span>${Number(t.resell_estimate).toFixed(2)}</span>
                        <span className="text-[10px] text-emerald-600 block font-sans">
                          +{marginPercent}% profit
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.payout_type === 'STORE_CREDIT'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {t.payout_type === 'STORE_CREDIT' ? 'Store Credit' : 'Cash'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            t.status === 'READY_FOR_SALE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : t.status === 'REFURBISHING'
                              ? 'bg-blue-100 text-blue-800'
                              : t.status === 'APPROVED'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {t.status === 'READY_FOR_SALE'
                            ? 'Ready to Sell'
                            : t.status === 'REFURBISHING'
                            ? 'Cleaning & Testing'
                            : t.status === 'APPROVED'
                            ? 'Approved'
                            : t.status === 'INSPECTING'
                            ? 'Checking'
                            : 'Received'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {t.status === 'RECEIVED' && (
                            <button
                              onClick={() => handleUpdateStatus(t.id, 'APPROVED')}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          {t.status === 'APPROVED' && (
                            <button
                              onClick={() => handleUpdateStatus(t.id, 'REFURBISHING')}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                            >
                              Start Testing
                            </button>
                          )}
                          {(t.status === 'REFURBISHING' || t.status === 'APPROVED') && !t.refurbished_product_id && (
                            <button
                              onClick={() => handleOpenConvert(t)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                            >
                              <Tag className="w-3 h-3" />
                              <span>Put in Store</span>
                            </button>
                          )}
                          {t.refurbished_product_id && (
                            <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              In Store
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= INTAKE HARDWARE MODAL ================= */}
      {isIntakeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-indigo-600" />
                Customer Device Trade-In & Condition Check
              </h3>
              <button
                onClick={() => setIsIntakeOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateIntake} className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Customer Selector */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <label className="font-bold text-slate-800 block">Customer Details</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 bg-white"
                    >
                      <option value="">Choose Existing Customer or Walk-in</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.phone ? `(${c.phone})` : ''} - Credit: ${Number(c.store_credit || 0).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!customerId && (
                    <input
                      type="text"
                      placeholder="Walk-in Customer Name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      required={!customerId}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 bg-white"
                    />
                  )}
                </div>

                {!customerId && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Phone Number"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 bg-white"
                    />
                    <input
                      type="text"
                      placeholder="ID / License # (Optional)"
                      value={guestIdNumber}
                      onChange={(e) => setGuestIdNumber(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 bg-white"
                    />
                  </div>
                )}
              </div>

              {/* Hardware Device Spec */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Item Type</label>
                  <select
                    value={deviceType}
                    onChange={(e) => setDeviceType(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900"
                  >
                    <option value="Laptop">Laptop</option>
                    <option value="GPU">Graphics Card (GPU)</option>
                    <option value="Desktop">Desktop PC</option>
                    <option value="CPU">Processor (CPU)</option>
                    <option value="Monitor">Screen / Monitor</option>
                    <option value="Console">Console / Other</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Brand</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apple, ASUS, Dell"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Model Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MacBook Pro 14, ROG Zephyrus"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Serial Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="Device serial number or IMEI"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Specs (RAM, Storage, Processor)</label>
                  <input
                    type="text"
                    placeholder="e.g. 16GB RAM, 512GB SSD, Intel i7"
                    value={specs}
                    onChange={(e) => setSpecs(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              {/* Condition Grade */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">Device Condition</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CONDITION_GRADES.map((item) => (
                    <button
                      key={item.grade}
                      type="button"
                      onClick={() => setConditionGrade(item.grade as any)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        conditionGrade === item.grade
                          ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-bold text-xs block text-slate-900">Grade {item.grade}</span>
                      <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Functional Diagnostic Checklist */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <label className="font-bold text-slate-800 block mb-2">Testing Checklist</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {DEFAULT_CHECKLIST.map((item) => (
                    <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!checklist[item.key]}
                        onChange={(e) => setChecklist({ ...checklist, [item.key]: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-slate-700 text-xs">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Valuation & Resell Margin */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Amount to Pay Customer ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={valuationAmount}
                    onChange={(e) => setValuationAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Expected Resell Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={resellEstimate}
                    onChange={(e) => setResellEstimate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">How to Pay Customer</label>
                  <select
                    value={payoutType}
                    onChange={(e) => setPayoutType(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-semibold"
                  >
                    <option value="STORE_CREDIT">Store Credit</option>
                    <option value="CASH">Cash</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Notes (scratches, accessories, etc.)</label>
                <textarea
                  rows={2}
                  placeholder="Notes on physical condition, charger, box included, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsIntakeOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingIntake}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingIntake ? 'Saving...' : 'Confirm Trade-In & Pay Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= CONVERT TO REFURBISHED PRODUCT MODAL ================= */}
      {convertingTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-600" />
                Add Used Item to Store Inventory
              </h3>
              <button
                onClick={() => setConvertingTrade(null)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Product Name for Store</label>
                <input
                  type="text"
                  value={refurbProductName}
                  onChange={(e) => setRefurbProductName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Selling Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={refurbSellingPrice}
                    onChange={(e) => setRefurbSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-mono font-bold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Store Warranty (Days)</label>
                  <input
                    type="number"
                    value={refurbWarrantyDays}
                    onChange={(e) => setRefurbWarrantyDays(parseInt(e.target.value, 10) || 30)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Automatic Product Code & Stock Update
                </p>
                <p className="text-[11px] text-emerald-700">
                  This item will be added to your store products with a quantity of 1, marked as refurbished condition, and can be sold at the cash register.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConvertingTrade(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmConvert}
                  disabled={convertingLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {convertingLoading ? 'Adding...' : 'Add to Store Stock'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
