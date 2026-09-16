import React, { useState, useEffect } from 'react';
import { Supplier, Product, User } from '../../types.ts';
import { api } from '../../services/api.ts';
import { Modal } from '../common/Modal.tsx';
import {
  Truck, Plus, Search, DollarSign, Building, Phone,
  Mail, ShoppingCart, CheckCircle2, FileText
} from 'lucide-react';

interface SuppliersViewProps {
  user: User;
  activeBranchId: string;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({ user, activeBranchId }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<'suppliers' | 'purchases'>('suppliers');
  const [loading, setLoading] = useState(true);

  // New Supplier Modal
  const [isAddSupOpen, setIsAddSupOpen] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');

  // New Purchase Modal
  const [isNewPurchaseOpen, setIsNewPurchaseOpen] = useState(false);
  const [selectedSupId, setSelectedSupId] = useState('');
  const [selectedProdId, setSelectedProdId] = useState('');
  const [purchaseQty, setPurchaseQty] = useState<number>(5);
  const [purchaseUnitCost, setPurchaseUnitCost] = useState<number>(100);
  const [purchaseSerials, setPurchaseSerials] = useState('');
  const [isPurchasing, setIsPurchasing] = useState(false);

  useEffect(() => {
    loadSuppliers();
    loadPurchases();
    loadProducts();
  }, [activeBranchId]);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const res = await api.getSuppliers();
      setSuppliers(res.suppliers);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPurchases = async () => {
    try {
      const res = await api.getPurchases({ branch_id: activeBranchId || undefined });
      setPurchases(res.purchases);
    } catch (err) {
      console.error('Failed to load purchases:', err);
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

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await api.createSupplier({
        name,
        company,
        phone,
        email,
        payment_terms: paymentTerms,
      });

      setIsAddSupOpen(false);
      setName('');
      setCompany('');
      loadSuppliers();
    } catch (err: any) {
      alert(err.message || 'Failed to create supplier');
    }
  };

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupId || !selectedProdId) return;

    const prod = products.find((p) => p.id === selectedProdId);
    let serialList: string[] = [];
    if (prod?.serial_tracking_enabled && purchaseSerials.trim()) {
      serialList = purchaseSerials.split('\n').map((s) => s.trim()).filter(Boolean);
      if (serialList.length !== purchaseQty) {
        alert(`Please enter exactly ${purchaseQty} serial numbers (one per line). Entered: ${serialList.length}`);
        return;
      }
    }

    setIsPurchasing(true);
    try {
      const totalAmount = purchaseQty * purchaseUnitCost;
      await api.createPurchase({
        branch_id: activeBranchId,
        supplier_id: selectedSupId,
        paid_amount: totalAmount,
        payment_method: 'Bank Transfer',
        items: [
          {
            product_id: selectedProdId,
            quantity: purchaseQty,
            unit_cost: purchaseUnitCost,
            serial_numbers: serialList,
          },
        ],
      });

      setIsNewPurchaseOpen(false);
      setPurchaseSerials('');
      loadPurchases();
      loadSuppliers();
      alert('Purchase recorded and stock received into branch inventory successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to record purchase');
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <Truck className="w-6 h-6 text-indigo-600 mr-2" />
            Suppliers & Procurement Accounts Payable
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Vendor master directory, wholesale purchase intake, accounts payable ledger, and stock replenishment.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="bg-slate-100 p-1 rounded-xl flex space-x-1">
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'suppliers' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Suppliers Directory ({suppliers.length})
            </button>
            <button
              onClick={() => setActiveTab('purchases')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'purchases' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Purchase Orders ({purchases.length})
            </button>
          </div>

          <button
            onClick={() => setIsNewPurchaseOpen(true)}
            className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Record Hardware Purchase
          </button>
        </div>
      </div>

      {activeTab === 'suppliers' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-3 hover:border-slate-300 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{s.name}</h4>
                  <span className="text-xs text-slate-500">{s.company || 'Distributor'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase">Accounts Payable</span>
                  <span className="text-base font-bold font-mono text-slate-900">
                    ${Number(s.balance).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-xs text-slate-600 pt-2 border-t border-slate-100">
                {s.phone && <p>Tel: {s.phone}</p>}
                {s.email && <p>Email: {s.email}</p>}
                <p>Terms: <span className="font-semibold text-slate-800">{s.payment_terms || 'Net 30'}</span></p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">PO #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4 text-right">Total Purchase</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700">{p.purchase_number}</td>
                    <td className="py-3 px-4 text-slate-600">{new Date(p.purchase_date).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{p.branch_name}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{p.supplier_name}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      ${Number(p.total_amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">
                      ${Number(p.paid_amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL: RECORD PURCHASE ================= */}
      <Modal
        isOpen={isNewPurchaseOpen}
        onClose={() => setIsNewPurchaseOpen(false)}
        title="Record Wholesale Hardware Purchase"
        subtitle="Intake stock units from vendor and record procurement expense/payable"
        maxWidth="lg"
      >
        <form onSubmit={handleCreatePurchase} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Supplier / IT Distributor *</label>
            <select
              required
              value={selectedSupId}
              onChange={(e) => setSelectedSupId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            >
              <option value="">Select Vendor</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.company || 'Distributor'})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Product Being Procured *</label>
            <select
              required
              value={selectedProdId}
              onChange={(e) => {
                setSelectedProdId(e.target.value);
                const p = products.find((pr) => pr.id === e.target.value);
                if (p) setPurchaseUnitCost(Number(p.purchase_price) || 50);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            >
              <option value="">Select Product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.product_name} ({p.sku}) {p.serial_tracking_enabled ? '• [Serialized]' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Quantity *</label>
              <input
                required
                type="number"
                min="1"
                value={purchaseQty}
                onChange={(e) => setPurchaseQty(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Unit Cost ($) *</label>
              <input
                required
                type="number"
                step="0.01"
                value={purchaseUnitCost}
                onChange={(e) => setPurchaseUnitCost(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold"
              />
            </div>
          </div>

          {products.find((p) => p.id === selectedProdId)?.serial_tracking_enabled && (
            <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200 space-y-1">
              <label className="font-bold text-indigo-900 block">
                Enter Unit Serial Numbers ({purchaseQty} lines required):
              </label>
              <p className="text-[11px] text-slate-500">
                Scan or paste each serial number on a separate line.
              </p>
              <textarea
                required
                rows={4}
                placeholder="SN-UNIT-001&#10;SN-UNIT-002&#10;SN-UNIT-003"
                value={purchaseSerials}
                onChange={(e) => setPurchaseSerials(e.target.value)}
                className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-slate-900 font-mono text-xs"
              />
            </div>
          )}

          <div className="p-3 bg-slate-50 rounded-lg flex justify-between items-center text-xs">
            <span className="text-slate-600 font-medium">Total Purchase Valuation:</span>
            <span className="font-mono text-base font-bold text-slate-900">
              ${(purchaseQty * purchaseUnitCost).toFixed(2)}
            </span>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsNewPurchaseOpen(false)}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPurchasing}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs"
            >
              {isPurchasing ? 'Processing Intake...' : 'Confirm PO & Intake Stock'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
