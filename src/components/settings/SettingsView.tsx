import React, { useState, useEffect } from 'react';
import { Branch, User, AuditLog } from '../../types.ts';
import { api } from '../../services/api.ts';
import { Modal } from '../common/Modal.tsx';
import {
  Settings, Building, Users, Shield, Plus,
  MapPin, Phone, Mail, CheckCircle2, RefreshCw,
  Search, Filter, Download, FileText, Lock, UserPlus, Clock
} from 'lucide-react';

interface SettingsViewProps {
  user: User;
  activeBranchId: string;
  onBranchUpdated: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  activeBranchId,
  onBranchUpdated,
}) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<'branches' | 'staff' | 'audit' | 'policies'>('branches');
  const [loading, setLoading] = useState(true);

  // New Branch Modal
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [bName, setBName] = useState('');
  const [bCode, setBCode] = useState('');
  const [bAddress, setBAddress] = useState('');
  const [bCity, setBCity] = useState('');
  const [bPhone, setBPhone] = useState('');
  const [bTax, setBTax] = useState<number>(8.5);

  // New Staff Modal
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState<'BRANCH_MANAGER' | 'CASHIER' | 'TECHNICIAN' | 'INVENTORY_MANAGER'>('CASHIER');
  const [staffBranchId, setStaffBranchId] = useState('');
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);

  // Audit Logs Filter
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');

  // Store Policies & Receipt Settings
  const [receiptFooter, setReceiptFooter] = useState(
    localStorage.getItem('cu_receipt_footer') || 'Thank you for shopping with us! Standard 30-day warranty applies on parts.'
  );
  const [returnDays, setReturnDays] = useState(
    Number(localStorage.getItem('cu_return_days')) || 14
  );
  const [storePolicySaved, setStorePolicySaved] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bRes, uRes, aRes] = await Promise.all([
        api.getBranches(),
        api.getUsers(),
        api.getAuditLogs().catch(() => ({ auditLogs: [] })),
      ]);
      setBranches(bRes.branches || []);
      setUsers(uRes.users || []);
      setAuditLogs(aRes.auditLogs || []);
    } catch (err) {
      console.error('Failed to load settings data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bName.trim() || !bCode.trim()) return;

    try {
      await api.createBranch({
        branch_name: bName,
        branch_code: bCode.toUpperCase(),
        address: bAddress,
        city: bCity,
        phone: bPhone,
        tax_rate: bTax,
      });

      setIsAddBranchOpen(false);
      setBName('');
      setBCode('');
      setBAddress('');
      setBPhone('');
      await loadData();
      onBranchUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to create branch');
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !staffEmail.trim() || !staffPassword.trim()) return;

    setIsCreatingStaff(true);
    try {
      await api.createUser({
        name: staffName,
        email: staffEmail,
        password: staffPassword,
        role_name: staffRole,
        branch_id: staffBranchId || null,
      });

      setIsAddStaffOpen(false);
      setStaffName('');
      setStaffEmail('');
      setStaffPassword('');
      await loadData();
      alert('Staff member registered successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to create staff member');
    } finally {
      setIsCreatingStaff(false);
    }
  };

  const handleSavePolicies = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('cu_receipt_footer', receiptFooter);
    localStorage.setItem('cu_return_days', String(returnDays));
    setStorePolicySaved(true);
    setTimeout(() => setStorePolicySaved(false), 3000);
  };

  const handleExportAuditCSV = () => {
    if (auditLogs.length === 0) return;
    const headers = ['ID', 'Date', 'User', 'Action', 'Entity', 'Branch', 'Details'];
    const rows = filteredAuditLogs.map((a) => [
      a.id,
      new Date(a.created_at).toISOString(),
      `"${a.user_name || ''}"`,
      `"${a.action || ''}"`,
      `"${a.entity || ''}"`,
      `"${a.branch_name || a.branch_code || ''}"`,
      `"${JSON.stringify(a.new_value || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredAuditLogs = auditLogs.filter((log) => {
    const q = auditSearch.toLowerCase();
    const matchesSearch =
      log.action?.toLowerCase().includes(q) ||
      log.user_name?.toLowerCase().includes(q) ||
      log.entity?.toLowerCase().includes(q) ||
      JSON.stringify(log.new_value || '').toLowerCase().includes(q);

    const matchesAction =
      auditActionFilter === 'ALL' ||
      log.action?.toUpperCase().includes(auditActionFilter);

    return matchesSearch && matchesAction;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans antialiased">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center">
            <Settings className="w-5 h-5 text-indigo-600 mr-2" />
            Store Settings & Staff Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage store locations, team member permissions, activity history, and receipt rules.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex space-x-1 text-xs">
            <button
              onClick={() => setActiveTab('branches')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'branches' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Store Locations ({branches.length})
            </button>
            <button
              onClick={() => setActiveTab('staff')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'staff' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Staff Members ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'audit' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Activity History ({auditLogs.length})
            </button>
            <button
              onClick={() => setActiveTab('policies')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'policies' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Receipt & Return Rules
            </button>
          </div>

          {activeTab === 'branches' && (
            <button
              onClick={() => setIsAddBranchOpen(true)}
              className="flex items-center px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Store Location
            </button>
          )}

          {activeTab === 'staff' && (
            <button
              onClick={() => setIsAddStaffOpen(true)}
              className="flex items-center px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 mr-1" />
              Add Staff Member
            </button>
          )}

          {activeTab === 'audit' && (
            <button
              onClick={handleExportAuditCSV}
              className="flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              title="Download activity log as CSV file"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Download CSV
            </button>
          )}
        </div>
      </div>

      {/* ================= TAB 1: RETAIL BRANCHES ================= */}
      {activeTab === 'branches' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {branches.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-3 hover:border-slate-300 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{b.branch_name}</h3>
                    <span className="font-mono text-xs font-semibold text-slate-500">
                      Store Code: {b.branch_code}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Sales Tax</span>
                  <span className="text-sm font-bold font-mono text-slate-900">{b.tax_rate}%</span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 pt-3 border-t border-slate-100 font-sans">
                {b.address && (
                  <div className="flex items-center">
                    <MapPin className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                    <span>{b.address} {b.city ? `• ${b.city}` : ''}</span>
                  </div>
                )}
                {b.phone && (
                  <div className="flex items-center">
                    <Phone className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                    <span>{b.phone}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================= TAB 2: STAFF & RBAC ================= */}
      {activeTab === 'staff' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Job Role & Access</th>
                  <th className="py-3 px-4">Assigned Store</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-slate-900">{u.name}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {u.role_name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {u.branch_name || 'All Stores'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center text-emerald-700 font-semibold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 3: AUDIT TRAIL & LOGS ================= */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search activity, person, or details..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
              >
                <option value="ALL">All Activities</option>
                <option value="SALE">Sales & Register</option>
                <option value="SHIFT">Cash Register & Shifts</option>
                <option value="RETURN">Returns</option>
                <option value="STOCK">Stock Changes</option>
                <option value="PURCHASE">Supplier Orders</option>
                <option value="REPAIR">Repairs</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Team Member</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Item / Record</th>
                    <th className="py-3 px-4">Store Location</th>
                    <th className="py-3 px-4">Activity Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                        No activity found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 text-slate-600 font-sans text-[11px]">
                          {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5 px-4 font-sans font-bold text-slate-900">
                          {log.user_name || 'System Auto'}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 font-sans">
                          {log.entity} {log.entity_id ? `(#${log.entity_id.slice(0, 8)})` : ''}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-slate-600">
                          {log.branch_name || log.branch_code || 'All Stores'}
                        </td>
                        <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-xs truncate">
                          {typeof log.new_value === 'object'
                            ? JSON.stringify(log.new_value)
                            : String(log.new_value || '')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: STORE POLICIES & RECEIPTS ================= */}
      {activeTab === 'policies' && (
        <div className="max-w-2xl bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Receipt Message & Return Window</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              This message prints on customer receipts and sets how many days customers have to return items.
            </p>
          </div>

          <form onSubmit={handleSavePolicies} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Receipt Bottom Message</label>
              <textarea
                rows={3}
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                placeholder="Message printed at bottom of every customer receipt..."
                className="w-full p-3 border border-slate-200 rounded-xl text-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Return Window (Days)</label>
              <input
                type="number"
                min="0"
                max="90"
                value={returnDays}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setReturnDays(Number(e.target.value))}
                className="w-32 p-2 border border-slate-200 rounded-xl font-mono text-slate-900 font-bold"
              />
            </div>

            {storePolicySaved && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Settings saved successfully!</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Save Settings
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODAL: ADD BRANCH ================= */}
      <Modal
        isOpen={isAddBranchOpen}
        onClose={() => setIsAddBranchOpen(false)}
        title="Add New Store Location"
        subtitle="Enter the store name, short code, tax rate, and address"
        maxWidth="md"
      >
        <form onSubmit={handleCreateBranch} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Store Name *</label>
              <input
                required
                type="text"
                placeholder="e.g. Westside Store"
                value={bName}
                onChange={(e) => setBName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Store Code (e.g. BR03) *</label>
              <input
                required
                type="text"
                maxLength={6}
                placeholder="e.g. BR03"
                value={bCode}
                onChange={(e) => setBCode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">City / Mall Location</label>
              <input
                type="text"
                placeholder="e.g. Seattle, WA"
                value={bCity}
                onChange={(e) => setBCity(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Sales Tax Rate (%)</label>
              <input
                required
                type="number"
                step="0.01"
                value={bTax}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setBTax(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Store Street Address</label>
            <input
              type="text"
              placeholder="e.g. 1024 Silicon Way, Suite 100"
              value={bAddress}
              onChange={(e) => setBAddress(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Store Phone Number</label>
            <input
              type="text"
              placeholder="e.g. +1 (555) 019-2834"
              value={bPhone}
              onChange={(e) => setBPhone(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddBranchOpen(false)}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
            >
              Save Store Location
            </button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: ADD STAFF MEMBER ================= */}
      {isAddStaffOpen && (
        <Modal
          isOpen={isAddStaffOpen}
          onClose={() => setIsAddStaffOpen(false)}
          title="Add New Staff Member"
          subtitle="Set up their name, email, login password, and role permissions"
          maxWidth="md"
        >
          <form onSubmit={handleCreateStaff} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Full Name *</label>
              <input
                required
                type="text"
                placeholder="e.g. Alex Morgan"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Login Email Address *</label>
              <input
                required
                type="email"
                placeholder="e.g. alex@company.com"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Password *</label>
              <input
                required
                type="password"
                placeholder="••••••••"
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Role & Permissions *</label>
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value="CASHIER">Cashier (Sales & Register)</option>
                  <option value="BRANCH_MANAGER">Store Manager</option>
                  <option value="TECHNICIAN">Repair Technician</option>
                  <option value="INVENTORY_MANAGER">Inventory Manager</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Store Location</label>
                <select
                  value={staffBranchId}
                  onChange={(e) => setStaffBranchId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value="">All Stores</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.branch_name} ({b.branch_code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddStaffOpen(false)}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingStaff}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isCreatingStaff ? 'Saving...' : 'Add Staff Member'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
