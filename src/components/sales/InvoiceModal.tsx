import React, { useState } from 'react';
import { Modal } from '../common/Modal.tsx';
import { Sale, SaleItem, SalePayment } from '../../types.ts';
import {
  Printer, Receipt, FileText, CheckCircle2, ShieldCheck,
  Building2, Phone, Mail, MapPin, MessageSquare, Smartphone
} from 'lucide-react';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  items: SaleItem[];
  payments: SalePayment[];
  onNavigate?: (tab: string) => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  sale,
  items,
  payments,
  onNavigate,
}) => {
  const [viewMode, setViewMode] = useState<'A4' | 'THERMAL'>('THERMAL');

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Transaction #${sale.invoice_number}`}
      subtitle={`${sale.branch_name} (${sale.branch_code}) • ${new Date(sale.sale_date).toLocaleString()}`}
      maxWidth={viewMode === 'THERMAL' ? 'md' : '4xl'}
    >
      {/* View Switcher & Action Bar */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 print:hidden">
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80">
          <button
            onClick={() => setViewMode('THERMAL')}
            className={`flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              viewMode === 'THERMAL'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
            80mm Thermal Receipt
          </button>
          <button
            onClick={() => setViewMode('A4')}
            className={`flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              viewMode === 'A4'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
            Standard Tax Invoice (A4)
          </button>
        </div>

        <div className="flex items-center gap-2">
          {sale.customer_phone && (
            <>
              <a
                href={`https://wa.me/${sale.customer_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  `*Receipt - ${sale.branch_name}*\nInvoice #${sale.invoice_number}\nDate: ${new Date(sale.sale_date).toLocaleDateString()}\nTotal: $${Number(sale.grand_total).toFixed(2)}\nItems: ${items.map(i => `${i.product_name} (x${i.quantity})`).join(', ')}\nThank you for shopping with us!`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 shadow-xs transition-colors cursor-pointer"
                title="Send WhatsApp Receipt"
              >
                <MessageSquare className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                WhatsApp
              </a>
              <a
                href={`sms:${sale.customer_phone.replace(/[^0-9]/g, '')}?body=${encodeURIComponent(
                  `[${sale.branch_name}] Receipt #${sale.invoice_number} for $${Number(sale.grand_total).toFixed(2)}. Thank you for your purchase!`
                )}`}
                className="flex items-center px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-xl text-xs font-bold border border-indigo-200 shadow-xs transition-colors cursor-pointer"
                title="Send SMS Receipt"
              >
                <Smartphone className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                SMS
              </a>
            </>
          )}
          {onNavigate && (
            <button
              onClick={() => {
                onClose();
                onNavigate('sales');
              }}
              className="flex items-center px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 shadow-xs transition-colors cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5 mr-1.5" />
              All Invoices
            </button>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Document
          </button>
        </div>
      </div>

      {/* PRINTABLE CONTENT */}
      {viewMode === 'A4' ? (
        /* ================= A4 INVOICE FORMAT ================= */
        <div id="printable-invoice" className="bg-white p-8 border border-slate-200/80 rounded-xl text-slate-800 space-y-6 shadow-xs">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                  OP
                </span>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  {sale.business_name || 'OmniPOS Computer Systems LLC'}
                </h1>
              </div>
              <p className="text-xs font-semibold text-indigo-600">
                {sale.branch_name} • Code: {sale.branch_code}
              </p>
              <div className="text-xs text-slate-500 mt-2 space-y-0.5">
                <p>{sale.branch_address}</p>
                {sale.branch_phone && <p>Tel: {sale.branch_phone}</p>}
                {sale.tax_number && <p className="font-mono">Tax ID / VAT: {sale.tax_number}</p>}
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-2.5 py-1 rounded bg-slate-100 text-slate-800 font-mono text-xs font-bold mb-2">
                ORIGINAL TAX INVOICE
              </span>
              <div className="text-xs space-y-1 font-mono">
                <p>
                  <span className="text-slate-400">Invoice:</span> <strong>{sale.invoice_number}</strong>
                </p>
                <p>
                  <span className="text-slate-400">Date:</span> {new Date(sale.sale_date).toLocaleDateString()}
                </p>
                <p>
                  <span className="text-slate-400">Cashier:</span> {sale.cashier_name || 'Staff'}
                </p>
              </div>
            </div>
          </div>

          {/* Customer / Bill To */}
          <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Billed To
              </span>
              <h4 className="font-bold text-slate-900 text-sm">{sale.customer_name || 'Walk-in Retail Customer'}</h4>
              {sale.customer_phone && <p className="text-slate-600 mt-0.5 font-mono">Tel: {sale.customer_phone}</p>}
              {sale.customer_email && <p className="text-slate-600 font-mono">{sale.customer_email}</p>}
              {sale.customer_address && <p className="text-slate-600">{sale.customer_address}</p>}
            </div>
            <div className="text-right flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Payment Status
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded font-bold text-xs ${
                    sale.payment_status === 'PAID'
                      ? 'bg-emerald-100 text-emerald-800'
                      : sale.payment_status === 'PARTIAL'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {sale.payment_status}
                </span>
              </div>
              <div className="font-mono text-slate-500 text-[11px]">
                Currency: {sale.currency || 'USD ($)'}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/90 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Discount</th>
                  <th className="py-2.5 px-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 font-sans">
                      <div className="font-semibold text-slate-900">{it.product_name}</div>
                      {it.serial_numbers && it.serial_numbers.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {it.serial_numbers.map((sn, sIdx) => (
                            <span
                              key={sIdx}
                              className="inline-flex items-center px-1.5 py-0.5 bg-indigo-50 border border-indigo-200 rounded text-[10px] font-mono text-indigo-700 font-medium"
                            >
                              <ShieldCheck className="w-2.5 h-2.5 mr-0.5 text-indigo-500" />
                              SN: {sn}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-500">{it.sku}</td>
                    <td className="py-3 px-3 text-right text-slate-700">${Number(it.unit_price).toFixed(2)}</td>
                    <td className="py-3 px-3 text-center font-bold text-slate-900">{it.quantity}</td>
                    <td className="py-3 px-3 text-right text-amber-700">
                      {Number(it.discount) > 0 ? `-$${Number(it.discount).toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      ${Number(it.total_price).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Totals */}
          <div className="flex justify-end pt-2">
            <div className="w-72 space-y-1.5 text-xs">
              <div className="flex justify-between py-1 text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-medium">${Number(sale.subtotal).toFixed(2)}</span>
              </div>
              {Number(sale.discount) > 0 && (
                <div className="flex justify-between py-1 text-amber-700 font-medium">
                  <span>Overall Discount {sale.coupon_code ? `(${sale.coupon_code})` : ''}:</span>
                  <span className="font-mono">-${Number(sale.discount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between py-1 text-slate-600">
                <span>Tax:</span>
                <span className="font-mono font-medium">${Number(sale.tax).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2.5 border-t border-b border-slate-900 text-sm font-bold text-slate-900">
                <span>Grand Total:</span>
                <span className="font-mono text-base text-indigo-600">${Number(sale.total).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 text-emerald-700 font-medium">
                <span>Amount Paid:</span>
                <span className="font-mono font-bold">${Number(sale.paid_amount).toFixed(2)}</span>
              </div>
              {Number(sale.balance_due) > 0 && (
                <div className="flex justify-between py-1 text-rose-700 font-bold bg-rose-50 px-2 rounded">
                  <span>Balance Due:</span>
                  <span className="font-mono">${Number(sale.balance_due).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment breakdown */}
          {payments.length > 0 && (
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-500 font-mono">
              <span className="font-sans font-semibold text-slate-700">Payment Breakdown:</span>
              <div className="flex gap-4">
                {payments.map((p, pIdx) => (
                  <span key={pIdx}>
                    {p.payment_method}: <strong>${Number(p.amount).toFixed(2)}</strong>
                    {p.reference_number && ` (${p.reference_number})`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Footer Terms */}
          <div className="pt-6 border-t border-slate-200 text-[11px] text-slate-500 space-y-1 text-center font-sans">
            <p className="font-bold text-slate-700">Thank you for your business!</p>
            <p>30-day warranty on hardware parts. Keep this tax invoice as proof of purchase.</p>
          </div>
        </div>
      ) : (
        /* ================= 80MM THERMAL RECEIPT FORMAT ================= */
        <div className="bg-slate-100/70 p-4 rounded-xl flex justify-center">
          <div className="w-[320px] bg-white p-5 shadow-md border border-slate-200/80 font-mono text-xs text-slate-800 space-y-3 leading-tight rounded-sm relative">
            {/* Thermal paper header styling */}
            <div className="text-center space-y-1 border-b border-dashed border-slate-400 pb-3">
              <div className="w-8 h-8 mx-auto bg-slate-900 text-white rounded flex items-center justify-center font-bold text-xs mb-1">
                OP
              </div>
              <p className="font-bold text-sm tracking-wider uppercase">{sale.business_name || 'OmniPOS Retail'}</p>
              <p className="font-semibold text-slate-700">{sale.branch_name}</p>
              <p className="text-[10px] text-slate-500">{sale.branch_address}</p>
              {sale.branch_phone && <p className="text-[10px] text-slate-500">TEL: {sale.branch_phone}</p>}
            </div>

            {/* Receipt Meta */}
            <div className="text-[11px] space-y-0.5 border-b border-dashed border-slate-400 pb-2.5">
              <div className="flex justify-between">
                <span>RECEIPT:</span>
                <span className="font-bold">{sale.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span>DATE:</span>
                <span>{new Date(sale.sale_date).toLocaleDateString()} {new Date(sale.sale_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between">
                <span>CASHIER:</span>
                <span>{sale.cashier_name || 'Staff'}</span>
              </div>
              <div className="flex justify-between">
                <span>CUSTOMER:</span>
                <span className="truncate max-w-[160px]">{sale.customer_name || 'Walk-in Customer'}</span>
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-2 border-b border-dashed border-slate-400 pb-3 text-[11px]">
              {items.map((it, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between font-bold text-slate-900">
                    <span className="truncate max-w-[190px]">{it.product_name}</span>
                    <span>${Number(it.total_price).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[10px]">
                    <span>{it.quantity} @ ${Number(it.unit_price).toFixed(2)}</span>
                    {Number(it.discount) > 0 && (
                      <span className="text-amber-700">Disc: -${Number(it.discount).toFixed(2)}</span>
                    )}
                  </div>
                  {it.serial_numbers && it.serial_numbers.map((sn, sIdx) => (
                    <p key={sIdx} className="text-[9px] text-indigo-700 font-semibold">
                      ▸ SN: {sn}
                    </p>
                  ))}
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-1 text-xs border-b border-dashed border-slate-400 pb-2.5">
              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span>${Number(sale.subtotal).toFixed(2)}</span>
              </div>
              {Number(sale.discount) > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>DISCOUNT {sale.coupon_code ? `(${sale.coupon_code})` : ''}:</span>
                  <span>-${Number(sale.discount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>TAX:</span>
                <span>${Number(sale.tax).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-300">
                <span>TOTAL DUE:</span>
                <span>${Number(sale.total).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-800 font-bold">
                <span>PAID:</span>
                <span>${Number(sale.paid_amount).toFixed(2)}</span>
              </div>
              {Number(sale.balance_due) > 0 && (
                <div className="flex justify-between text-rose-700 font-bold">
                  <span>BALANCE DUE:</span>
                  <span>${Number(sale.balance_due).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Methods */}
            <div className="text-[10px] space-y-0.5 border-b border-dashed border-slate-400 pb-2">
              {payments.map((p, idx) => (
                <div key={idx} className="flex justify-between text-slate-600">
                  <span>{p.payment_method.toUpperCase()}:</span>
                  <span>${Number(p.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Barcode visual representation */}
            <div className="pt-2 text-center space-y-1.5">
              <div className="h-9 w-4/5 mx-auto bg-[repeating-linear-gradient(90deg,#000,#000_2px,transparent_2px,transparent_4px,#000_4px,#000_7px,transparent_7px,transparent_9px)] opacity-85" />
              <p className="text-[9px] font-mono tracking-widest text-slate-500">{sale.invoice_number}</p>
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-slate-500 pt-1 space-y-0.5">
              <p className="font-bold text-slate-700">*** THANK YOU FOR YOUR PURCHASE ***</p>
              <p>Warranty validated via serial number</p>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
