import React, { useState, useEffect, useMemo } from 'react';
import { User, Supplier, AutoReorderSuggestion } from '../../types.ts';
import { api } from '../../services/api.ts';
import {
  RefreshCw, ShoppingBag, Truck, CheckCircle2, AlertTriangle,
  Calendar, FileText, ArrowRight, Package, DollarSign, Filter,
  Layers, Clock, ChevronRight
} from 'lucide-react';

interface AutoReorderDashboardProps {
  user: User;
  activeBranchId: string;
}

export const AutoReorderDashboard: React.FC<AutoReorderDashboardProps> = ({
  user,
  activeBranchId,
}) => {
  const [suggestions, setSuggestions] = useState<AutoReorderSuggestion[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [creatingPO, setCreatingPO] = useState(false);
  const [activeTab, setActiveTab] = useState<'SUGGESTIONS' | 'ORDERS'>('SUGGESTIONS');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    loadData();
  }, [activeBranchId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reorderRes, purchasesRes, suppliersRes] = await Promise.all([
        api.getAutoReorderSuggestions({ branch_id: activeBranchId || undefined }),
        api.getPurchases({ branch_id: activeBranchId || undefined }),
        api.getSuppliers(),
      ]);

      const suggs = reorderRes.suggestions || [];
      setSuggestions(suggs);
      setSuppliers(suppliersRes.suppliers || []);
      setPurchases(purchasesRes.purchases || []);

      // Auto-select all low stock items by default for fast bulk ordering
      const initialSelected: Record<string, boolean> = {};
      const initialQtys: Record<string, number> = {};
      suggs.forEach((s) => {
        initialSelected[s.product_id] = true;
        initialQtys[s.product_id] = s.suggested_quantity;
      });
      setSelectedItems(initialSelected);
      setCustomQuantities(initialQtys);
    } catch (err) {
      console.error('Failed to load auto-reorder data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSuggestions = useMemo(() => {
    if (supplierFilter === 'ALL') return suggestions;
    return suggestions.filter((s) => s.supplier_id === supplierFilter);
  }, [suggestions, supplierFilter]);

  const toggleSelect = (productId: string) => {
    setSelectedItems((prev) => ({ ...prev, [productId]: !prev[productId] }));
  };

  const toggleSelectAll = () => {
    const allSelected = filteredSuggestions.every((s) => selectedItems[s.product_id]);
    const next: Record<string, boolean> = { ...selectedItems };
    filteredSuggestions.forEach((s) => {
      next[s.product_id] = !allSelected;
    });
    setSelectedItems(next);
  };

  const totalEstimatedCost = useMemo(() => {
    return filteredSuggestions.reduce((acc, s) => {
      if (!selectedItems[s.product_id]) return acc;
      const qty = customQuantities[s.product_id] || s.suggested_quantity;
      return acc + qty * Number(s.unit_price);
    }, 0);
  }, [filteredSuggestions, selectedItems, customQuantities]);

  const selectedCount = useMemo(() => {
    return filteredSuggestions.filter((s) => selectedItems[s.product_id]).length;
  }, [filteredSuggestions, selectedItems]);

  // Handle PO Creation
  const handleCreatePurchaseOrder = async () => {
    const itemsToOrder = filteredSuggestions.filter((s) => selectedItems[s.product_id]);
    if (itemsToOrder.length === 0) {
      alert('Please select at least one item to include in the purchase order.');
      return;
    }

    setCreatingPO(true);
    try {
      // If items have different suppliers, or if a supplier is filtered, select the appropriate supplier
      const defaultSupplierId =
        supplierFilter !== 'ALL'
          ? supplierFilter
          : itemsToOrder[0].supplier_id || (suppliers[0] ? suppliers[0].id : '');

      if (!defaultSupplierId) {
        alert('Please create or select a supplier first in the Suppliers module.');
        setCreatingPO(false);
        return;
      }

      const poItems = itemsToOrder.map((item) => ({
        product_id: item.product_id,
        quantity: customQuantities[item.product_id] || item.suggested_quantity,
        unit_cost: Number(item.unit_price),
      }));

      const res = await api.createPurchase({
        branch_id: activeBranchId,
        supplier_id: defaultSupplierId,
        items: poItems,
        paid_amount: 0,
        notes: `Automated reorder for ${itemsToOrder.length} low-stock hardware items.`,
      });

      if (res.success) {
        alert('Supplier Purchase Order created successfully!');
        await loadData();
        setActiveTab('ORDERS');
      }
    } catch (err: any) {
      alert(`Failed to create PO: ${err.message || 'Server error'}`);
    } finally {
      setCreatingPO(false);
    }
  };

  // Handle PO Status update
  const handleUpdateStatus = async (purchaseId: string, nextStatus: string, receiveAll = false) => {
    try {
      const res = await api.updatePurchaseOrderStatus(purchaseId, {
        po_status: nextStatus,
        receive_all_stock: receiveAll,
      });
      if (res.success) {
        await loadData();
      }
    } catch (err: any) {
      alert(`Error updating PO status: ${err.message || 'Failed'}`);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              Automatic Stock Orders
            </span>
            <span className="text-xs text-slate-400">• Low-stock reordering</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-600" />
            Order Low-Stock Items & Supplier Orders
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            See items that are running low, group by supplier, and order new stock with 1-click.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('SUGGESTIONS')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'SUGGESTIONS'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Items to Reorder ({suggestions.length})
          </button>
          <button
            onClick={() => setActiveTab('ORDERS')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ORDERS'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Supplier Orders ({purchases.length})
          </button>
        </div>
      </div>

      {activeTab === 'SUGGESTIONS' ? (
        <div className="space-y-4">
          {/* Filter & Action Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" />
                Filter by Supplier:
              </label>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:outline-hidden"
              >
                <option value="ALL">All Suppliers ({suggestions.length} items)</option>
                {suppliers.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Estimated Total Cost</span>
                <span className="font-mono font-bold text-sm text-slate-900">
                  ${totalEstimatedCost.toFixed(2)}
                </span>
              </div>

              <button
                onClick={handleCreatePurchaseOrder}
                disabled={creatingPO || selectedCount === 0}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>
                  {creatingPO ? 'Placing Order...' : `Place Order for ${selectedCount} Item${selectedCount > 1 ? 's' : ''}`}
                </span>
              </button>
            </div>
          </div>

          {/* Suggestions Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                Checking stock levels for items running low...
              </div>
            ) : filteredSuggestions.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <h3 className="font-bold text-sm text-slate-800">All Stock Levels Are Good!</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  No items are running low right now. Everything in the store is well stocked!
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/80 text-slate-500 text-[11px] uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={filteredSuggestions.length > 0 && filteredSuggestions.every((s) => selectedItems[s.product_id])}
                          onChange={toggleSelectAll}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-center">Current Stock</th>
                      <th className="py-3 px-4 text-center">Low Stock Level</th>
                      <th className="py-3 px-4 text-center">Order Qty</th>
                      <th className="py-3 px-4 text-right">Cost per Item</th>
                      <th className="py-3 px-4 text-right">Total Cost</th>
                      <th className="py-3 px-4">Supplier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSuggestions.map((item) => {
                      const isSelected = selectedItems[item.product_id];
                      const qty = customQuantities[item.product_id] || item.suggested_quantity;
                      const lineTotal = qty * Number(item.unit_price);

                      return (
                        <tr
                          key={item.product_id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isSelected ? 'bg-indigo-50/30' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={!!isSelected}
                              onChange={() => toggleSelect(item.product_id)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">{item.product_name}</span>
                            <span className="font-mono text-[10px] text-slate-400">Code: {item.sku}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-semibold">
                              {item.category_name || 'General'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">
                              {item.current_stock} left
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-600">
                            {item.reorder_level}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="number"
                              min="1"
                              value={qty}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                setCustomQuantities({ ...customQuantities, [item.product_id]: val });
                              }}
                              className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-center font-mono font-bold text-slate-900 bg-white"
                            />
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-700">
                            ${Number(item.unit_price).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            ${lineTotal.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {item.supplier_name ? (
                              <span className="font-semibold text-slate-800">{item.supplier_name}</span>
                            ) : (
                              <span className="text-slate-400 italic">Primary Distributor</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Purchase Orders Management Tab */
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Supplier Orders & Shipments
                </h3>
                <p className="text-xs text-slate-500">
                  Track supplier delivery progress and add delivered items directly into your store stock.
                </p>
              </div>
            </div>

            {purchases.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No supplier orders placed yet. Use the Items to Reorder tab to create one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Order #</th>
                      <th className="py-3 px-4">Supplier</th>
                      <th className="py-3 px-4">Order Date</th>
                      <th className="py-3 px-4 text-right">Total Cost</th>
                      <th className="py-3 px-4 text-center">Payment</th>
                      <th className="py-3 px-4 text-center">Shipment Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchases.map((po) => {
                      const status = po.po_status || 'ORDERED';

                      return (
                        <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {po.purchase_number}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {po.supplier_name || 'Primary Supplier'}
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {new Date(po.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            ${Number(po.total_amount).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                po.payment_status === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {po.payment_status === 'PAID' ? 'Paid' : 'Unpaid'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                status === 'RECEIVED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : status === 'IN_TRANSIT'
                                  ? 'bg-blue-100 text-blue-800'
                                  : status === 'ORDERED'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {status === 'ORDERED' ? 'Ordered' : status === 'IN_TRANSIT' ? 'On the Way' : status === 'RECEIVED' ? 'Received' : status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {status === 'ORDERED' && (
                              <button
                                onClick={() => handleUpdateStatus(po.id, 'IN_TRANSIT')}
                                className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                              >
                                Mark On the Way
                              </button>
                            )}
                            {status === 'IN_TRANSIT' && (
                              <button
                                onClick={() => handleUpdateStatus(po.id, 'RECEIVED', true)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[11px] transition-colors cursor-pointer shadow-2xs"
                              >
                                Receive All Stock
                              </button>
                            )}
                            {status === 'RECEIVED' && (
                              <span className="text-[11px] font-semibold text-emerald-700 flex items-center justify-end gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Added to Stock
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
