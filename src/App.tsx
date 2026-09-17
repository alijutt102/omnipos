import React, { useState, useEffect } from 'react';
import { User, Branch } from './types.ts';
import { api } from './services/api.ts';
import { LoginView } from './components/auth/LoginView.tsx';
import { DashboardView } from './components/dashboard/DashboardView.tsx';
import { POSTerminal } from './components/pos/POSTerminal.tsx';
import { InventoryView } from './components/inventory/InventoryView.tsx';
import { SerialsView } from './components/serials/SerialsView.tsx';
import { TransfersView } from './components/transfers/TransfersView.tsx';
import { RepairsView } from './components/repairs/RepairsView.tsx';
import { SalesView } from './components/sales/SalesView.tsx';
import { CustomersView } from './components/customers/CustomersView.tsx';
import { SuppliersView } from './components/suppliers/SuppliersView.tsx';
import { ExpensesView } from './components/expenses/ExpensesView.tsx';
import { ReportsView } from './components/reports/ReportsView.tsx';
import { SettingsView } from './components/settings/SettingsView.tsx';
import { CashRegisterView } from './components/cash/CashRegisterView.tsx';
import { SystemGuideModal } from './components/common/SystemGuideModal.tsx';
import { PCBuilderView } from './components/pcbuilder/PCBuilderView.tsx';
import { BarcodeLabelDesigner } from './components/labels/BarcodeLabelDesigner.tsx';
import { AutoReorderDashboard } from './components/purchases/AutoReorderDashboard.tsx';
import { TradeInView } from './components/tradein/TradeInView.tsx';
import { StaffPerformanceView } from './components/staff/StaffPerformanceView.tsx';
import { PromotionsView } from './components/promotions/PromotionsView.tsx';
import { AccessModule, canAccessModule } from './access.ts';

import {
  LayoutDashboard, ShoppingBag, Package, ShieldCheck,
  ArrowLeftRight, Wrench, Receipt, Users, Truck,
  TrendingDown, FileText, Settings, Building2, LogOut,
  ChevronDown, UserCheck, Sparkles, Menu, X, Maximize2, Minimize2,
  Clock, Store, Layers, MonitorDot, Landmark, HelpCircle, BookOpen,
  Info, Cpu, Tag, RefreshCcw, RefreshCw, Award, Search,
  ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, BadgePercent
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('pos'); // Default directly to POS workstation!
  const [pendingCartItems, setPendingCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSystemGuideOpen, setIsSystemGuideOpen] = useState(false);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState<boolean>(() => {
    return localStorage.getItem('omnipos_dismiss_welcome') !== 'true';
  });

  useEffect(() => {
    checkAuth();
  }, []);

  // Global F1 keyboard shortcut to toggle System Guide
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setIsSystemGuideOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Live system clock ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const checkAuth = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('omnipos_jwt_token');
      if (token) {
        const res = await api.getMe();
        setCurrentUser(res.user);
        await loadBranches(res.user);
      }
    } catch (err) {
      console.warn('Authentication token expired or invalid:', err);
      localStorage.removeItem('omnipos_jwt_token');
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const loadBranches = async (user: User) => {
    try {
      const res = await api.getBranches();
      setBranches(res.branches);
      if (user.branch_id) {
        setActiveBranchId(user.branch_id);
      } else if (res.branches.length > 0) {
        setActiveBranchId(res.branches[0].id);
      }
    } catch (err) {
      console.error('Failed to load branches:', err);
    }
  };

  const handleLoginSuccess = async (user: User, token: string) => {
    localStorage.setItem('omnipos_jwt_token', token);
    setCurrentUser(user);
    await loadBranches(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('omnipos_jwt_token');
    setCurrentUser(null);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const isOwner =
    currentUser?.role_name === 'TENANT_OWNER' ||
    currentUser?.role_name === 'SUPER_ADMIN';

  // Grouped Navigation Structure for maximum clarity and ease of understanding
  const navGroups = [
    {
      title: 'Sales',
      items: [
        { id: 'pos', module: 'pos' as AccessModule, label: 'New Sale', icon: ShoppingBag, desc: 'Make a sale and print a receipt', badge: 'Cashier' },
        { id: 'pc-builder', module: 'pc-builder' as AccessModule, label: 'Build a PC', icon: Cpu, desc: 'Choose parts and make a PC quote' },
        { id: 'promotions', module: 'promotions' as AccessModule, label: 'Discounts', icon: BadgePercent, desc: 'Create and manage discounts' },
        { id: 'cash-register', module: 'cash-register' as AccessModule, label: 'Cash Drawer', icon: Landmark, desc: 'Open, count, and close the cash drawer' },
        { id: 'sales', module: 'sales' as AccessModule, label: 'Past Sales', icon: Receipt, desc: 'View old sales, invoices, and returns' },
      ],
    },
    {
      title: 'Products & Stock',
      items: [
        { id: 'inventory', module: 'inventory' as AccessModule, label: 'Products', icon: Package, desc: 'View products, prices, and stock' },
        { id: 'serials', module: 'serials' as AccessModule, label: 'Serial Numbers', icon: ShieldCheck, desc: 'Find serial numbers and warranties' },
        { id: 'reorder', module: 'reorder' as AccessModule, label: 'Low Stock', icon: RefreshCcw, desc: 'See products that need reordering' },
        { id: 'labels', module: 'labels' as AccessModule, label: 'Price Tags', icon: Tag, desc: 'Print product price and barcode tags' },
        { id: 'transfers', module: 'transfers' as AccessModule, label: 'Move Stock', icon: ArrowLeftRight, desc: 'Move products between shops' },
      ],
    },
    {
      title: 'Services',
      items: [
        { id: 'repairs', module: 'repairs' as AccessModule, label: 'Repairs', icon: Wrench, desc: 'Track customer repair jobs' },
        { id: 'trade-in', module: 'trade-in' as AccessModule, label: 'Buy Used Devices', icon: RefreshCw, desc: 'Buy used phones, laptops, and PCs' },
      ],
    },
    {
      title: 'People & Suppliers',
      items: [
        { id: 'customers', module: 'customers' as AccessModule, label: 'Customers', icon: Users, desc: 'View customers and their account balance' },
        { id: 'suppliers', module: 'suppliers' as AccessModule, label: 'Suppliers', icon: Truck, desc: 'Manage suppliers and purchase orders' },
        { id: 'staff-performance', module: 'staff-performance' as AccessModule, label: 'Staff Goals', icon: Award, desc: 'View staff targets and performance' },
      ],
    },
    {
      title: 'Reports & Settings',
      items: [
        { id: 'dashboard', module: 'dashboard' as AccessModule, label: 'Dashboard', icon: LayoutDashboard, desc: 'See today\'s sales, money, and stock' },
        { id: 'expenses', module: 'expenses' as AccessModule, label: 'Expenses', icon: TrendingDown, desc: 'Record shop bills and other costs' },
        { id: 'reports', module: 'reports' as AccessModule, label: 'Reports', icon: FileText, desc: 'View sales, costs, and profit' },
        { id: 'settings', module: 'settings' as AccessModule, label: 'Settings', icon: Settings, desc: 'Manage shops, staff, and store rules' },
      ],
    },
  ];

  const visibleGroups = navGroups.map((g) => ({
    ...g,
    items: g.items.filter((item) => canAccessModule(currentUser, item.module)),
  })).filter((g) => g.items.length > 0);
  const allNavItems = visibleGroups.flatMap((g) => g.items);
  const activeItemInfo = allNavItems.find((i) => i.id === activeTab) || allNavItems[0];

  useEffect(() => {
    if (activeItemInfo && activeTab !== activeItemInfo.id) setActiveTab(activeItemInfo.id);
  }, [activeItemInfo, activeTab]);

  const filteredGroups = visibleGroups.map((g) => {
    if (!navSearch.trim()) return g;
    const q = navSearch.toLowerCase();
    const matchingItems = g.items.filter(
      (item) => item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)
    );
    return { ...g, items: matchingItems };
  }).filter((g) => g.items.length > 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-sans">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto shadow-lg">
            <Building2 className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Computer Store POS</h3>
            <p className="text-xs text-slate-400 mt-0.5">Loading store register & inventory...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const activeBranch = branches.find((b) => b.id === activeBranchId);

  return (
    <div className="min-h-screen bg-slate-100 flex font-sans text-slate-800 antialiased select-none overflow-hidden">
      {/* ================= MOBILE SIDEBAR BACKDROP ================= */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ================= MODERN CLEAN SIDEBAR ================= */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-all duration-200 ${
          isMobileMenuOpen
            ? 'translate-x-0 w-64 shadow-2xl'
            : '-translate-x-full lg:translate-x-0 ' + (isSidebarCollapsed ? 'w-16' : 'w-64')
        }`}
      >
        {/* Brand Header */}
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs shrink-0">
              <Store className="w-5 h-5 text-white" />
            </div>
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-white tracking-tight truncate">OmniPOS Retail</h1>
                <p className="text-[11px] text-slate-400 truncate">
                  {currentUser.org_name || 'Computer Store'}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              if (window.innerWidth < 1024) {
                setIsMobileMenuOpen(false);
              } else {
                setIsSidebarCollapsed(!isSidebarCollapsed);
              }
            }}
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Quick Menu Search (when expanded) */}
        {!isSidebarCollapsed && (
          <div className="p-2.5 border-b border-slate-800 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search menu features..."
                value={navSearch}
                onChange={(e) => setNavSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
              {navSearch && (
                <button
                  onClick={() => setNavSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* Scrollable Navigation Groups */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
          {filteredGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {!isSidebarCollapsed && (
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {group.title}
                </div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    title={isSidebarCollapsed ? `${item.label}: ${item.desc}` : undefined}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    {!isSidebarCollapsed && (
                      <div className="flex-1 text-left truncate flex items-center justify-between">
                        <span className="truncate">{item.label}</span>
                        {item.badge && !isActive && (
                          <span className="text-[9px] bg-slate-800 text-indigo-300 font-mono px-1.5 py-0.5 rounded border border-slate-700">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {filteredGroups.length === 0 && (
            <div className="text-center py-6 text-xs text-slate-500">
              No matching modules found.
            </div>
          )}
        </div>

        {/* Bottom User Profile & Logout */}
        <div className="p-3 border-t border-slate-800 shrink-0 bg-slate-950/50">
          {!isSidebarCollapsed ? (
            <div className="space-y-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 flex items-center justify-center text-xs font-bold shrink-0">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {currentUser.role_name.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                <button
                  onClick={handleLogout}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-slate-700"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Switch / Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                title={`${currentUser.name} (${currentUser.role_name})`}
                className="w-8 h-8 rounded-xl bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 flex items-center justify-center text-xs font-bold cursor-default"
              >
                {currentUser.name.charAt(0)}
              </div>
              <button
                onClick={handleLogout}
                title="Switch User / Sign Out"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ================= MAIN CONTENT WORKSPACE ================= */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Streamlined Top App Bar */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 shrink-0 shadow-2xs z-30">
          {/* Left: Mobile Toggle & Page Title */}
          <div className="flex items-center space-x-3 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 text-slate-500 hover:text-slate-900 lg:hidden rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight leading-none truncate">
                  {activeItemInfo?.label}
                </h2>
                <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">Online</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate hidden md:block">
                {activeItemInfo?.desc}
              </p>
            </div>
          </div>

          {/* Right: Quick Actions & Branch Switcher */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* Quick Return to POS Register button (if not currently on POS) */}
            {activeTab !== 'pos' && (
              <button
                onClick={() => setActiveTab('pos')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Go to Checkout</span>
                <span className="sm:hidden">POS</span>
              </button>
            )}

            {/* Branch Selector */}
            <div className="flex items-center">
              {isOwner ? (
                <div className="relative">
                  <select
                    value={activeBranchId}
                    onChange={(e) => setActiveBranchId(e.target.value)}
                    className="bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-xl pl-2.5 pr-7 py-1.5 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-2xs"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        📍 {b.branch_name} ({b.branch_code})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs">
                  <Store className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
                  <span>{currentUser.branch_name || 'Main Branch'}</span>
                </div>
              )}
            </div>

            {/* Quick Tour / Guide */}
            <button
              onClick={() => setIsSystemGuideOpen(true)}
              title="Open User Guide [F1]"
              className="hidden md:flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>User Guide</span>
              <span className="text-[10px] text-slate-400 font-mono hidden xl:inline">[F1]</span>
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer hidden sm:flex"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Live Station Clock */}
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-600 font-mono bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </header>

        {/* Workspace Container */}
        <main className="flex-1 overflow-y-auto bg-slate-100">
        {activeTab === 'pos' && (
          <POSTerminal
            user={currentUser}
            activeBranchId={activeBranchId || branches[0]?.id || ''}
            branches={branches}
            onSelectBranch={(id) => setActiveBranchId(id)}
            onNavigate={(tab) => setActiveTab(tab)}
            initialCartItems={pendingCartItems}
            onClearInitialCart={() => setPendingCartItems([])}
          />
        )}

        {activeTab === 'pc-builder' && (
          <PCBuilderView
            user={currentUser}
            activeBranchId={activeBranchId}
            onSendToPOS={(items) => {
              setPendingCartItems(items);
              setActiveTab('pos');
            }}
          />
        )}

        {activeTab === 'labels' && (
          <BarcodeLabelDesigner
            user={currentUser}
            activeBranchId={activeBranchId}
          />
        )}

        {activeTab === 'reorder' && (
          <AutoReorderDashboard
            user={currentUser}
            activeBranchId={activeBranchId}
          />
        )}

        {activeTab === 'trade-in' && (
          <TradeInView
            user={currentUser}
            activeBranchId={activeBranchId}
          />
        )}

        {activeTab === 'staff-performance' && (
          <StaffPerformanceView
            user={currentUser}
            activeBranchId={activeBranchId}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            user={currentUser}
            activeBranchId={activeBranchId}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            user={currentUser}
            activeBranchId={activeBranchId}
          />
        )}

        {activeTab === 'serials' && (
          <SerialsView
            user={currentUser}
            activeBranchId={activeBranchId}
          />
        )}

        {activeTab === 'transfers' && (
          <TransfersView
            user={currentUser}
            activeBranchId={activeBranchId}
          />
        )}

        {activeTab === 'repairs' && (
          <RepairsView
            user={currentUser}
            activeBranchId={activeBranchId}
          />
        )}

        {activeTab === 'sales' && (
          <SalesView
            user={currentUser}
            activeBranchId={activeBranchId}
            branches={branches}
            onSelectBranch={(id) => setActiveBranchId(id)}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'promotions' && (
          <PromotionsView
            currentUser={currentUser}
          />
        )}

        {activeTab === 'cash-register' && (
          <CashRegisterView
            user={currentUser}
            activeBranchId={activeBranchId}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersView
            user={currentUser}
            activeBranchId={activeBranchId}
          />
        )}

        {activeTab === 'suppliers' && (
          <SuppliersView
            user={currentUser}
            activeBranchId={activeBranchId}
          />
        )}

        {activeTab === 'expenses' && (
          <ExpensesView
            user={currentUser}
            activeBranchId={activeBranchId}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            user={currentUser}
            activeBranchId={activeBranchId}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            user={currentUser}
            activeBranchId={activeBranchId}
            onBranchUpdated={() => loadBranches(currentUser)}
          />
        )}
        </main>
      </div>

      {/* Interactive System User Tour & Guide Modal */}
      <SystemGuideModal
        isOpen={isSystemGuideOpen}
        onClose={() => setIsSystemGuideOpen(false)}
        onNavigate={(tab) => {
          setActiveTab(tab);
          setIsSystemGuideOpen(false);
        }}
      />
    </div>
  );
}
