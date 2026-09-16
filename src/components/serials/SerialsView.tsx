import React, { useState, useEffect } from 'react';
import { ProductSerial } from '../../types.ts';
import { api } from '../../services/api.ts';
import { Badge } from '../common/Badge.tsx';
import { SerialHistoryModal } from './SerialHistoryModal.tsx';
import {
  Search, ShieldCheck, Cpu, Filter, Eye, Clock,
  CheckCircle2, AlertCircle, Building, User
} from 'lucide-react';

interface SerialsViewProps {
  activeBranchId: string;
}

export const SerialsView: React.FC<SerialsViewProps> = ({ activeBranchId }) => {
  const [serials, setSerials] = useState<ProductSerial[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSerial, setSelectedSerial] = useState<string | null>(null);

  useEffect(() => {
    loadSerials();
  }, [activeBranchId, statusFilter]);

  const loadSerials = async () => {
    setLoading(true);
    try {
      const res = await api.getSerials({
        branch_id: activeBranchId || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setSerials(res.serials);
    } catch (err) {
      console.error('Failed to load serials:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = serials.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.serial_number.toLowerCase().includes(q) ||
      s.product_name.toLowerCase().includes(q) ||
      s.sku.toLowerCase().includes(q) ||
      (s.customer_name && s.customer_name.toLowerCase().includes(q)) ||
      (s.sale_invoice_number && s.sale_invoice_number.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <ShieldCheck className="w-6 h-6 text-indigo-600 mr-2" />
            Serial Numbers & Warranty
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Look up serial numbers to see where items came from, who bought them, and warranty status.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <span className="text-slate-500">Total Serial Numbers:</span>
          <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold font-mono rounded-lg">
            {serials.length}
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search serial number, product name, invoice, customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center shrink-0">
            <Filter className="w-3.5 h-3.5 mr-1" /> Status:
          </span>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'In Stock', label: 'In Stock' },
            { id: 'Sold', label: 'Sold' },
            { id: 'Under Repair', label: 'In Repair' },
            { id: 'Transferred', label: 'Moved Store' },
            { id: 'Warranty Claim', label: 'Warranty Return' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === st.id
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Serials Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Serial Number</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Store Location & Shelf</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Customer & Invoice</th>
                <th className="py-3 px-4">Warranty</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading serial numbers...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No serial numbers found matching your search.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  let isWarrantyActive = false;
                  if (s.warranty_end) {
                    isWarrantyActive = new Date(s.warranty_end).getTime() > Date.now();
                  }

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                        {s.serial_number}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{s.product_name}</div>
                        <div className="text-[10px] font-mono text-slate-400">Code: {s.sku}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center text-slate-700 font-medium">
                          <Building className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          {s.branch_name}
                        </div>
                        {s.current_location && (
                          <div className="text-[10px] text-slate-400">{s.current_location}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge status={s.status} />
                      </td>
                      <td className="py-3 px-4">
                        {s.customer_name ? (
                          <div>
                            <span className="font-medium text-slate-800">{s.customer_name}</span>
                            {s.sale_invoice_number && (
                              <span className="block text-[10px] font-mono text-indigo-600">
                                {s.sale_invoice_number}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">In Stock (Not sold yet)</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {s.warranty_end ? (
                          <div>
                            <span
                              className={`inline-flex items-center text-[11px] font-semibold ${
                                isWarrantyActive ? 'text-emerald-700' : 'text-slate-500'
                              }`}
                            >
                              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                              {isWarrantyActive ? 'Active' : 'Expired'}
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              {new Date(s.warranty_end).toLocaleDateString()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedSerial(s.serial_number)}
                          className="inline-flex items-center px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View History
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Serial Trace Modal */}
      <SerialHistoryModal
        isOpen={Boolean(selectedSerial)}
        onClose={() => setSelectedSerial(null)}
        serialNumber={selectedSerial}
      />
    </div>
  );
};
