import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal.tsx';
import { Badge } from '../common/Badge.tsx';
import { api } from '../../services/api.ts';
import {
  Cpu, Calendar, Building, ShoppingBag, ShieldCheck,
  Wrench, ArrowRight, Truck, User, Clock, AlertTriangle
} from 'lucide-react';

interface SerialHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  serialNumber: string | null;
}

export const SerialHistoryModal: React.FC<SerialHistoryModalProps> = ({
  isOpen,
  onClose,
  serialNumber,
}) => {
  const [data, setData] = useState<{ serial: any; movements: any[]; repairs: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && serialNumber) {
      setLoading(true);
      setError(null);
      api
        .getSerialHistory(serialNumber)
        .then((res) => setData(res))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    } else {
      setData(null);
    }
  }, [isOpen, serialNumber]);

  if (!serialNumber) return null;

  const s = data?.serial;

  // Calculate warranty days remaining
  let warrantyText = 'No warranty info';
  let isWarrantyActive = false;
  if (s?.warranty_end) {
    const end = new Date(s.warranty_end).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      warrantyText = `Active (${diffDays} days remaining)`;
      isWarrantyActive = true;
    } else {
      warrantyText = `Expired (${Math.abs(diffDays)} days ago)`;
      isWarrantyActive = false;
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Serial History: ${serialNumber}`}
      subtitle="Complete history of this item from supplier purchase to customer warranty and repairs"
      maxWidth="3xl"
    >
      {loading ? (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm">Loading history for this item...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2 shrink-0" />
          {error}
        </div>
      ) : s ? (
        <div className="space-y-6">
          {/* Hardware Identity Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <Cpu className="w-5 h-5 text-indigo-600" />
                  <h4 className="text-base font-bold text-slate-900">{s.product_name}</h4>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-mono">
                  Product Code: {s.sku} • Model: {s.model || 'Standard'} • Category: {s.category_name || 'General'}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Badge status={s.status} />
                <span className="text-xs font-mono font-bold px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-800">
                  {s.serial_number}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block">Current Store</span>
                <span className="font-semibold text-slate-800 flex items-center mt-0.5">
                  <Building className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  {s.branch_name} ({s.branch_code})
                </span>
                {s.current_location && (
                  <span className="text-[11px] text-slate-500 block mt-0.5">{s.current_location}</span>
                )}
              </div>

              <div>
                <span className="text-slate-400 block">Supplier</span>
                <span className="font-semibold text-slate-800 block mt-0.5">{s.supplier_name || 'Direct Import'}</span>
                {s.purchase_date && (
                  <span className="text-[11px] text-slate-500 block">
                    {new Date(s.purchase_date).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div>
                <span className="text-slate-400 block">Purchased By (Customer)</span>
                <span className="font-semibold text-slate-800 block mt-0.5">
                  {s.customer_name || (s.status === 'Sold' ? 'Walk-in Customer' : 'In Stock (Not sold yet)')}
                </span>
                {s.sale_invoice_number && (
                  <span className="text-[11px] text-indigo-600 font-mono block">Receipt: {s.sale_invoice_number}</span>
                )}
              </div>

              <div>
                <span className="text-slate-400 block">Warranty Status</span>
                <span
                  className={`font-semibold block mt-0.5 ${
                    isWarrantyActive ? 'text-emerald-700' : 'text-slate-600'
                  }`}
                >
                  {warrantyText}
                </span>
                {s.warranty_end && (
                  <span className="text-[11px] text-slate-500 block">
                    Until {new Date(s.warranty_end).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Repair Tickets for this Serial (if any) */}
          {data?.repairs && data.repairs.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                <Wrench className="w-4 h-4 mr-1.5 text-amber-600" />
                Repair Tickets for this Item ({data.repairs.length})
              </h5>
              <div className="space-y-2">
                {data.repairs.map((r, rIdx) => (
                  <div key={rIdx} className="bg-amber-50/60 border border-amber-200 rounded-lg p-3 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold font-mono text-amber-900">{r.ticket_number}</span>
                        <span className="text-slate-600 ml-2">({r.branch_name})</span>
                        <p className="text-slate-800 font-medium mt-1">Issue: {r.problem_description}</p>
                      </div>
                      <Badge status={r.status} />
                    </div>
                    {r.diagnosis && (
                      <p className="text-slate-600 mt-1 text-[11px] bg-white/70 p-1.5 rounded border border-amber-100">
                        <span className="font-semibold">Diagnosis:</span> {r.diagnosis}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chronological Stock & Action Timeline */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
              <Clock className="w-4 h-4 mr-1.5 text-indigo-600" />
              History & Movements Timeline
            </h5>

            {data?.movements && data.movements.length > 0 ? (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {data.movements.map((m, idx) => (
                  <div key={idx} className="relative group">
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white border-2 border-indigo-600 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs hover:border-indigo-300 transition-colors">
                      <div className="flex justify-between items-start text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">{m.movement_type}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-600 font-medium">{m.branch_name}</span>
                        </div>
                        <span className="text-slate-400 text-[11px]">
                          {new Date(m.created_at).toLocaleString()}
                        </span>
                      </div>
                      {m.notes && <p className="text-xs text-slate-600 mt-1">{m.notes}</p>}
                      <div className="flex items-center text-[11px] text-slate-400 mt-1.5 space-x-3">
                        {m.staff_name && (
                          <span className="flex items-center">
                            <User className="w-3 h-3 mr-1" />
                            {m.staff_name}
                          </span>
                        )}
                        {m.reference_id && (
                          <span className="font-mono text-slate-500">Ref: {m.reference_id}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No stock movements recorded yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
