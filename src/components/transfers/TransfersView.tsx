import React, { useState, useEffect } from 'react';
import { StockTransfer, Branch, Product, ProductSerial, User } from '../../types.ts';
import { api } from '../../services/api.ts';
import { Badge } from '../common/Badge.tsx';
import { Modal } from '../common/Modal.tsx';
import {
  ArrowLeftRight, Plus, CheckCircle2, Truck, PackageCheck,
  Building, Clock, ShieldCheck, AlertCircle, ArrowRight
} from 'lucide-react';

interface TransfersViewProps {
  user: User;
  activeBranchId: string;
}

export const TransfersView: React.FC<TransfersViewProps> = ({ user, activeBranchId }) => {
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // New Transfer Modal
  const [isOpen, setIsOpen] = useState(false);
  const [sourceBranchId, setSourceBranchId] = useState(activeBranchId || '');
  const [destBranchId, setDestBranchId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [transferQty, setTransferQty] = useState<number>(1);
  const [transferNotes, setTransferNotes] = useState('');
  const [availableSerials, setAvailableSerials] = useState<ProductSerial[]>([]);
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadTransfers();
    loadBranches();
    loadProducts();
  }, [activeBranchId]);

  useEffect(() => {
    if (selectedProductId && sourceBranchId) {
      const prod = products.find((p) => p.id === selectedProductId);
      if (prod?.serial_tracking_enabled) {
        api.getSerials({ branch_id: sourceBranchId, product_id: selectedProductId, status: 'In Stock' })
          .then((res) => {
            setAvailableSerials(res.serials);
            setSelectedSerials(res.serials.slice(0, transferQty).map((s) => s.serial_number));
          })
          .catch(console.error);
      } else {
        setAvailableSerials([]);
        setSelectedSerials([]);
      }
    }
  }, [selectedProductId, sourceBranchId, transferQty]);

  const loadTransfers = async () => {
    setLoading(true);
    try {
      const res = await api.getTransfers(activeBranchId || undefined);
      setTransfers(res.transfers);
    } catch (err) {
      console.error('Failed to load transfers:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async () => {
    try {
      const res = await api.getBranches();
      setBranches(res.branches);
      if (!sourceBranchId && res.branches.length > 0) {
        setSourceBranchId(res.branches[0].id);
      }
      if (!destBranchId && res.branches.length > 1) {
        setDestBranchId(res.branches[1].id);
      }
    } catch (err) {
      console.error('Failed to load branches:', err);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await api.getProducts();
      setProducts(res.products);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceBranchId || !destBranchId || !selectedProductId) {
      alert('Please fill out all required fields.');
      return;
    }
    if (sourceBranchId === destBranchId) {
      alert('Source and destination branches cannot be the same.');
      return;
    }

    const prod = products.find((p) => p.id === selectedProductId);
    if (prod?.serial_tracking_enabled && selectedSerials.length !== transferQty) {
      alert(`Please select ${transferQty} serial numbers.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createTransfer({
        source_branch_id: sourceBranchId,
        destination_branch_id: destBranchId,
        notes: transferNotes,
        items: [
          {
            product_id: selectedProductId,
            quantity: transferQty,
            serial_numbers: selectedSerials,
          },
        ],
      });

      setIsOpen(false);
      setTransferNotes('');
      loadTransfers();
    } catch (err: any) {
      alert(err.message || 'Failed to create transfer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (transferId: string, nextStatus: string) => {
    try {
      await api.updateTransferStatus(transferId, nextStatus);
      loadTransfers();
    } catch (err: any) {
      alert(err.message || 'Failed to update transfer status');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <ArrowLeftRight className="w-6 h-6 text-indigo-600 mr-2" />
            Inter-Branch Stock Transfers & Logistics
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Dispatch, track, and receive hardware inventory between Downtown and Mall branches.
          </p>
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Request Stock Transfer
        </button>
      </div>

      {/* Transfers List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            Loading inter-branch transfers...
          </div>
        ) : transfers.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            No stock transfers recorded yet.
          </div>
        ) : (
          transfers.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-3">
                  <span className="font-mono font-bold text-sm text-indigo-700">{t.transfer_number}</span>
                  <Badge status={t.status} />
                  <span className="text-xs text-slate-400">
                    Initiated {new Date(t.created_at).toLocaleString()}
                  </span>
                </div>

                {/* Workflow Action Buttons */}
                <div className="flex items-center space-x-2">
                  {t.status === 'REQUESTED' && (
                    <button
                      onClick={() => handleUpdateStatus(t.id, 'APPROVED')}
                      className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Approve Request
                    </button>
                  )}
                  {t.status === 'APPROVED' && (
                    <button
                      onClick={() => handleUpdateStatus(t.id, 'DISPATCHED')}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center cursor-pointer"
                    >
                      <Truck className="w-3.5 h-3.5 mr-1" />
                      Dispatch & Deduct Stock
                    </button>
                  )}
                  {t.status === 'DISPATCHED' && (
                    <button
                      onClick={() => handleUpdateStatus(t.id, 'RECEIVED')}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center cursor-pointer"
                    >
                      <PackageCheck className="w-3.5 h-3.5 mr-1" />
                      Acknowledge & Restock at Destination
                    </button>
                  )}
                  {t.status === 'RECEIVED' && (
                    <span className="inline-flex items-center text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Completed
                    </span>
                  )}
                </div>
              </div>

              {/* Transfer Route Visualizer */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                <div className="flex items-center space-x-2">
                  <Building className="w-4 h-4 text-slate-400" />
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Source Branch</span>
                    <span className="font-semibold text-slate-800">
                      {t.source_branch_name} ({t.source_branch_code})
                    </span>
                  </div>
                </div>

                <div className="flex items-center px-4 text-slate-400">
                  <div className="h-0.5 w-12 bg-slate-300"></div>
                  <Truck className="w-4 h-4 mx-2 text-indigo-600" />
                  <div className="h-0.5 w-12 bg-slate-300"></div>
                </div>

                <div className="flex items-center space-x-2 text-right">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Destination Branch</span>
                    <span className="font-semibold text-slate-800">
                      {t.destination_branch_name} ({t.destination_branch_code})
                    </span>
                  </div>
                  <Building className="w-4 h-4 text-slate-400" />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Transferred Items:</span>
                <div className="divide-y divide-slate-100">
                  {t.items.map((it, idx) => (
                    <div key={idx} className="py-2 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-semibold text-slate-900">{it.product_name}</span>
                        <span className="text-slate-400 font-mono ml-2">SKU: {it.sku}</span>
                        {it.serial_numbers && it.serial_numbers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {it.serial_numbers.map((sn, sIdx) => (
                              <span
                                key={sIdx}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200"
                              >
                                <ShieldCheck className="w-3 h-3 mr-1" />
                                {sn}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="font-bold font-mono text-sm text-slate-800">
                        Qty: {it.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {t.notes && (
                <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded italic">
                  Note: {t.notes}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* ================= MODAL: CREATE TRANSFER ================= */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Initiate Inter-Branch Stock Transfer"
        subtitle="Transfer hardware goods or serialized units between retail branches"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateTransfer} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Source Branch *</label>
              <select
                value={sourceBranchId}
                onChange={(e) => setSourceBranchId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.branch_name} ({b.branch_code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Destination Branch *</label>
              <select
                value={destBranchId}
                onChange={(e) => setDestBranchId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.branch_name} ({b.branch_code})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Hardware Product *</label>
            <select
              required
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            >
              <option value="">Select Hardware Item</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.product_name} ({p.sku}) {p.serial_tracking_enabled ? '• [Serialized]' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Transfer Quantity *</label>
            <input
              required
              type="number"
              min="1"
              value={transferQty}
              onChange={(e) => setTransferQty(Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold"
            />
          </div>

          {/* Serial Number Selector if Item is Serialized */}
          {availableSerials.length > 0 && (
            <div className="bg-indigo-50/70 p-3 rounded-lg border border-indigo-200 space-y-2">
              <label className="font-bold text-indigo-900 block">
                Assign Unit Serial Numbers ({selectedSerials.length} of {transferQty} selected):
              </label>
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                {availableSerials.map((s) => (
                  <label key={s.id} className="flex items-center space-x-2 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSerials.includes(s.serial_number)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (selectedSerials.length < transferQty) {
                            setSelectedSerials([...selectedSerials, s.serial_number]);
                          }
                        } else {
                          setSelectedSerials(selectedSerials.filter((sn) => sn !== s.serial_number));
                        }
                      }}
                      className="w-3.5 h-3.5 text-indigo-600 rounded"
                    />
                    <span className="font-mono">{s.serial_number}</span>
                    <span className="text-slate-400 text-[10px]">({s.current_location || 'Showroom'})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Transfer Notes & Driver</label>
            <input
              type="text"
              placeholder="e.g. Weekly stock replenishment via courier van"
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs"
            >
              Submit Transfer Request
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
