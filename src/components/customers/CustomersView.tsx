import React, { useState, useEffect } from 'react';
import { Customer, User } from '../../types.ts';
import { api } from '../../services/api.ts';
import { Modal } from '../common/Modal.tsx';
import {
  Users, Plus, Search, DollarSign, FileText, Phone,
  Mail, MapPin, CheckCircle2, CreditCard, ArrowDownLeft
} from 'lucide-react';

interface CustomersViewProps {
  user: User;
  activeBranchId: string;
}

export const CustomersView: React.FC<CustomersViewProps> = ({ user, activeBranchId }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // New Customer Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [custType, setCustType] = useState('RETAIL');
  const [creditLimit, setCreditLimit] = useState<number>(1000);

  // Customer Ledger Modal
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [ledgerInvoices, setLedgerInvoices] = useState<any[]>([]);
  const [ledgerPayments, setLedgerPayments] = useState<any[]>([]);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);

  // Payment Modal
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState('Cash');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');

  useEffect(() => {
    loadCustomers();
  }, [activeBranchId]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.getCustomers(searchQuery || undefined, activeBranchId || undefined);
      setCustomers(res.customers);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadCustomers();
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await api.createCustomer({
        name,
        phone,
        email,
        address,
        city,
        customer_type: custType,
        credit_limit: creditLimit,
        branch_id: activeBranchId,
      });

      setIsAddOpen(false);
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      loadCustomers();
    } catch (err: any) {
      alert(err.message || 'Failed to create customer');
    }
  };

  const handleOpenLedger = async (cust: Customer) => {
    setSelectedCustomer(cust);
    setIsLedgerLoading(true);
    try {
      const res = await api.getCustomerLedger(cust.id);
      setLedgerInvoices(res.invoices);
      setLedgerPayments(res.payments);
    } catch (err: any) {
      alert(err.message || 'Failed to load customer ledger');
    } finally {
      setIsLedgerLoading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCustomer || payAmount <= 0) return;

    try {
      await api.recordCustomerPayment(payingCustomer.id, {
        branch_id: activeBranchId,
        amount: payAmount,
        payment_method: payMethod,
        reference_number: payRef,
        notes: payNotes,
      });

      setPayingCustomer(null);
      setPayAmount(0);
      setPayRef('');
      setPayNotes('');
      loadCustomers();
    } catch (err: any) {
      alert(err.message || 'Failed to record customer payment');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <Users className="w-6 h-6 text-indigo-600 mr-2" />
            Customers & Accounts
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage customer contact info, credit limits, unpaid balances, and record customer payments.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Customer
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search by name, phone, email, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </form>
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400">No customers found.</div>
        ) : (
          customers.map((c) => {
            const hasDebt = Number(c.balance) > 0;
            const availableCredit = Number(c.credit_limit) - Number(c.balance);

            return (
              <div
                key={c.id}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 flex flex-col justify-between hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{c.name}</h4>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                        {c.customer_type === 'CORPORATE' ? 'Company' : c.customer_type === 'WHOLESALE' ? 'Wholesale' : 'Retail'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase">Unpaid Balance</span>
                      <span
                        className={`text-base font-bold font-mono ${
                          hasDebt ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        ${Number(c.balance).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 mt-4 text-xs text-slate-600">
                    {c.phone && (
                      <div className="flex items-center">
                        <Phone className="w-3.5 h-3.5 mr-2 text-slate-400" />
                        <span>{c.phone}</span>
                      </div>
                    )}
                    {c.email && (
                      <div className="flex items-center">
                        <Mail className="w-3.5 h-3.5 mr-2 text-slate-400" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}
                    {(c.address || c.city) && (
                      <div className="flex items-center">
                        <MapPin className="w-3.5 h-3.5 mr-2 text-slate-400" />
                        <span className="truncate">{[c.address, c.city].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Credit Limit</span>
                      <span className="font-mono font-semibold text-slate-800">
                        ${Number(c.credit_limit).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Available Credit</span>
                      <span className="font-mono font-semibold text-indigo-700">
                        ${availableCredit.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 mt-5 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenLedger(c)}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Account History
                  </button>

                  {hasDebt && (
                    <button
                      onClick={() => {
                        setPayingCustomer(c);
                        setPayAmount(Number(c.balance));
                      }}
                      className="flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5 mr-1" />
                      Record Payment
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ================= MODAL: ADD CUSTOMER ================= */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Customer"
        subtitle="Add customer contact info, type, and credit limit"
        maxWidth="md"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Customer / Company Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. John Doe or CyberCore Ltd"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Phone Number</label>
              <input
                type="text"
                placeholder="+1 (555) 234-5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Email Address</label>
              <input
                type="email"
                placeholder="customer@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Customer Type</label>
              <select
                value={custType}
                onChange={(e) => setCustType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              >
                <option value="RETAIL">Retail Customer</option>
                <option value="WHOLESALE">Wholesale Buyer</option>
                <option value="CORPORATE">Company / Business</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Credit Limit ($)</label>
              <input
                type="number"
                placeholder="0"
                value={creditLimit === 0 ? '' : creditLimit}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const v = e.target.value;
                  setCreditLimit(v === '' ? 0 : parseFloat(v) || 0);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Address</label>
            <input
              type="text"
              placeholder="e.g. 742 Evergreen Terrace"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
            >
              Save Customer
            </button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: CUSTOMER LEDGER ================= */}
      {selectedCustomer && (
        <Modal
          isOpen={Boolean(selectedCustomer)}
          onClose={() => setSelectedCustomer(null)}
          title={`Account History: ${selectedCustomer.name}`}
          subtitle={`Unpaid Balance: $${Number(selectedCustomer.balance).toFixed(2)} • Credit Limit: $${Number(selectedCustomer.credit_limit).toFixed(2)}`}
          maxWidth="4xl"
        >
          {isLedgerLoading ? (
            <div className="py-12 text-center text-slate-400">Loading history...</div>
          ) : (
            <div className="space-y-6 text-xs">
              {/* Invoices */}
              <div className="space-y-2">
                <h5 className="font-bold text-slate-800 uppercase tracking-wider">
                  Past Sales & Invoices ({ledgerInvoices.length})
                </h5>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Invoice #</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3 text-right">Total</th>
                        <th className="py-2 px-3 text-right">Paid</th>
                        <th className="py-2 px-3 text-right">Unpaid Balance</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledgerInvoices.map((inv) => (
                        <tr key={inv.id}>
                          <td className="py-2 px-3 font-mono font-semibold text-indigo-700">{inv.invoice_number}</td>
                          <td className="py-2 px-3 text-slate-600">{new Date(inv.sale_date).toLocaleDateString()}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold">${Number(inv.total).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-700">${Number(inv.paid_amount).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-rose-700">${Number(inv.balance_due).toFixed(2)}</td>
                          <td className="py-2 px-3 font-semibold">{inv.payment_status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment Settlements */}
              <div className="space-y-2">
                <h5 className="font-bold text-slate-800 uppercase tracking-wider">
                  Payments Received ({ledgerPayments.length})
                </h5>
                {ledgerPayments.length === 0 ? (
                  <p className="text-slate-400 italic">No payments recorded yet.</p>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Branch</th>
                          <th className="py-2 px-3">Payment Method</th>
                          <th className="py-2 px-3">Reference #</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ledgerPayments.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2 px-3 font-mono">{new Date(p.payment_date).toLocaleDateString()}</td>
                            <td className="py-2 px-3">{p.branch_name}</td>
                            <td className="py-2 px-3">{p.payment_method}</td>
                            <td className="py-2 px-3 font-mono text-slate-500">{p.reference_number || '-'}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                              ${Number(p.amount).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ================= MODAL: RECEIVE PAYMENT ================= */}
      {payingCustomer && (
        <Modal
          isOpen={Boolean(payingCustomer)}
          onClose={() => setPayingCustomer(null)}
          title={`Collect Payment: ${payingCustomer.name}`}
          subtitle={`Current Balance Owed: $${Number(payingCustomer.balance).toFixed(2)}`}
          maxWidth="md"
        >
          <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Payment Amount ($) *</label>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                max={Number(payingCustomer.balance)}
                placeholder="0.00"
                value={payAmount === 0 ? '' : payAmount}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const v = e.target.value;
                  setPayAmount(v === '' ? 0 : parseFloat(v) || 0);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-sm"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Payment Method</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              >
                <option value="Cash">Cash</option>
                <option value="Card">Credit/Debit Card</option>
                <option value="Bank Transfer">Bank Wire / ACH</option>
                <option value="Check">Business Check</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Reference / Check #</label>
              <input
                type="text"
                placeholder="e.g. WIRE-88421 or CHK #1094"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPayingCustomer(null)}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs"
              >
                Record Payment
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
