import React, { useState, useEffect } from 'react';
import { RepairTicket, User, Customer } from '../../types.ts';
import { api } from '../../services/api.ts';
import { Badge } from '../common/Badge.tsx';
import { Modal } from '../common/Modal.tsx';
import { LiveRepairTrackerModal } from './LiveRepairTrackerModal.tsx';
import {
  Wrench, Plus, Search, Filter, Printer, User as UserIcon,
  Cpu, Clock, ShieldCheck, CheckCircle2, AlertCircle, Phone,
  MessageSquare, ExternalLink, Smartphone
} from 'lucide-react';

interface RepairsViewProps {
  user: User;
  activeBranchId: string;
}

export const RepairsView: React.FC<RepairsViewProps> = ({ user, activeBranchId }) => {
  const [repairs, setRepairs] = useState<RepairTicket[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Live Repair Tracker & WhatsApp Modal
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [activeTrackingTicketNumber, setActiveTrackingTicketNumber] = useState('');


  // New Ticket Modal
  const [isOpen, setIsOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [device, setDevice] = useState('Laptop');
  const [brand, setBrand] = useState('Dell');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [estimatedCost, setEstimatedCost] = useState<number>(100);

  // Edit Ticket Modal
  const [selectedTicket, setSelectedTicket] = useState<RepairTicket | null>(null);
  const [editStatus, setEditStatus] = useState<string>('RECEIVED');
  const [editDiagnosis, setEditDiagnosis] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editPartsCost, setEditPartsCost] = useState<number>(0);
  const [editLaborCost, setEditLaborCost] = useState<number>(0);
  const [editCustomerCost, setEditCustomerCost] = useState<number>(0);

  useEffect(() => {
    loadRepairs();
    loadCustomers();
  }, [activeBranchId, statusFilter]);

  const loadRepairs = async () => {
    setLoading(true);
    try {
      const res = await api.getRepairs({
        branch_id: activeBranchId || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setRepairs(res.repairs);
    } catch (err) {
      console.error('Failed to load repairs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await api.getCustomers();
      setCustomers(res.customers);
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !problemDescription.trim()) return;

    try {
      await api.createRepair({
        branch_id: activeBranchId,
        customer_id: customerId,
        device,
        brand,
        model,
        serial_number: serialNumber,
        problem_description: problemDescription,
        customer_cost: estimatedCost,
        technician_id: user.id,
      });

      setIsOpen(false);
      setProblemDescription('');
      setModel('');
      setSerialNumber('');
      loadRepairs();
    } catch (err: any) {
      alert(err.message || 'Failed to create repair ticket');
    }
  };

  const handleOpenEdit = (ticket: RepairTicket) => {
    setSelectedTicket(ticket);
    setEditStatus(ticket.status);
    setEditDiagnosis(ticket.diagnosis || '');
    setEditNotes(ticket.repair_notes || '');
    setEditPartsCost(Number(ticket.parts_cost) || 0);
    setEditLaborCost(Number(ticket.labor_cost) || 0);
    setEditCustomerCost(Number(ticket.customer_cost) || 0);
  };

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    try {
      await api.updateRepair(selectedTicket.id, {
        status: editStatus,
        diagnosis: editDiagnosis,
        repair_notes: editNotes,
        parts_cost: editPartsCost,
        labor_cost: editLaborCost,
        customer_cost: editCustomerCost,
      });

      setSelectedTicket(null);
      loadRepairs();
    } catch (err: any) {
      alert(err.message || 'Failed to update repair ticket');
    }
  };

  const filtered = repairs.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.ticket_number.toLowerCase().includes(q) ||
      r.customer_name.toLowerCase().includes(q) ||
      (r.serial_number && r.serial_number.toLowerCase().includes(q)) ||
      (r.model && r.model.toLowerCase().includes(q)) ||
      r.problem_description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <Wrench className="w-6 h-6 text-indigo-600 mr-2" />
            Repairs & Service Center
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Track device repairs, update repair status, parts used, labor fees, and notify customers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTrackingTicketNumber('');
              setTrackingModalOpen(true);
            }}
            className="flex items-center px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Smartphone className="w-4 h-4 mr-1.5 text-indigo-600" />
            Track Status & WhatsApp Alert
          </button>

          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Repair Job
          </button>
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
            placeholder="Search repair job #, customer, serial, device..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center shrink-0">
            <Filter className="w-3.5 h-3.5 mr-1" /> Status:
          </span>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'RECEIVED', label: 'Received' },
            { id: 'DIAGNOSING', label: 'Testing' },
            { id: 'WAITING_FOR_PARTS', label: 'Waiting for Parts' },
            { id: 'REPAIRING', label: 'In Progress' },
            { id: 'READY', label: 'Ready for Pickup' },
            { id: 'DELIVERED', label: 'Picked Up' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
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

      {/* Repairs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Job #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Device & Serial #</th>
                <th className="py-3 px-4">Customer's Problem</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Price to Customer</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading repair jobs...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No repair jobs found.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                      {r.ticket_number}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900 block">{r.customer_name}</span>
                      {r.customer_phone && (
                        <span className="text-[10px] text-slate-400 flex items-center">
                          <Phone className="w-3 h-3 mr-1" />
                          {r.customer_phone}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800">
                        {r.brand} {r.model || r.device}
                      </span>
                      {r.serial_number && (
                        <span className="block text-[10px] font-mono text-slate-500">
                          Serial: {r.serial_number}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <p className="text-slate-700 line-clamp-2">{r.problem_description}</p>
                      {r.diagnosis && (
                        <span className="text-[10px] text-indigo-600 block mt-0.5 font-medium">
                          Issue: {r.diagnosis}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge status={r.status} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      ${Number(r.customer_cost).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setActiveTrackingTicketNumber(r.ticket_number);
                            setTrackingModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          title="Track & WhatsApp Update"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(r)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                        >
                          Update Job
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL: INTAKE NEW REPAIR ================= */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Book in Device for Repair"
        subtitle="Record customer details, device problem, and initial price estimate"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Customer *</label>
            <select
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            >
              <option value="">Select Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Device Type</label>
              <select
                value={device}
                onChange={(e) => setDevice(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              >
                <option value="Laptop">Laptop</option>
                <option value="Desktop PC">Desktop Computer</option>
                <option value="GPU">Graphics Card (GPU)</option>
                <option value="Monitor">Monitor / Screen</option>
                <option value="Motherboard">Motherboard</option>
                <option value="Printer">Printer</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Brand / Maker</label>
              <input
                type="text"
                placeholder="e.g. Dell, ASUS, Lenovo, Apple"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Model Name / Number</label>
              <input
                type="text"
                placeholder="e.g. XPS 15 9520"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Device Serial Number (Optional)</label>
              <input
                type="text"
                placeholder="Serial number on device"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">What is wrong with the device? *</label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Screen stays black when powered on, liquid was spilled yesterday..."
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Estimated Price ($)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={estimatedCost === 0 ? '' : estimatedCost}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const v = e.target.value;
                setEstimatedCost(v === '' ? 0 : parseFloat(v) || 0);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
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
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs"
            >
              Create Repair Job
            </button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: UPDATE / DIAGNOSE TICKET ================= */}
      {selectedTicket && (
        <Modal
          isOpen={Boolean(selectedTicket)}
          onClose={() => setSelectedTicket(null)}
          title={`Update Repair Job ${selectedTicket.ticket_number}`}
          subtitle={`${selectedTicket.brand} ${selectedTicket.model || selectedTicket.device} • Customer: ${selectedTicket.customer_name}`}
          maxWidth="lg"
        >
          <form onSubmit={handleUpdateTicket} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Current Repair Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-bold"
              >
                <option value="RECEIVED">RECEIVED (Logged in at counter)</option>
                <option value="DIAGNOSING">DIAGNOSING (Checking the problem)</option>
                <option value="WAITING_FOR_PARTS">WAITING_FOR_PARTS (Parts ordered)</option>
                <option value="REPAIRING">REPAIRING (Fixing / replacing parts)</option>
                <option value="READY">READY (Fixed and tested - ready for pickup)</option>
                <option value="DELIVERED">DELIVERED (Customer collected and paid)</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">What was the actual problem?</label>
              <input
                type="text"
                placeholder="e.g. Broken screen connector, damaged charging port"
                value={editDiagnosis}
                onChange={(e) => setEditDiagnosis(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">What work did you do?</label>
              <textarea
                rows={2}
                placeholder="e.g. Installed new screen, cleaned dust and replaced thermal paste"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Parts Cost ($ What parts cost you)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={editPartsCost === 0 ? '' : editPartsCost}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEditPartsCost(v === '' ? 0 : parseFloat(v) || 0);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Labor Fee ($ Work cost)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={editLaborCost === 0 ? '' : editLaborCost}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEditLaborCost(v === '' ? 0 : parseFloat(v) || 0);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Total Price for Customer ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={editCustomerCost === 0 ? '' : editCustomerCost}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEditCustomerCost(v === '' ? 0 : parseFloat(v) || 0);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-indigo-700"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs"
              >
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Live Repair Tracker & WhatsApp Modal */}
      <LiveRepairTrackerModal
        isOpen={trackingModalOpen}
        onClose={() => setTrackingModalOpen(false)}
        initialTicketNumber={activeTrackingTicketNumber}
      />
    </div>
  );
};
