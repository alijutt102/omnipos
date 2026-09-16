import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import {
  Wrench, CheckCircle2, Clock, AlertCircle, ShieldCheck,
  Phone, User, Calendar, ExternalLink, MessageSquare, Send,
  Printer, ArrowRight, Smartphone, Copy, Check
} from 'lucide-react';

interface LiveRepairTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTicketNumber?: string;
}

const REPAIR_STAGES = [
  { key: 'RECEIVED', label: 'Device Received', desc: 'Item safely logged at store counter' },
  { key: 'DIAGNOSING', label: 'Testing & Diagnosing', desc: 'Finding what is causing the problem' },
  { key: 'WAITING_FOR_PARTS', label: 'Waiting for Parts', desc: 'Replacement parts are ordered and on the way' },
  { key: 'REPAIRING', label: 'Repair in Progress', desc: 'Technician is fixing the device' },
  { key: 'READY', label: 'Ready for Pickup', desc: 'Device is fixed, tested, and ready' },
  { key: 'DELIVERED', label: 'Collected by Customer', desc: 'Picked up and paid' },
];

export const LiveRepairTrackerModal: React.FC<LiveRepairTrackerModalProps> = ({
  isOpen,
  onClose,
  initialTicketNumber = '',
}) => {
  const [ticketNumber, setTicketNumber] = useState(initialTicketNumber);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketData, setTicketData] = useState<any | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (initialTicketNumber && isOpen) {
      setTicketNumber(initialTicketNumber);
      handleTrack(initialTicketNumber);
    }
  }, [initialTicketNumber, isOpen]);

  const handleTrack = async (searchNum: string) => {
    if (!searchNum.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.trackRepairTicket(searchNum.trim());
      if (res.ticket) {
        setTicketData(res.ticket);
      } else {
        setError('No active repair ticket found with this reference number.');
      }
    } catch (err: any) {
      setError(err.message || 'Ticket not found. Check the ticket number and try again.');
      setTicketData(null);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Determine stage progress
  const currentStageIndex = ticketData
    ? REPAIR_STAGES.findIndex((s) => s.key === ticketData.status)
    : 0;

  // Format WhatsApp Message
  const getWhatsAppUrl = () => {
    if (!ticketData) return '#';
    const phone = (ticketData.customer_phone || '').replace(/[^0-9]/g, '');
    const text = encodeURIComponent(
      `*Repair Status Update - ${ticketData.branch_name || 'Hardware Repair Center'}*\n` +
      `Hello ${ticketData.customer_name},\n` +
      `Your device *${ticketData.brand} ${ticketData.model || ticketData.device}* (Ticket #${ticketData.ticket_number}) is currently: *${ticketData.status.replace(/_/g, ' ')}*.\n` +
      (ticketData.diagnosis ? `*Diagnostic:* ${ticketData.diagnosis}\n` : '') +
      `*Cost:* $${Number(ticketData.customer_cost).toFixed(2)}\n` +
      `*Store Contact:* ${ticketData.branch_phone || 'Call or reply to this chat'}\n` +
      `Thank you for trusting our workshop!`
    );
    return `https://wa.me/${phone}?text=${text}`;
  };

  const getSmsUrl = () => {
    if (!ticketData) return '#';
    const phone = (ticketData.customer_phone || '').replace(/[^0-9]/g, '');
    const body = encodeURIComponent(
      `[${ticketData.branch_name || 'Repair Center'}] Ticket #${ticketData.ticket_number} for your ${ticketData.brand} ${ticketData.device} is: ${ticketData.status}. Total: $${Number(ticketData.customer_cost).toFixed(2)}.`
    );
    return `sms:${phone}?body=${body}`;
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}/?trackTicket=${ticketData?.ticket_number || ticketNumber}`
    );
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Track Repair Job & Notify Customer
              </h3>
              <p className="text-[11px] text-slate-500">
                Check current progress and send updates via WhatsApp or SMS
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xs font-bold p-1 rounded-lg"
          >
            Close
          </button>
        </div>

        {/* Search input if not loaded */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter repair ticket number (e.g. REP-2026-0001)..."
              value={ticketNumber}
              onChange={(e) => setTicketNumber(e.target.value)}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              onClick={() => handleTrack(ticketNumber)}
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Find Job'}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {ticketData && (
            <div className="space-y-6">
              {/* Ticket Status Hero Banner */}
              <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-indigo-300 font-bold bg-white/10 px-2 py-0.5 rounded">
                      #{ticketData.ticket_number}
                    </span>
                    <span className="text-xs text-slate-300">• {ticketData.branch_name}</span>
                  </div>
                  <h4 className="text-lg font-bold mt-1 text-white">
                    {ticketData.brand} {ticketData.model || ticketData.device}
                  </h4>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    Customer: {ticketData.customer_name} {ticketData.customer_phone ? `(${ticketData.customer_phone})` : ''}
                  </p>
                </div>

                <div className="text-right sm:text-right">
                  <span className="text-[10px] text-slate-300 uppercase tracking-wider block">Price to Customer</span>
                  <span className="text-2xl font-mono font-bold text-emerald-400">
                    ${Number(ticketData.customer_cost).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {ticketData.warranty_days ? `${ticketData.warranty_days} days warranty` : 'Standard store warranty'}
                  </span>
                </div>
              </div>

              {/* Multi-Step Timeline Progress Bar */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Current Repair Progress
                </h5>

                <div className="space-y-3">
                  {REPAIR_STAGES.map((stage, idx) => {
                    const isDone = currentStageIndex > idx;
                    const isCurrent = currentStageIndex === idx;

                    return (
                      <div key={stage.key} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                              isDone
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : isCurrent
                                ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-2xs animate-pulse'
                                : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                          </div>
                          {idx < REPAIR_STAGES.length - 1 && (
                            <div
                              className={`w-0.5 h-6 ${
                                isDone ? 'bg-emerald-600' : 'bg-slate-200'
                              }`}
                            />
                          )}
                        </div>

                        <div className="flex-1 pb-1">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs font-bold ${
                                isCurrent ? 'text-indigo-900' : isDone ? 'text-slate-900' : 'text-slate-400'
                              }`}
                            >
                              {stage.label}
                            </span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded text-[10px] font-bold">
                                Current Status
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{stage.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Diagnosis & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Customer's Problem
                  </span>
                  <p className="text-slate-800 font-medium">
                    {ticketData.problem_description || 'No notes specified.'}
                  </p>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Technician Notes & Diagnosis
                  </span>
                  <p className="text-slate-800 font-medium">
                    {ticketData.diagnosis || ticketData.repair_notes || 'Diagnosis in progress by technician.'}
                  </p>
                </div>
              </div>

              {/* WhatsApp / SMS Digital Dispatch Actions */}
              <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-3">
                <div className="flex justify-between items-center">
                  <h5 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-indigo-600" />
                    Send Quick Update to Customer
                  </h5>
                  <span className="text-[11px] text-indigo-700 font-mono">
                    {ticketData.customer_phone || 'No phone saved'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href={getWhatsAppUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-[140px] px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer text-center"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Send WhatsApp Message</span>
                  </a>

                  <a
                    href={getSmsUrl()}
                    className="flex-1 min-w-[140px] px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer text-center"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send SMS Text</span>
                  </a>

                  <button
                    onClick={copyShareLink}
                    className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                    <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
