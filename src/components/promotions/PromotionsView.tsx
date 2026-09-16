import React, { useState, useEffect } from 'react';
import { Promotion, User } from '../../types.ts';
import { api } from '../../services/api.ts';
import {
  Tag, Plus, Percent, DollarSign, Calendar, Copy, Check,
  Trash2, Power, AlertCircle, Sparkles, Search, Filter,
  TrendingUp, Clock, ShoppingCart, ArrowRight, ShieldAlert,
  HelpCircle, RefreshCw
} from 'lucide-react';

interface PromotionsViewProps {
  currentUser: User;
}

export function PromotionsView({ currentUser }: PromotionsViewProps) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Simulator State
  const [simulatorSubtotal, setSimulatorSubtotal] = useState<string>('250');
  const [simulatorCode, setSimulatorCode] = useState<string>('GAMING10');
  const [simulatorResult, setSimulatorResult] = useState<any>(null);
  const [simulatorLoading, setSimulatorLoading] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discount_type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
    discount_value: '10',
    min_order_amount: '0',
    max_discount_amount: '',
    valid_until: '',
    usage_limit: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const isManagerOrOwner =
    currentUser.role_name === 'TENANT_OWNER' ||
    currentUser.role_name === 'SUPER_ADMIN' ||
    currentUser.role_name === 'BRANCH_MANAGER';

  useEffect(() => {
    fetchPromotions();
  }, [statusFilter]);

  const fetchPromotions = async () => {
    setLoading(true);
    try {
      const res = await api.getPromotions(statusFilter);
      setPromotions(res.promotions || []);
    } catch (err) {
      console.error('Failed to load promotions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleToggleStatus = async (promo: Promotion) => {
    if (!isManagerOrOwner) return;
    const newStatus = promo.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.updatePromotion(promo.id, { status: newStatus });
      setPromotions((prev) =>
        prev.map((p) => (p.id === promo.id ? { ...p, status: newStatus } : p))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to toggle promotion status');
    }
  };

  const handleDelete = async (promo: Promotion) => {
    if (!isManagerOrOwner) return;
    if (!confirm(`Are you sure you want to delete coupon code "${promo.code}"?`)) return;
    try {
      await api.deletePromotion(promo.id);
      setPromotions((prev) => prev.filter((p) => p.id !== promo.id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete promotion');
    }
  };

  const handleCreatePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      await api.createPromotion({
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim(),
        discount_type: formData.discount_type,
        discount_value: Number(formData.discount_value),
        min_order_amount: Number(formData.min_order_amount) || 0,
        max_discount_amount: formData.max_discount_amount ? Number(formData.max_discount_amount) : undefined,
        valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : undefined,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit, 10) : undefined,
        status: formData.status,
      });

      setSuccessMsg(`Coupon code "${formData.code.toUpperCase()}" created successfully!`);
      setIsCreateModalOpen(false);
      setFormData({
        code: '',
        description: '',
        discount_type: 'PERCENTAGE',
        discount_value: '10',
        min_order_amount: '0',
        max_discount_amount: '',
        valid_until: '',
        usage_limit: '',
        status: 'ACTIVE',
      });
      fetchPromotions();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create promotion');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestSimulator = async () => {
    if (!simulatorCode.trim()) return;
    setSimulatorLoading(true);
    setSimulatorResult(null);
    try {
      const res = await api.validatePromotion({
        code: simulatorCode.trim().toUpperCase(),
        subtotal: Number(simulatorSubtotal) || 0,
      });
      setSimulatorResult(res);
    } catch (err: any) {
      setSimulatorResult({ valid: false, message: err.message || 'Failed to validate code' });
    } finally {
      setSimulatorLoading(false);
    }
  };

  // Filtered list
  const filteredPromotions = promotions.filter((p) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesCode = p.code.toLowerCase().includes(q);
      const matchesDesc = (p.description || '').toLowerCase().includes(q);
      if (!matchesCode && !matchesDesc) return false;
    }
    return true;
  });

  // KPIs
  const activeCount = promotions.filter((p) => p.status === 'ACTIVE').length;
  const totalRedemptions = promotions.reduce((sum, p) => sum + (Number(p.times_used) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg">
              <Tag className="w-5 h-5 text-indigo-400" />
            </span>
            <h1 className="text-2xl font-bold text-slate-100">Promotions & Coupons</h1>
          </div>
          <p className="text-slate-400 text-sm">
            Manage discount vouchers, percentage promotional campaigns, and cashier redemption rules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPromotions}
            className="px-3.5 py-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {isManagerOrOwner && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium shadow-sm flex items-center gap-2 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Create Coupon
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Coupons</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Tag className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{activeCount}</p>
          <p className="text-xs text-slate-400 mt-1">Ready to redeem at checkout</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Redemptions</span>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-indigo-600 mt-2">{totalRedemptions}</p>
          <p className="text-xs text-slate-400 mt-1">Times used across all stores</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Campaigns</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{promotions.length}</p>
          <p className="text-xs text-slate-400 mt-1">Configured promo codes</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">POS Integration</span>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <ShoppingCart className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2">Active</p>
          <p className="text-xs text-slate-400 mt-1">Cashiers can scan / enter codes</p>
        </div>
      </div>

      {/* Main Content Layout: Promo List + Quick Coupon Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Promotions List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search promo code or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
              {['ALL', 'ACTIVE', 'INACTIVE'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    statusFilter === status
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Cards Grid */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading promotion campaigns...
            </div>
          ) : filteredPromotions.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
              <Tag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-700 font-medium">No promotions found</p>
              <p className="text-xs text-slate-400 mt-1">Create a new coupon code to reward your customers.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPromotions.map((promo) => {
                const isPercentage = promo.discount_type === 'PERCENTAGE';
                const isExpired = promo.valid_until && new Date(promo.valid_until) < new Date();
                const isActive = promo.status === 'ACTIVE' && !isExpired;

                return (
                  <div
                    key={promo.id}
                    className={`bg-white rounded-xl border p-5 transition-all shadow-sm relative flex flex-col justify-between ${
                      isActive ? 'border-slate-200 hover:border-indigo-300' : 'border-slate-200 bg-slate-50/50 opacity-75'
                    }`}
                  >
                    <div>
                      {/* Top Row: Code Badge & Status */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg flex items-center gap-1.5">
                            {promo.code}
                            <button
                              onClick={() => handleCopyCode(promo.code)}
                              title="Copy promo code"
                              className="text-indigo-400 hover:text-indigo-600 transition-colors p-0.5"
                            >
                              {copiedCode === promo.code ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </span>
                        </div>

                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                            isExpired
                              ? 'bg-rose-100 text-rose-700'
                              : promo.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isExpired ? 'Expired' : promo.status}
                        </span>
                      </div>

                      {/* Discount Highlight */}
                      <div className="flex items-baseline gap-1.5 mb-2">
                        <span className="text-2xl font-extrabold text-slate-900">
                          {isPercentage ? `${promo.discount_value}%` : `$${promo.discount_value}`}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 uppercase">
                          {isPercentage ? 'Discount Off' : 'Flat Off'}
                        </span>
                        {promo.max_discount_amount && isPercentage && (
                          <span className="text-xs text-slate-400 ml-1">
                            (Max ${promo.max_discount_amount})
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-600 line-clamp-2 mb-3 min-h-[32px]">
                        {promo.description || 'General store promotional discount.'}
                      </p>

                      {/* Rules & Conditions */}
                      <div className="space-y-1.5 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mb-4">
                        <div className="flex items-center justify-between">
                          <span>Min Spend:</span>
                          <span className="font-semibold text-slate-700">
                            {Number(promo.min_order_amount) > 0 ? `$${promo.min_order_amount}` : 'None ($0)'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span>Usage / Redemptions:</span>
                          <span className="font-semibold text-slate-700">
                            {promo.times_used || 0} {promo.usage_limit ? `/ ${promo.usage_limit}` : 'used'}
                          </span>
                        </div>

                        {promo.valid_until && (
                          <div className="flex items-center justify-between">
                            <span>Valid Until:</span>
                            <span className={`font-semibold ${isExpired ? 'text-rose-600' : 'text-slate-700'}`}>
                              {new Date(promo.valid_until).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    {isManagerOrOwner && (
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <button
                          onClick={() => handleToggleStatus(promo)}
                          className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                            promo.status === 'ACTIVE'
                              ? 'text-amber-700 hover:bg-amber-50'
                              : 'text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                          {promo.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                        </button>

                        <button
                          onClick={() => {
                            setSimulatorCode(promo.code);
                            handleTestSimulator();
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                        >
                          Test in Simulator
                        </button>

                        <button
                          onClick={() => handleDelete(promo)}
                          className="text-xs text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                          title="Delete coupon"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 1 Col: Live Coupon Validator / Simulator & Tips */}
        <div className="space-y-4">
          {/* Coupon Simulator */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md">
                <Sparkles className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-slate-800 text-sm">Coupon Simulator & Verification</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Test any coupon code against an order amount to verify discount calculations before customer checkout.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Cart Subtotal ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    value={simulatorSubtotal}
                    onChange={(e) => setSimulatorSubtotal(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    placeholder="250"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Coupon Code</label>
                <input
                  type="text"
                  value={simulatorCode}
                  onChange={(e) => setSimulatorCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono uppercase font-bold text-indigo-700"
                  placeholder="GAMING10"
                />
              </div>

              <button
                onClick={handleTestSimulator}
                disabled={simulatorLoading}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                {simulatorLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5" />
                )}
                Verify & Calculate Discount
              </button>

              {/* Simulator Result Box */}
              {simulatorResult && (
                <div
                  className={`mt-3 p-3 rounded-lg text-xs border ${
                    simulatorResult.valid
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    {simulatorResult.valid ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>{simulatorResult.valid ? 'Valid Coupon' : 'Validation Error'}</span>
                  </div>

                  <p className="text-xs mb-2">{simulatorResult.message}</p>

                  {simulatorResult.valid && (
                    <div className="space-y-1 bg-white/70 p-2 rounded border border-emerald-200/50 font-mono text-[11px]">
                      <div className="flex justify-between">
                        <span>Original:</span>
                        <span>${Number(simulatorSubtotal).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Discount:</span>
                        <span>-${Number(simulatorResult.discount_amount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-t border-emerald-200 pt-1 font-bold text-slate-900">
                        <span>Payable Subtotal:</span>
                        <span>${Number(simulatorResult.final_subtotal).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tips Box */}
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-900">
            <div className="flex items-center gap-1.5 font-bold mb-2">
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              <span>Cashier Checkout Tips</span>
            </div>
            <ul className="space-y-1.5 text-indigo-800/90 list-disc list-inside">
              <li>Cashiers can enter coupon codes right in the <strong>Cashier Checkout</strong> screen before finalizing the payment.</li>
              <li>Percentage coupons can have an optional maximum dollar cap to safeguard profit margins.</li>
              <li>Coupons automatically increment their usage count upon invoice completion.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Create Coupon Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Tag className="w-5 h-5" />
                </span>
                <h3 className="text-lg font-bold text-slate-900">Create New Promotion</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreatePromotion} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Coupon Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. SUMMER15"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold uppercase text-indigo-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Discount Type
                  </label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="PERCENTAGE">Percentage (%) Off</option>
                    <option value="FIXED">Fixed Dollar ($) Off</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Marketing Campaign
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. 10% off for gaming PC bundles"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Discount Value <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                      {formData.discount_type === 'PERCENTAGE' ? '%' : '$'}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.discount_value}
                      onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                      placeholder="10"
                      className="w-full pl-7 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Minimum Order Amount ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.min_order_amount}
                      onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value })}
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Discount Cap ($) <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.max_discount_amount}
                    onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value })}
                    placeholder="No cap"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Usage Limit <span className="text-slate-400 font-normal">(Max uses)</span>
                  </label>
                  <input
                    type="number"
                    value={formData.usage_limit}
                    onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                    placeholder="Unlimited"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expiry Date <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ACTIVE">Active (Immediate)</option>
                    <option value="INACTIVE">Inactive (Draft)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 text-sm font-medium rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-sm flex items-center gap-2"
                >
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Save Promotion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
