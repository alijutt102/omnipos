import React, { useState } from 'react';
import {
  X, BookOpen, ShoppingBag, Receipt, Landmark, Package,
  ShieldCheck, ArrowLeftRight, Wrench, Users, Truck,
  TrendingDown, FileText, Settings, Sparkles, CheckCircle2,
  HelpCircle, DollarSign, AlertTriangle, KeyRound, ChevronRight,
  Store, Building, ArrowRight, Laptop, Cpu, Hash, Tag, RefreshCw, Award
} from 'lucide-react';

interface SystemGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (tab: string) => void;
}

export const SystemGuideModal: React.FC<SystemGuideModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [activeGuideTab, setActiveGuideTab] = useState<'workflow' | 'modules' | 'glossary' | 'shortcuts' | 'roles'>('workflow');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white">OmniPOS New User Guide & System Tour</h3>
                <span className="text-[10px] font-mono bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 px-1.5 py-0.2 rounded font-bold">
                  BEGINNER FRIENDLY
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Understand how sales, inventory, serialized hardware, cash drawer shifts, and branch ledgers connect.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Guide [Esc]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2 bg-slate-50 border-b border-slate-200/80 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none text-xs">
          {[
            { id: 'workflow', label: '1. Daily Store Steps', icon: Sparkles },
            { id: 'modules', label: '2. All Features Explained', icon: Package },
            { id: 'glossary', label: '3. Easy Words Guide', icon: HelpCircle },
            { id: 'shortcuts', label: '4. Fast Keys [F1-F8]', icon: KeyRound },
            { id: 'roles', label: '5. Staff Logins & Roles', icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeGuideTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveGuideTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
          {/* TAB 1: DAILY STORE WORKFLOW */}
          {activeGuideTab === 'workflow' && (
            <div className="space-y-6">
              <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
                <h4 className="font-bold text-indigo-950 text-sm mb-1 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  How to Run Your Store Each Day (4 Simple Steps)
                </h4>
                <p className="text-xs text-indigo-900 leading-relaxed">
                  This system is built to make running your computer shop easy. Follow these 4 daily steps to keep your cash drawer balanced, stock accurate, and customers happy.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Step 1 */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 relative overflow-hidden">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 font-black text-xs flex items-center justify-center shrink-0">
                      1
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-900 text-xs">Morning: Open the Cash Drawer</h5>
                      <span className="text-[10px] text-slate-400 font-mono">Module: Cash Drawer</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Before selling anything, go to <strong>Cash Drawer</strong>. Count how much physical cash is in your drawer for making change (for example, $100 starting cash) and click <strong>Open Cash Drawer</strong>.
                  </p>
                  <div className="p-2 bg-slate-50 rounded-lg text-[11px] text-slate-500 border border-slate-100">
                    💡 <em>Why this matters:</em> Keeps cash count accurate and makes sure every cashier is accounted for.
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 relative overflow-hidden">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-800 font-black text-xs flex items-center justify-center shrink-0">
                      2
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-900 text-xs">All Day: Ring Up Sales at Checkout</h5>
                      <span className="text-[10px] text-slate-400 font-mono">Module: Cashier Checkout</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Click any product card or press <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">F3</code> to scan barcodes. Take cash, card, or store credit, then click <strong>Complete Sale</strong>.
                  </p>
                  <div className="p-2 bg-slate-50 rounded-lg text-[11px] text-slate-500 border border-slate-100">
                    💡 <em>Why this matters:</em> Instantly updates your stock count and prints a receipt with warranty information.
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 relative overflow-hidden">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0">
                      3
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-900 text-xs">Daytime: Manage Stock & Repairs</h5>
                      <span className="text-[10px] text-slate-400 font-mono">Modules: Products & Stock, Computer Repairs</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Check which products are running low in <strong>Reorder Low Stock</strong>. Book in customer laptops that need fixing in <strong>Computer Repairs</strong> with problem notes and estimated costs.
                  </p>
                  <div className="p-2 bg-slate-50 rounded-lg text-[11px] text-slate-500 border border-slate-100">
                    💡 <em>Why this matters:</em> You never run out of best-sellers, and repair jobs never get lost or forgotten.
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 relative overflow-hidden">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-800 font-black text-xs flex items-center justify-center shrink-0">
                      4
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-900 text-xs">Evening: Count Cash & Close Shift</h5>
                      <span className="text-[10px] text-slate-400 font-mono">Module: Cash Drawer</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    At the end of the shift, count all money in your drawer and click <strong>Close Cash Drawer</strong>. The system automatically compares the money counted against today's sales.
                  </p>
                  <div className="p-2 bg-slate-50 rounded-lg text-[11px] text-slate-500 border border-slate-100">
                    💡 <em>Why this matters:</em> Gives total peace of mind with clean daily records and no missing money.
                  </div>
                </div>
              </div>

              {/* Quick Jump Buttons */}
              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate?.('pos');
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Go to Cashier Checkout</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate?.('cash-register');
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Landmark className="w-3.5 h-3.5" />
                  <span>Go to Cash Drawer</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate?.('dashboard');
                  }}
                  className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl border border-slate-200 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Open Store Overview</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: MODULE DIRECTORY */}
          {activeGuideTab === 'modules' && (
            <div className="space-y-4">
              <p className="text-slate-600 text-xs">
                Here is what each section of your store app does, in plain English:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  {
                    id: 'pos',
                    title: 'Cashier Checkout',
                    icon: ShoppingBag,
                    color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
                    desc: 'Fast sales counter to ring up customers, scan barcodes, take cash or card, and print receipts.',
                  },
                  {
                    id: 'pc-builder',
                    title: 'PC Builder',
                    icon: Cpu,
                    color: 'text-cyan-600 bg-cyan-50 border-cyan-100',
                    desc: 'Pick computer parts that fit together (CPU, board, RAM, graphics card) and quote custom gaming or office PCs in 1 click.',
                  },
                  {
                    id: 'cash-register',
                    title: 'Cash Drawer',
                    icon: Landmark,
                    color: 'text-amber-600 bg-amber-50 border-amber-100',
                    desc: 'Count starting cash in the morning, log small cash spent during the day, and count drawer money when closing.',
                  },
                  {
                    id: 'sales',
                    title: 'Sales History',
                    icon: Receipt,
                    color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
                    desc: 'See all past sales and receipts, print extra copies, and process customer refunds or returns.',
                  },
                  {
                    id: 'inventory',
                    title: 'Products & Stock',
                    icon: Package,
                    color: 'text-purple-600 bg-purple-50 border-purple-100',
                    desc: 'See every item you sell, update prices, change how many are in stock, and add new products.',
                  },
                  {
                    id: 'serials',
                    title: 'Serials & Warranty',
                    icon: ShieldCheck,
                    color: 'text-sky-600 bg-sky-50 border-sky-100',
                    desc: 'Look up serial numbers for laptops and graphics cards to see when they were sold and if warranty is active.',
                  },
                  {
                    id: 'reorder',
                    title: 'Reorder Low Stock',
                    icon: Truck,
                    color: 'text-amber-600 bg-amber-50 border-amber-100',
                    desc: 'See which products are running out and order fresh stock from your suppliers in 1 click.',
                  },
                  {
                    id: 'labels',
                    title: 'Print Price Tags',
                    icon: Tag,
                    color: 'text-slate-600 bg-slate-50 border-slate-200',
                    desc: 'Print barcode price tags on sticky paper to put on store shelves or product boxes.',
                  },
                  {
                    id: 'transfers',
                    title: 'Move Stock Between Stores',
                    icon: ArrowLeftRight,
                    color: 'text-cyan-600 bg-cyan-50 border-cyan-100',
                    desc: 'Send products from one store branch to another and confirm when they arrive safely.',
                  },
                  {
                    id: 'repairs',
                    title: 'Computer Repairs',
                    icon: Wrench,
                    color: 'text-rose-600 bg-rose-50 border-rose-100',
                    desc: 'Take in customer laptops for repair, write what is broken, set repair costs, and send WhatsApp status updates.',
                  },
                  {
                    id: 'trade-in',
                    title: 'Buy Used Devices',
                    icon: RefreshCw,
                    color: 'text-violet-600 bg-violet-50 border-violet-100',
                    desc: 'Buy used laptops and graphics cards from customers for cash or store credit, then sell them as refurbished.',
                  },
                  {
                    id: 'customers',
                    title: 'Customers & Credit',
                    icon: Users,
                    color: 'text-teal-600 bg-teal-50 border-teal-100',
                    desc: 'Save customer phone numbers, addresses, and track who owes money or has store credit.',
                  },
                  {
                    id: 'suppliers',
                    title: 'Suppliers & Orders',
                    icon: Truck,
                    color: 'text-orange-600 bg-orange-50 border-orange-100',
                    desc: 'Save wholesale companies you buy from and keep track of purchase orders.',
                  },
                  {
                    id: 'staff-performance',
                    title: 'Staff Goals & Bonuses',
                    icon: Award,
                    color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
                    desc: 'Set monthly sales targets for workers and see how much bonus they earned.',
                  },
                  {
                    id: 'expenses',
                    title: 'Store Bills & Expenses',
                    icon: TrendingDown,
                    color: 'text-red-600 bg-red-50 border-red-100',
                    desc: 'Record what you spend on rent, electricity, internet, tea, and store supplies.',
                  },
                  {
                    id: 'dashboard',
                    title: 'Store Overview',
                    icon: Building,
                    color: 'text-blue-600 bg-blue-50 border-blue-100',
                    desc: 'Quick look at today\'s total sales, profits, best-selling items, and low stock warnings.',
                  },
                  {
                    id: 'reports',
                    title: 'Profit & Loss',
                    icon: FileText,
                    color: 'text-slate-600 bg-slate-50 border-slate-200',
                    desc: 'Simple money summary: Sales income minus cost of goods minus store bills equals money you keep.',
                  },
                  {
                    id: 'settings',
                    title: 'Store Settings',
                    icon: Settings,
                    color: 'text-gray-600 bg-gray-50 border-gray-200',
                    desc: 'Add store locations, create staff accounts, change tax rates, and customize receipt text.',
                  },
                ].map((mod) => {
                  const Icon = mod.icon;
                  return (
                    <div
                      key={mod.id}
                      className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex items-start gap-3 hover:border-slate-300 transition-colors"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${mod.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h5 className="font-bold text-slate-900 text-xs">{mod.title}</h5>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onNavigate?.(mod.id);
                            }}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                          >
                            Open →
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          {mod.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: HARDWARE & RETAIL GLOSSARY */}
          {activeGuideTab === 'glossary' && (
            <div className="space-y-4">
              <p className="text-slate-600 text-xs">
                Here are common store and accounting terms explained in simple everyday English:
              </p>

              <div className="space-y-3">
                <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">SKU = Product Code</span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-mono font-bold">Simple</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    A short code (like <strong>GPU-RTX-4070</strong>) that identifies an item in the computer. It makes searching and scanning faster.
                  </p>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">Serial Number (SN) = Item Fingerprint</span>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-mono font-bold">Important</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Expensive items like laptops and graphics cards have a unique serial number printed on the box. When you scan it during checkout, it prints on the customer's receipt so you can verify warranty if they return later.
                  </p>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">Starting Cash (Float) = Change in Drawer</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    The cash bills and coins placed in the drawer at the start of the day so you can give change to customers. You enter this when opening your shift.
                  </p>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">COGS = Cost of Items Sold</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    How much money you paid the supplier to buy the item. For example, if you bought a motherboard for $100 and sold it for $150, your cost is $100 and your gross profit is $50.
                  </p>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">RMA = Return or Defective Item Exchange</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Sending a faulty item back to the manufacturer or supplier to get a replacement or refund under warranty.
                  </p>
                </div>

                <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">Split Payment = Paying with Two Methods</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    When a customer pays part in cash and the rest on card or store credit (for example: $50 cash + $100 card).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SHORTCUTS */}
          {activeGuideTab === 'shortcuts' && (
            <div className="space-y-4">
              <p className="text-slate-600 text-xs">
                Speed is everything in high-volume retail. OmniPOS supports keyboard shortcuts for frontline cashiers:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-indigo-700 bg-indigo-100 px-2 py-1 rounded text-xs">[F1]</span>
                  <span className="font-sans text-slate-700 font-semibold text-right">Toggle This System Guide</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-900 bg-white px-2 py-1 rounded border text-xs">[F2]</span>
                  <span className="font-sans text-slate-700 font-semibold text-right">Search Product Catalog</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-900 bg-white px-2 py-1 rounded border text-xs">[F3]</span>
                  <span className="font-sans text-slate-700 font-semibold text-right">Barcode / Serial Scanner</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-900 bg-white px-2 py-1 rounded border text-xs">[F4]</span>
                  <span className="font-sans text-slate-700 font-semibold text-right">Quick Register Customer</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-900 bg-white px-2 py-1 rounded border text-xs">[F8]</span>
                  <span className="font-sans text-slate-700 font-semibold text-right">Cashier Handbook & POS Guide</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-900 bg-white px-2 py-1 rounded border text-xs">[Esc]</span>
                  <span className="font-sans text-slate-700 font-semibold text-right">Close Any Active Modal / Dialog</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-900 bg-white px-2 py-1 rounded border text-xs">[Enter]</span>
                  <span className="font-sans text-slate-700 font-semibold text-right">Confirm Barcode Scan / Modal Submit</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-900 bg-white px-2 py-1 rounded border text-xs">[Tab]</span>
                  <span className="font-sans text-slate-700 font-semibold text-right">Jump to Next Form Input</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ROLES & PERMISSIONS */}
          {activeGuideTab === 'roles' && (
            <div className="space-y-4">
              <p className="text-slate-600 text-xs">
                OmniPOS provides role-based access control to protect sensitive financial records and inventory:
              </p>

              <div className="space-y-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/90 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">David Vance (Tenant Owner / General Manager)</span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded">Full Admin Access</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Consolidated access to all branches. Can view P&L financial reports, change tax rates, create staff accounts, adjust stock, and view enterprise margins.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/90 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">Robert Sterling (Downtown Branch Manager)</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">Branch Authority</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Manages operations at Main Branch Downtown. Can approve purchase orders, authorize customer credit limits, initiate stock transfers, and oversee cashier shifts.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/90 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">Sarah Connor & Alex Mercer (Frontline POS Cashiers)</span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">Frontline POS</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Dedicated cashier terminal access. Can open shifts, ring up sales, scan barcodes, print receipts, and reconcile cash drawers. Restricted from editing global tax settings or wholesale distributor costs.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/90 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">Tony Stark (Hardware Repair Specialist)</span>
                    <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded">Technical Lab</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Diagnostic workshop technician. Manages customer repair tickets, tests faulty components, enters repair costs, and tracks RMA warranty claims.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row justify-between items-center gap-2 shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>You can open this guide anytime by clicking <strong>Guide & Help [F1]</strong> in the top bar.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Got It, Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
