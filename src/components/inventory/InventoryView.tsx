import React, { useState, useEffect } from 'react';
import { Product, StockMovement, User } from '../../types.ts';
import { api } from '../../services/api.ts';
import { Modal } from '../common/Modal.tsx';
import {
  Package, Search, Plus, SlidersHorizontal, AlertTriangle,
  History, ArrowUpDown, ShieldCheck, CheckCircle2, X, Trash2,
  Settings2, Check, RefreshCw, AlertCircle, Info, Sparkles
} from 'lucide-react';

interface InventoryViewProps {
  user: User;
  activeBranchId: string;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ user, activeBranchId }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [activeTab, setActiveTab] = useState<'catalog' | 'ledger'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // User-defined Low Stock Threshold (synced with dashboard via localStorage & custom events)
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('erp_low_stock_threshold');
    return saved ? Math.max(1, parseInt(saved, 10) || 5) : 5;
  });
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [isEditingThreshold, setIsEditingThreshold] = useState(false);
  const [tempThreshold, setTempThreshold] = useState<number>(lowStockThreshold);

  // New Product Modal
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);
  const [pSku, setPSku] = useState('');
  const [pBarcode, setPBarcode] = useState('');
  const [pName, setPName] = useState('');
  const [pCategory, setPCategory] = useState('');
  const [pBrand, setPBrand] = useState('');
  const [pCost, setPCost] = useState<number>(0);
  const [pPrice, setPPrice] = useState<number>(0);
  const [pWarranty, setPWarranty] = useState<number>(365);
  const [pReorder, setPReorder] = useState<number>(5);
  const [pSerialTracking, setPSerialTracking] = useState<boolean>(false);
  const [pInitialStock, setPInitialStock] = useState<number>(0);

  // Adjustment Modal
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjType, setAdjType] = useState('ADJUSTMENT_IN');
  const [adjQty, setAdjQty] = useState<number>(1);
  const [adjNotes, setAdjNotes] = useState('');
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);
  const [adjustmentFeedback, setAdjustmentFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Remove Product Modal
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
    loadCategories();
    loadBrands();
    if (activeTab === 'ledger') {
      loadMovements();
    }

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
  }, [activeBranchId, activeTab]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await api.getProducts({ branch_id: activeBranchId || undefined });
      setProducts(res.products);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await api.getCategories(activeBranchId || undefined);
      setCategories(res.categories);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const loadBrands = async () => {
    try {
      const res = await api.getBrands(activeBranchId || undefined);
      setBrands(res.brands);
    } catch (err) {
      console.error('Failed to load brands:', err);
    }
  };

  const loadMovements = async () => {
    try {
      const res = await api.getMovements({ branch_id: activeBranchId || undefined });
      setMovements(res.movements);
    } catch (err) {
      console.error('Failed to load movements:', err);
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

  const lowStockCount = products.filter((p) => Number(p.current_stock) <= lowStockThreshold).length;

  const filteredProducts = products.filter((p) => {
    const matchesCat = categoryFilter === 'ALL' || p.category_id === categoryFilter;
    const q = searchQuery.toLowerCase();
    const matchesQ =
      p.product_name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q));
    const matchesLow = onlyLowStock ? Number(p.current_stock) <= lowStockThreshold : true;
    return matchesCat && matchesQ && matchesLow;
  });

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pSku.trim() || !pName.trim()) return;

    try {
      await api.createProduct({
        sku: pSku,
        barcode: pBarcode,
        product_name: pName,
        category_id: pCategory || null,
        brand_id: pBrand || null,
        purchase_price: pCost,
        selling_price: pPrice,
        warranty_period: pWarranty,
        reorder_level: pReorder,
        serial_tracking_enabled: pSerialTracking,
        initial_stock: pInitialStock,
        branch_id: activeBranchId,
      });

      setIsNewProductOpen(false);
      // Reset form
      setPSku('');
      setPBarcode('');
      setPName('');
      setPCost(0);
      setPPrice(0);
      setPInitialStock(0);
      loadProducts();
    } catch (err: any) {
      alert(err.message || 'Failed to create product');
    }
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    if (!adjNotes.trim()) {
      alert('Please enter a Reason / Note for this stock adjustment.');
      return;
    }

    if (!adjQty || adjQty <= 0) {
      alert('Please enter a quantity greater than 0.');
      return;
    }

    setIsSavingAdjustment(true);
    setAdjustmentFeedback(null);

    try {
      const isDeduction =
        adjType === 'ADJUSTMENT_OUT' ||
        adjType === 'DAMAGE' ||
        adjType === 'LOST' ||
        adjType === 'SHRINKAGE' ||
        adjType === 'DEFECT';

      const signedQty = isDeduction ? -Math.abs(adjQty) : Math.abs(adjQty);

      const res = await api.recordAdjustment({
        branch_id: activeBranchId && activeBranchId !== 'ALL' ? activeBranchId : undefined,
        product_id: adjustingProduct.id,
        quantity: signedQty,
        adjustment_type: adjType,
        movement_type: adjType,
        notes: adjNotes.trim(),
        reason: adjNotes.trim(),
      });

      setAdjustmentFeedback({
        success: true,
        message: `Adjustment applied successfully! Updated stock is now ${res.current_stock ?? 'recorded'}.`,
      });

      await loadProducts();
      if (activeTab === 'ledger') await loadMovements();

      setTimeout(() => {
        setAdjustingProduct(null);
        setAdjNotes('');
        setAdjQty(1);
        setAdjustmentFeedback(null);
      }, 1200);
    } catch (err: any) {
      setAdjustmentFeedback({
        success: false,
        message: err.message || 'Failed to record stock adjustment.',
      });
    } finally {
      setIsSavingAdjustment(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeletingProduct(true);
    setDeleteFeedback(null);

    try {
      const res = await api.deleteProduct(productToDelete.id);
      setProductToDelete(null);
      await loadProducts();
    } catch (err: any) {
      setDeleteFeedback(err.message || 'Failed to remove product.');
    } finally {
      setIsDeletingProduct(false);
    }
  };

  const PRESET_REASONS = [
    { label: '📦 Stock Count', text: 'Corrected quantity during physical inventory count' },
    { label: '💥 Damaged Item', text: 'Item was damaged or broken in the store' },
    { label: '🔍 Found Item', text: 'Found misplaced stock in storage' },
    { label: '⚠️ Sent Back to Supplier', text: 'Defective item returned to supplier for credit/replacement' },
    { label: '📉 Missing Item', text: 'Item missing during routine stock check' },
    { label: '🔄 Delivery Mistake', text: 'Corrected quantity from supplier delivery intake' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans antialiased">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <Package className="w-6 h-6 text-indigo-600 mr-2" />
            Products & Stock
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Check stock quantities, track serial numbers, and add or update your items.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="bg-slate-100 p-1 rounded-xl flex space-x-1">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'catalog' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Products ({products.length})
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'ledger' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Stock History Log
            </button>
          </div>

          <button
            onClick={() => setIsNewProductOpen(true)}
            className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add New Product
          </button>
        </div>
      </div>

      {activeTab === 'catalog' ? (
        <>
          {/* Low Stock Threshold Configuration & Alert Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Alert When Stock Is Below:</span>
                  <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                    ≤ {lowStockThreshold} in stock
                  </span>
                  {lowStockCount > 0 && (
                    <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full animate-pulse">
                      {lowStockCount} items running low
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Items with this quantity or less will show a warning alert so you can reorder in time.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-end">
              {/* Threshold Preset Buttons */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs">
                <span className="text-slate-500 px-2 text-[11px] font-medium">Quick Set:</span>
                {[3, 5, 10, 15].map((val) => (
                  <button
                    key={val}
                    onClick={() => handleUpdateThreshold(val)}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      lowStockThreshold === val
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>

              {/* Custom Threshold Input */}
              {isEditingThreshold ? (
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-300 px-2 py-1 rounded-xl">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={tempThreshold}
                    onChange={(e) => setTempThreshold(parseInt(e.target.value, 10) || 1)}
                    className="w-12 px-1 py-0.5 bg-white border border-amber-300 rounded text-center font-bold text-xs"
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
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                  title="Custom threshold"
                >
                  Custom
                </button>
              )}

              {/* Toggle Low Stock Filter */}
              <button
                onClick={() => setOnlyLowStock(!onlyLowStock)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  onlyLowStock
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>Only Show Low Stock</span>
                <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono ${onlyLowStock ? 'bg-white text-rose-700' : 'bg-slate-300 text-slate-800'}`}>
                  {lowStockCount}
                </span>
              </button>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Search product name, product code, barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
              <button
                onClick={() => setCategoryFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  categoryFilter === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Categories
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryFilter(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    categoryFilter === c.id
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c.category_name}
                </button>
              ))}
            </div>
          </div>

          {/* Catalog Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Product Name & Code</th>
                    <th className="py-3 px-4">Category & Brand</th>
                    <th className="py-3 px-4 text-right">Cost Price (What you paid)</th>
                    <th className="py-3 px-4 text-right">Selling Price (To customer)</th>
                    <th className="py-3 px-4 text-right">In Stock</th>
                    <th className="py-3 px-4">Serial Tracking</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Loading products...
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        {onlyLowStock
                          ? 'Great news! No products are below your low stock threshold right now.'
                          : 'No products found matching your search.'}
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isLow = Number(p.current_stock) <= lowStockThreshold;
                      const isOut = Number(p.current_stock) <= 0;

                      return (
                        <tr
                          key={p.id}
                          className={`transition-colors ${
                            isOut
                              ? 'bg-rose-50/40 hover:bg-rose-50/70'
                              : isLow
                              ? 'bg-amber-50/30 hover:bg-amber-50/60'
                              : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-900 block">{p.product_name}</span>
                            <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400 mt-0.5">
                              <span>Code: {p.sku}</span>
                              {p.barcode && <span>• Barcode: {p.barcode}</span>}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <div>{p.category_name || 'General'}</div>
                            <span className="text-[10px] text-slate-400">{p.brand_name || 'Standard'}</span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600">
                            ${Number(p.purchase_price).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                            ${Number(p.selling_price).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                                isOut
                                  ? 'bg-rose-100 text-rose-800'
                                  : isLow
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {p.current_stock} {p.unit}
                            </span>
                            {isOut ? (
                              <span className="block text-[10px] font-bold text-rose-600">Out of Stock</span>
                            ) : isLow ? (
                              <span className="block text-[10px] text-amber-600 font-semibold">Low (≤ {lowStockThreshold})</span>
                            ) : null}
                          </td>
                          <td className="py-3 px-4">
                            {p.serial_tracking_enabled ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <ShieldCheck className="w-3 h-3 mr-1" /> Track Serials
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Standard Item</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => {
                                  setAdjustingProduct(p);
                                  setAdjQty(1);
                                  setAdjNotes('');
                                  setAdjustmentFeedback(null);
                                }}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                                title="Update product stock quantity"
                              >
                                <SlidersHorizontal className="w-3 h-3" />
                                <span>Update Stock</span>
                              </button>

                              {/* Remove Product Button */}
                              <button
                                onClick={() => {
                                  setProductToDelete(p);
                                  setDeleteFeedback(null);
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-400 hover:text-rose-600 rounded-lg text-xs transition-colors cursor-pointer"
                                title={`Remove ${p.product_name} from catalog`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* ================= MOVEMENT LEDGER TAB ================= */
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Stock In & Out History Log
            </h4>
            <button
              onClick={loadMovements}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh History</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4 text-right">Quantity Change</th>
                  <th className="py-3 px-4">Serial Number</th>
                  <th className="py-3 px-4">Reason & Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No stock movements recorded yet.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 font-mono">
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                        {new Date(m.created_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-sans font-medium text-slate-900">
                        {m.product_name}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                          {m.movement_type}
                        </span>
                      </td>
                      <td className={`py-2.5 px-4 text-right font-bold ${
                        Number(m.quantity) > 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {Number(m.quantity) > 0 ? `+${m.quantity}` : m.quantity}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                        {m.serial_number || '—'}
                      </td>
                      <td className="py-2.5 px-4 font-sans text-slate-600 text-[11px]">
                        {m.notes || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE HARDWARE PRODUCT ================= */}
      <Modal
        isOpen={isNewProductOpen}
        onClose={() => setIsNewProductOpen(false)}
        title="Add New Product"
        subtitle="Fill in the product name, cost, sale price, and starting quantity."
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Product Code (SKU) *</label>
              <input
                required
                type="text"
                placeholder="e.g. CPU-RYZ-7800X3D"
                value={pSku}
                onChange={(e) => setPSku(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Barcode (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 730143314930"
                value={pBarcode}
                onChange={(e) => setPBarcode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Product Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. AMD Ryzen 7 7800X3D 8-Core Processor"
              value={pName}
              onChange={(e) => setPName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Category</label>
              <select
                value={pCategory}
                onChange={(e) => setPCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              >
                <option value="">Select Category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.category_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Brand</label>
              <select
                value={pBrand}
                onChange={(e) => setPBrand(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              >
                <option value="">Select Brand...</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Cost Price ($ What you paid) *</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={pCost === 0 ? '' : pCost}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const v = e.target.value;
                  setPCost(v === '' ? 0 : parseFloat(v) || 0);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Selling Price ($ Price to customer) *</label>
              <input
                required
                type="number"
                step="0.01"
                placeholder="0.00"
                value={pPrice === 0 ? '' : pPrice}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const v = e.target.value;
                  setPPrice(v === '' ? 0 : parseFloat(v) || 0);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Low Stock Warning Level</label>
              <input
                type="number"
                min="0"
                value={pReorder === 0 ? '' : pReorder}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const v = e.target.value;
                  setPReorder(v === '' ? 0 : parseInt(v, 10) || 0);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Starting Stock Quantity</label>
              <input
                type="number"
                min="0"
                value={pInitialStock === 0 ? '' : pInitialStock}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const v = e.target.value;
                  setPInitialStock(v === '' ? 0 : parseInt(v, 10) || 0);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pSerialTracking}
                onChange={(e) => setPSerialTracking(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <div>
                <span className="font-semibold text-slate-900 block">Track Individual Serial Numbers</span>
                <span className="text-[11px] text-slate-500">
                  Turn this on if each unit has its own unique serial number (like phones, laptops, and computer parts).
                </span>
              </div>
            </label>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsNewProductOpen(false)}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
            >
              Save Product
            </button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: STOCK ADJUSTMENT ================= */}
      {adjustingProduct && (
        <Modal
          isOpen={Boolean(adjustingProduct)}
          onClose={() => {
            if (!isSavingAdjustment) {
              setAdjustingProduct(null);
              setAdjustmentFeedback(null);
            }
          }}
          title={`Update Stock: ${adjustingProduct.product_name}`}
          subtitle={`Product Code: ${adjustingProduct.sku} • In Stock: ${adjustingProduct.current_stock} ${adjustingProduct.unit || 'units'}`}
          maxWidth="lg"
        >
          <form onSubmit={handleSaveAdjustment} className="space-y-4 text-xs">
            {/* Feedback alert if any */}
            {adjustmentFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  adjustmentFeedback.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {adjustmentFeedback.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{adjustmentFeedback.message}</span>
              </div>
            )}

            {/* Step 1: Adjustment Type & Quantity */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <span className="font-bold text-slate-900 block text-xs uppercase tracking-wider">
                1. Why are you changing the stock?
              </span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Stock Change Type</label>
                  <select
                    value={adjType}
                    onChange={(e) => setAdjType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white font-medium"
                  >
                    <option value="ADJUSTMENT_IN">Add Stock (+) Found items / Count correction</option>
                    <option value="ADJUSTMENT_OUT">Remove Stock (-) Damaged or broken items</option>
                    <option value="LOST">Remove Stock (-) Missing or lost items</option>
                    <option value="DAMAGE">Remove Stock (-) Returned defective to supplier</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Number of Units to Change</label>
                  <input
                    required
                    type="number"
                    min="1"
                    placeholder="1"
                    value={adjQty === 0 ? '' : adjQty}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAdjQty(v === '' ? 0 : parseInt(v, 10) || 0);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold bg-white"
                  />
                </div>
              </div>

              {/* Live Preview of resulting stock */}
              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
                <span>Stock Calculation:</span>
                <span className="font-mono">
                  Current: <strong className="text-slate-900">{adjustingProduct.current_stock}</strong>
                  {' ➔ '}
                  New Total in Stock:{' '}
                  <strong className={
                    (adjType === 'ADJUSTMENT_OUT' || adjType === 'DAMAGE' || adjType === 'LOST')
                      ? 'text-rose-700'
                      : 'text-emerald-700'
                  }>
                    {Number(adjustingProduct.current_stock) +
                      ((adjType === 'ADJUSTMENT_OUT' || adjType === 'DAMAGE' || adjType === 'LOST')
                        ? -Math.abs(adjQty || 0)
                        : Math.abs(adjQty || 0))} {adjustingProduct.unit || 'units'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Step 2: Reason & Audit Note */}
            <div className="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-200/80 space-y-2.5">
              <div>
                <label className="font-bold text-indigo-950 block text-xs">
                  2. Reason for Change <span className="text-rose-600">*</span>
                </label>
                <p className="text-[11px] text-indigo-900/80 mt-0.5">
                  Write a short explanation for this stock change. This will be recorded in the history log.
                </p>
              </div>

              {/* Preset Clickable Quick-Tags */}
              <div>
                <span className="text-[10px] font-semibold text-indigo-800 uppercase tracking-wider block mb-1">
                  Click a common reason to fill in:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_REASONS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setAdjNotes(preset.text)}
                      className="px-2 py-1 bg-white hover:bg-indigo-100 border border-indigo-200 rounded-md text-[11px] text-indigo-900 transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mandatory Reason Textarea */}
              <div className="mt-2">
                <textarea
                  required
                  rows={3}
                  placeholder="Type the reason here (e.g. 'Found 2 extra boxes during stock check', 'Box dropped accidentally', etc.)..."
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isSavingAdjustment}
                onClick={() => setAdjustingProduct(null)}
                className="px-3.5 py-2 text-slate-600 hover:text-slate-800 rounded-lg font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingAdjustment || !adjNotes.trim()}
                className={`px-5 py-2 rounded-xl font-bold text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSavingAdjustment || !adjNotes.trim()
                    ? 'bg-slate-400 cursor-not-allowed opacity-70'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isSavingAdjustment ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Stock Change</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL: REMOVE PRODUCT CONFIRMATION ================= */}
      {productToDelete && (
        <Modal
          isOpen={Boolean(productToDelete)}
          onClose={() => {
            if (!isDeletingProduct) {
              setProductToDelete(null);
              setDeleteFeedback(null);
            }
          }}
          title={`Remove Product: ${productToDelete.product_name}`}
          subtitle={`Product Code: ${productToDelete.sku}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            {deleteFeedback && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{deleteFeedback}</span>
              </div>
            )}

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Confirm Remove Product</span>
              </div>
              <p className="text-xs text-amber-800">
                Are you sure you want to remove <strong>{productToDelete.product_name}</strong> ({productToDelete.sku}) from your catalog?
              </p>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-amber-800 mt-2">
                <li>If this item has past sales, it will be safely archived so your financial records and reports stay intact.</li>
                <li>If it has never been sold, it will be completely removed.</li>
              </ul>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeletingProduct}
                onClick={() => setProductToDelete(null)}
                className="px-3.5 py-2 text-slate-600 hover:text-slate-800 font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingProduct}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isDeletingProduct ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Remove Product</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
