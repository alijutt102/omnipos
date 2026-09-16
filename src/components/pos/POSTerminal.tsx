import React, { useState, useEffect, useRef } from 'react';
import { Product, Customer, ProductSerial, User } from '../../types.ts';
import { api } from '../../services/api.ts';
import { InvoiceModal } from '../sales/InvoiceModal.tsx';
import {
  Search, Barcode, ShoppingCart, Trash2, Plus, Minus,
  CreditCard, Banknote, Building2, UserCheck, AlertCircle,
  Receipt, ArrowRight, ShieldCheck, CheckCircle2, RotateCcw, X,
  Tag, Percent, Sparkles, SlidersHorizontal, Check, Zap, Laptop, Monitor, Cpu, Package, Landmark,
  HelpCircle, Info, Phone, Mail, MapPin, UserPlus, FileText, AlertTriangle, ExternalLink, BookOpen, Layers, BadgePercent, Clock, User as UserIcon
} from 'lucide-react';

interface POSTerminalProps {
  user: User;
  activeBranchId: string;
  branches?: any[];
  onSelectBranch?: (branchId: string) => void;
  onNavigate?: (tab: string) => void;
  initialCartItems?: any[];
  onClearInitialCart?: () => void;
}

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
  selectedSerials: string[];
  availableSerials?: ProductSerial[];
}

interface PaymentRow {
  method: 'Cash' | 'Card' | 'Bank Transfer' | 'Credit';
  amount: number;
  referenceNumber: string;
}

export const POSTerminal: React.FC<POSTerminalProps> = ({
  user,
  activeBranchId,
  branches = [],
  onSelectBranch,
  onNavigate,
  initialCartItems,
  onClearInitialCart,
}) => {
  // Resolve effective branch reliably (never empty)
  const effectiveBranchId =
    activeBranchId || (branches && branches.length > 0 ? branches[0].id : '') || user.branch_id || '';
  const currentBranchObj =
    branches?.find((b) => b.id === effectiveBranchId) ||
    (user.branch_id ? { id: user.branch_id, branch_name: user.branch_name, branch_code: user.branch_code } : null);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);

  // Automatically import items transferred from Custom PC Builder
  useEffect(() => {
    if (initialCartItems && initialCartItems.length > 0) {
      setCart((prev) => [...prev, ...initialCartItems]);
      onClearInitialCart?.();
    }
  }, [initialCartItems]);
  const [invoiceDiscount, setInvoiceDiscount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(8.25); // Sales tax
  const [saleNotes, setSaleNotes] = useState('');

  // Coupon / Promo Code state
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount_amount: number;
    description?: string;
  } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Payment Modal state
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([
    { method: 'Cash', amount: 0, referenceNumber: '' },
  ]);
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Completed Invoice Modal state
  const [completedSale, setCompletedSale] = useState<any | null>(null);
  const [completedItems, setCompletedItems] = useState<any[]>([]);
  const [completedPayments, setCompletedPayments] = useState<any[]>([]);

  // Last Created Invoice Banner state
  const [lastCreatedInvoice, setLastCreatedInvoice] = useState<{
    id: string;
    invoiceNumber: string;
    total: number;
    customer: string;
    sale?: any;
    items?: any[];
    payments?: any[];
  } | null>(null);

  // Add Customer Modal State (Enhanced with comprehensive data)
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAltPhone, setNewCustAltPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustCity, setNewCustCity] = useState('');
  const [newCustType, setNewCustType] = useState('RETAIL'); // 'RETAIL' | 'WHOLESALE' | 'CORPORATE' | 'VIP'
  const [newCustCreditLimit, setNewCustCreditLimit] = useState(1000);
  const [newCustOpeningBalance, setNewCustOpeningBalance] = useState(0);
  const [newCustNotes, setNewCustNotes] = useState('');

  // POS Help & Cashier Guide Modal State
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [showQuickTipsBar, setShowQuickTipsBar] = useState(true);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch initial data
  useEffect(() => {
    loadProducts();
    loadCategories();
    loadCustomers();
  }, [effectiveBranchId]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F3') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setIsNewCustomerOpen(true);
      } else if (e.key === 'F8') {
        e.preventDefault();
        setIsGuideOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadProducts = async () => {
    try {
      const res = await api.getProducts({ branch_id: effectiveBranchId });
      setProducts(res.products);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await api.getCategories();
      setCategories(res.categories);
    } catch (err) {
      console.error('Failed to load categories:', err);
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

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === 'ALL' || p.category_id === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      p.product_name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q));
    return matchesCategory && matchesQuery;
  });

  // Add product to cart
  const addToCart = async (prod: Product) => {
    const existingIndex = cart.findIndex((item) => item.product.id === prod.id);

    if (prod.serial_tracking_enabled) {
      try {
        const serialsRes = await api.getSerials({
          branch_id: activeBranchId,
          product_id: prod.id,
          status: 'In Stock',
        });
        const inStockSerials = serialsRes.serials;

        if (existingIndex > -1) {
          const item = cart[existingIndex];
          if (item.selectedSerials.length >= inStockSerials.length) {
            alert(`Cannot add more than ${inStockSerials.length} available serial numbers for this product.`);
            return;
          }
          const unassigned = inStockSerials.find(
            (s) => !item.selectedSerials.includes(s.serial_number)
          );
          if (unassigned) {
            const updated = [...cart];
            updated[existingIndex].quantity += 1;
            updated[existingIndex].selectedSerials.push(unassigned.serial_number);
            setCart(updated);
          }
        } else {
          if (inStockSerials.length === 0) {
            alert(`No in-stock serial numbers found for ${prod.product_name} at this branch.`);
            return;
          }
          setCart([
            ...cart,
            {
              product: prod,
              quantity: 1,
              unitPrice: Number(prod.selling_price),
              discount: 0,
              selectedSerials: [inStockSerials[0].serial_number],
              availableSerials: inStockSerials,
            },
          ]);
        }
      } catch (err) {
        console.error('Failed to fetch product serials:', err);
      }
    } else {
      if (existingIndex > -1) {
        const updated = [...cart];
        updated[existingIndex].quantity += 1;
        setCart(updated);
      } else {
        setCart([
          ...cart,
          {
            product: prod,
            quantity: 1,
            unitPrice: Number(prod.selling_price),
            discount: 0,
            selectedSerials: [],
          },
        ]);
      }
    }
  };

  // Barcode scan handler
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    const barcode = barcodeInput.trim();

    const match = products.find(
      (p) =>
        p.barcode?.toLowerCase() === barcode.toLowerCase() ||
        p.sku.toLowerCase() === barcode.toLowerCase()
    );

    if (match) {
      addToCart(match);
      setBarcodeInput('');
      return;
    }

    try {
      const serialRes = await api.getSerials({
        branch_id: activeBranchId,
        status: 'In Stock',
      });
      const serialMatch = serialRes.serials.find(
        (s) => s.serial_number.toLowerCase() === barcode.toLowerCase()
      );
      if (serialMatch) {
        const prod = products.find((p) => p.id === serialMatch.product_id);
        if (prod) {
          const existing = cart.find((item) => item.product.id === prod.id);
          if (existing) {
            if (!existing.selectedSerials.includes(serialMatch.serial_number)) {
              existing.selectedSerials.push(serialMatch.serial_number);
              existing.quantity = existing.selectedSerials.length;
              setCart([...cart]);
            }
          } else {
            setCart([
              ...cart,
              {
                product: prod,
                quantity: 1,
                unitPrice: Number(prod.selling_price),
                discount: 0,
                selectedSerials: [serialMatch.serial_number],
                availableSerials: [serialMatch],
              },
            ]);
          }
          setBarcodeInput('');
          return;
        }
      }
    } catch (err) {
      console.error('Error scanning serial:', err);
    }

    alert(`Item or serial number not recognized: "${barcode}"`);
    setBarcodeInput('');
  };

  const updateQuantity = (index: number, delta: number) => {
    const item = cart[index];
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }
    if (item.product.serial_tracking_enabled) {
      if (delta > 0) {
        const avail = item.availableSerials || [];
        const next = avail.find((s) => !item.selectedSerials.includes(s.serial_number));
        if (!next) {
          alert('No more in-stock serial numbers available for this product.');
          return;
        }
        item.selectedSerials.push(next.serial_number);
      } else {
        item.selectedSerials.pop();
      }
    }
    const updated = [...cart];
    updated[index].quantity = newQty;
    setCart(updated);
  };

  const removeFromCart = (index: number) => {
    const updated = [...cart];
    updated.splice(index, 1);
    setCart(updated);
  };

  const updateItemDiscount = (index: number, discount: number) => {
    const updated = [...cart];
    updated[index].discount = Math.max(0, discount);
    setCart(updated);
  };

  const updateItemSerial = (itemIndex: number, serialIndex: number, newSerial: string) => {
    const updated = [...cart];
    updated[itemIndex].selectedSerials[serialIndex] = newSerial;
    setCart(updated);
  };

  // Calculations
  const cartSubtotal = cart.reduce((sum, item) => {
    const itemTotal = (item.unitPrice * item.quantity) - (item.discount || 0);
    return sum + Math.max(0, itemTotal);
  }, 0);

  const calculatedTax = (Math.max(0, cartSubtotal - invoiceDiscount) * taxRate) / 100;
  const grandTotal = Math.max(0, cartSubtotal - invoiceDiscount) + calculatedTax;

  // Coupon / Promo Code application
  const handleApplyCoupon = async () => {
    if (!couponCodeInput.trim()) return;
    if (cart.length === 0) {
      setCouponError('Please add items to cart before applying coupon.');
      return;
    }
    setCouponLoading(true);
    setCouponError(null);
    try {
      const res = await api.validatePromotion({
        code: couponCodeInput.trim(),
        subtotal: cartSubtotal,
      });
      if (res.valid) {
        setAppliedCoupon({
          code: res.promotion.code,
          discount_amount: res.discount_amount,
          description: res.promotion.description,
        });
        setInvoiceDiscount(res.discount_amount);
      } else {
        setCouponError(res.message || 'Invalid coupon code');
      }
    } catch (err: any) {
      setCouponError(err.message || 'Failed to apply coupon code');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCodeInput('');
    setInvoiceDiscount(0);
    setCouponError(null);
  };

  // Open Payment dialog
  const handleOpenPayment = () => {
    if (cart.length === 0) return;

    for (const item of cart) {
      if (item.product.serial_tracking_enabled) {
        if (item.selectedSerials.length !== item.quantity) {
          alert(`Product ${item.product.product_name} requires ${item.quantity} serial numbers, but ${item.selectedSerials.length} are selected.`);
          return;
        }
      }
    }

    setPayments([{ method: 'Cash', amount: Number(grandTotal.toFixed(2)), referenceNumber: '' }]);
    setCashTendered(Number(grandTotal.toFixed(2)));
    setCheckoutError(null);
    setIsPaymentOpen(true);
  };

  const handleAddPaymentRow = () => {
    setPayments([...payments, { method: 'Card', amount: 0, referenceNumber: '' }]);
  };

  const handleRemovePaymentRow = (idx: number) => {
    const updated = [...payments];
    updated.splice(idx, 1);
    setPayments(updated);
  };

  const totalPaidInRows = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const remainingDue = Number((grandTotal - totalPaidInRows).toFixed(2));
  const changeGiven = Math.max(0, cashTendered - (payments.find((p) => p.method === 'Cash')?.amount || 0));

  // Quick cash preset helper
  const handleApplyCashPreset = (amount: number) => {
    setCashTendered(amount);
  };

  // Submit checkout
  const handleFinalCheckout = async () => {
    setCheckoutError(null);

    const creditPayment = payments.find((p) => p.method === 'Credit');
    if (creditPayment && creditPayment.amount > 0) {
      if (!selectedCustomer) {
        setCheckoutError('A customer account must be linked for Store Credit payment.');
        return;
      }
      const availableCredit = Number(selectedCustomer.credit_limit) - Number(selectedCustomer.balance);
      if (creditPayment.amount > availableCredit) {
        setCheckoutError(
          `Credit payment exceeds limit! Available: $${availableCredit.toFixed(2)}, Requested: $${creditPayment.amount.toFixed(2)}`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        branch_id: effectiveBranchId,
        customer_id: selectedCustomer?.id || null,
        subtotal: cartSubtotal,
        discount: invoiceDiscount,
        tax: calculatedTax,
        total: grandTotal,
        notes: saleNotes,
        coupon_code: appliedCoupon ? appliedCoupon.code : undefined,
        items: cart.map((item) => ({
          product_id: item.product.id,
          product_name: item.product.product_name,
          sku: item.product.sku,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          unit_cost: Number(item.product.cost_price || 0),
          discount: item.discount || 0,
          total_price: (item.unitPrice * item.quantity) - (item.discount || 0),
          tax_rate: taxRate,
          serial_numbers: item.selectedSerials,
        })),
        payments: payments.filter((p) => Number(p.amount) > 0),
      };

      const res = await api.posCheckout(payload);

      const saleObj = {
        id: res.saleId,
        invoice_number: res.invoiceNumber,
        branch_name: currentBranchObj?.branch_name || user.branch_name || 'Main Branch',
        branch_code: currentBranchObj?.branch_code || user.branch_code || 'BR01',
        cashier_name: user.name,
        customer_name: selectedCustomer?.name || 'Walk-in Retail Customer',
        customer_phone: selectedCustomer?.phone,
        customer_email: selectedCustomer?.email,
        sale_date: new Date().toISOString(),
        subtotal: cartSubtotal,
        discount: invoiceDiscount,
        tax: calculatedTax,
        total: grandTotal,
        paid_amount: totalPaidInRows,
        balance_due: remainingDue,
        payment_status: remainingDue <= 0 ? 'PAID' : 'PARTIAL',
      };

      const saleItemsList = cart.map((item) => ({
        id: item.product.id,
        sale_id: res.saleId,
        product_id: item.product.id,
        product_name: item.product.product_name,
        sku: item.product.sku,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount: item.discount || 0,
        total_price: (item.unitPrice * item.quantity) - (item.discount || 0),
        serial_numbers: item.selectedSerials,
        warranty_period: item.product.warranty_period,
      }));

      setCompletedSale(saleObj);
      setCompletedItems(saleItemsList as any);
      setCompletedPayments(payload.payments as any);

      // Track last created invoice for instant banner & verification
      setLastCreatedInvoice({
        id: res.saleId,
        invoiceNumber: res.invoiceNumber,
        total: grandTotal,
        customer: selectedCustomer?.name || 'Walk-in Retail Customer',
        sale: saleObj,
        items: saleItemsList,
        payments: payload.payments,
      });

      // Reset cart
      setCart([]);
      setInvoiceDiscount(0);
      setAppliedCoupon(null);
      setCouponCodeInput('');
      setCouponError(null);
      setSaleNotes('');
      setIsPaymentOpen(false);
      loadProducts();
    } catch (err: any) {
      setCheckoutError(err.message || 'Failed to complete transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Instant 1-Click Quick Cash Sale (Walk-in or selected customer)
  const handleQuickCashSale = async () => {
    if (cart.length === 0) return;
    setCheckoutError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        branch_id: effectiveBranchId,
        customer_id: selectedCustomer?.id || null,
        subtotal: cartSubtotal,
        discount: invoiceDiscount,
        tax: calculatedTax,
        total: grandTotal,
        notes: saleNotes,
        coupon_code: appliedCoupon ? appliedCoupon.code : undefined,
        items: cart.map((item) => ({
          product_id: item.product.id,
          product_name: item.product.product_name,
          sku: item.product.sku,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          unit_cost: Number(item.product.cost_price || 0),
          discount: item.discount || 0,
          total_price: item.unitPrice * item.quantity - (item.discount || 0),
          tax_rate: taxRate,
          serial_numbers: item.selectedSerials,
        })),
        payments: [{ method: 'Cash', amount: Number(grandTotal.toFixed(2)) }],
      };

      const res = await api.posCheckout(payload);

      const saleObj = {
        id: res.saleId,
        invoice_number: res.invoiceNumber,
        branch_name: currentBranchObj?.branch_name || user.branch_name || 'Main Branch',
        branch_code: currentBranchObj?.branch_code || user.branch_code || 'BR01',
        cashier_name: user.name,
        customer_name: selectedCustomer?.name || 'Walk-in Retail Customer',
        customer_phone: selectedCustomer?.phone,
        customer_email: selectedCustomer?.email,
        sale_date: new Date().toISOString(),
        subtotal: cartSubtotal,
        discount: invoiceDiscount,
        tax: calculatedTax,
        total: grandTotal,
        paid_amount: grandTotal,
        balance_due: 0,
        payment_status: 'PAID',
      };

      const saleItemsList = cart.map((item) => ({
        id: item.product.id,
        sale_id: res.saleId,
        product_id: item.product.id,
        product_name: item.product.product_name,
        sku: item.product.sku,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount: item.discount || 0,
        total_price: item.unitPrice * item.quantity - (item.discount || 0),
        serial_numbers: item.selectedSerials,
        warranty_period: item.product.warranty_period,
      }));

      setCompletedSale(saleObj);
      setCompletedItems(saleItemsList as any);
      setCompletedPayments([{ payment_method: 'Cash', amount: grandTotal }] as any);

      setLastCreatedInvoice({
        id: res.saleId,
        invoiceNumber: res.invoiceNumber,
        total: grandTotal,
        customer: selectedCustomer?.name || 'Walk-in Retail Customer',
        sale: saleObj,
        items: saleItemsList,
        payments: [{ payment_method: 'Cash', amount: grandTotal }],
      });

      // Reset cart
      setCart([]);
      setInvoiceDiscount(0);
      setAppliedCoupon(null);
      setCouponCodeInput('');
      setCouponError(null);
      setSaleNotes('');
      loadProducts();
    } catch (err: any) {
      alert(err.message || 'Failed to complete quick cash sale.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Enhanced Customer Creation
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;
    try {
      const formattedNotes = [
        newCustAltPhone.trim() ? `Alt/WhatsApp: ${newCustAltPhone.trim()}` : '',
        newCustNotes.trim() ? newCustNotes.trim() : '',
      ].filter(Boolean).join(' | ');

      const res = await api.createCustomer({
        name: newCustName.trim(),
        phone: newCustPhone.trim() || undefined,
        email: newCustEmail.trim() || undefined,
        address: newCustAddress.trim() || undefined,
        city: newCustCity.trim() || undefined,
        customer_type: newCustType || 'RETAIL',
        credit_limit: Number(newCustCreditLimit) || 0,
        opening_balance: Number(newCustOpeningBalance) || 0,
        notes: formattedNotes || undefined,
        branch_id: effectiveBranchId,
      });

      const newCust: Customer = res.customer || {
        id: res.custId,
        name: newCustName.trim(),
        phone: newCustPhone.trim() || undefined,
        email: newCustEmail.trim() || undefined,
        address: newCustAddress.trim() || undefined,
        city: newCustCity.trim() || undefined,
        customer_type: newCustType || 'RETAIL',
        credit_limit: Number(newCustCreditLimit) || 0,
        opening_balance: Number(newCustOpeningBalance) || 0,
        balance: Number(newCustOpeningBalance) || 0,
        notes: formattedNotes || undefined,
      };

      setCustomers((prev) => [newCust, ...prev]);
      setSelectedCustomer(newCust);
      setIsNewCustomerOpen(false);

      // Reset form fields
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAltPhone('');
      setNewCustEmail('');
      setNewCustAddress('');
      setNewCustCity('');
      setNewCustType('RETAIL');
      setNewCustCreditLimit(1000);
      setNewCustOpeningBalance(0);
      setNewCustNotes('');
      loadCustomers();
    } catch (err: any) {
      alert(err.message || 'Failed to create customer');
    }
  };

  return (
    <div className="h-[calc(100vh-65px)] flex flex-col xl:flex-row gap-3 p-3 overflow-hidden bg-slate-100 font-sans">
      {/* ================= LEFT SECTION: PRODUCT CATALOG & SCANNER ================= */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Clean POS Toolbar Strip */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-bold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Register Ready
            </span>
            <span className="text-slate-600 font-medium hidden sm:inline">
              Store: <strong className="text-slate-800">{currentBranchObj?.branch_name || user.branch_name || 'Main Branch'}</strong>
            </span>
            <span className="text-[10px] bg-slate-200/80 text-slate-700 font-mono px-1.5 py-0.5 rounded">
              {currentBranchObj?.branch_code || user.branch_code || 'BR01'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden lg:inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
              <kbd className="font-semibold text-slate-700">F2</kbd> Search
            </span>
            <span className="hidden lg:inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
              <kbd className="font-semibold text-slate-700">F3</kbd> Barcode
            </span>
            <span className="hidden xl:inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
              <kbd className="font-semibold text-slate-700">F4</kbd> +Customer
            </span>
            <button
              onClick={() => onNavigate?.('sales')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
              title="Open Invoices Ledger"
            >
              <Receipt className="w-3.5 h-3.5 text-indigo-600" />
              <span>Invoices</span>
            </button>
            <button
              onClick={() => setIsGuideOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-200 transition-colors cursor-pointer"
              title="Open Cashier POS Guide [F8]"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>POS Guide</span>
            </button>
          </div>
        </div>

        {/* Dismissible New User Onboarding Tip Banner */}
        {showQuickTipsBar && (
          <div className="bg-sky-50 border-b border-sky-200/80 px-4 py-2 flex items-center justify-between gap-3 text-sky-950 shrink-0 text-xs">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <span className="w-5 h-5 rounded-full bg-sky-200 text-sky-800 flex items-center justify-center text-[10px] font-bold shrink-0">
                <Info className="w-3.5 h-3.5" />
              </span>
              <p className="truncate text-[11px] text-sky-900">
                <strong className="font-semibold text-sky-950">New Cashier Quick Tip:</strong> Click any product card or press <code className="bg-sky-100 text-sky-800 px-1 py-0.5 rounded font-mono text-[10px]">F3</code> to scan barcode/serial. Walk-in sales automatically create an invoice and sync to the Sales Ledger.
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => setIsGuideOpen(true)}
                className="text-[11px] font-bold text-sky-800 hover:text-sky-950 underline cursor-pointer flex items-center gap-1"
              >
                <BookOpen className="w-3 h-3" />
                <span>Open Guide</span>
              </button>
              <button
                onClick={() => setShowQuickTipsBar(false)}
                className="text-sky-400 hover:text-sky-700 p-0.5 rounded cursor-pointer transition-colors"
                title="Dismiss tip"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Invoice Created Notification Banner */}
        {lastCreatedInvoice && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-emerald-950 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-900 mr-2">
                  Invoice Generated: <span className="font-mono text-emerald-700 font-extrabold">{lastCreatedInvoice.invoiceNumber}</span>
                </span>
                <span className="text-slate-600 text-[11px]">
                  Saved for <strong>{lastCreatedInvoice.customer}</strong> (${lastCreatedInvoice.total.toFixed(2)})
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (lastCreatedInvoice.sale) {
                    setCompletedSale(lastCreatedInvoice.sale);
                    setCompletedItems(lastCreatedInvoice.items || []);
                    setCompletedPayments(lastCreatedInvoice.payments || []);
                  }
                }}
                className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                View / Print Receipt
              </button>
              <button
                onClick={() => onNavigate?.('sales')}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <Receipt className="w-3 h-3" />
                <span>Open Invoices Ledger</span>
              </button>
              <button
                onClick={() => setLastCreatedInvoice(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Search & Barcode Input Toolbar */}
        <div className="p-3.5 border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/70 space-y-2.5 shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {/* Barcode scanner input */}
            <form onSubmit={handleBarcodeSubmit} className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-indigo-600">
                <Barcode className="w-4 h-4" />
              </div>
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Scan Barcode / Serial Number + Enter..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-indigo-200/90 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 font-mono shadow-2xs"
              />
            </form>

            {/* Keyword Search */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search items by name, SKU, brand (F2)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-400/20 focus:border-slate-400 shadow-2xs"
              />
            </div>
          </div>

          {/* Category Navigation Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 shadow-2xs'
              }`}
            >
              All Products ({products.length})
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === c.id
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 shadow-2xs'
                }`}
              >
                {c.category_name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto p-3.5 bg-slate-50/40">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2.5">
            {filteredProducts.map((p) => {
              const inStock = Number(p.current_stock) > 0;
              const isLowStock = inStock && Number(p.current_stock) <= Number(p.min_stock_alert || 3);
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={!inStock}
                  className={`group text-left p-3 rounded-xl border transition-all flex flex-col justify-between cursor-pointer relative overflow-hidden ${
                    inStock
                      ? 'bg-white border-slate-200/80 hover:border-indigo-400 hover:shadow-md hover:-translate-y-0.5'
                      : 'bg-slate-100/70 border-slate-200 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div>
                    {/* Top Row: SKU & Serial Flag */}
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-tight truncate max-w-[100px]">
                        {p.sku}
                      </span>
                      {p.serial_tracking_enabled && (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                          <ShieldCheck className="w-2.5 h-2.5 mr-0.5 text-indigo-600" /> SN
                        </span>
                      )}
                    </div>

                    {/* Product Name */}
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">
                      {p.product_name}
                    </h4>

                    {p.brand && (
                      <span className="text-[10px] text-slate-400 font-medium block mt-0.5">{p.brand}</span>
                    )}
                  </div>

                  {/* Bottom Row: Price & Stock Status */}
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-end justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Price</span>
                      <span className="text-sm font-bold font-mono text-slate-900 tabular-nums">
                        ${Number(p.selling_price).toFixed(2)}
                      </span>
                    </div>

                    <div>
                      {inStock ? (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                            isLowStock
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isLowStock ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          />
                          {p.current_stock} left
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                          Out of Stock
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="py-20 text-center text-slate-400 space-y-2">
              <Package className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
              <p className="text-sm font-semibold text-slate-600">No hardware found matching search criteria.</p>
              <p className="text-xs text-slate-400">Try a different category or search term.</p>
            </div>
          )}
        </div>
      </div>

      {/* ================= RIGHT SECTION: ACTIVE CART & CHECKOUT ================= */}
      <div className="w-full xl:w-[440px] flex flex-col bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden shrink-0">
        {/* Cart Header Strip */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-xs text-slate-800 tracking-tight">Active Sale</h3>
            <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200/60 font-mono">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} {cart.reduce((sum, item) => sum + item.quantity, 0) === 1 ? 'item' : 'items'}
            </span>
          </div>

          {cart.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Clear all items from the current cart?')) {
                  setCart([]);
                  setInvoiceDiscount(0);
                }
              }}
              className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear Cart</span>
            </button>
          )}
        </div>

        {/* Customer Account Header & Selector */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <UserIcon className="w-3 h-3 text-slate-500" />
              Customer Account
            </label>
            <div className="flex items-center gap-1.5">
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="text-[10px] text-slate-400 hover:text-rose-600 font-semibold transition-colors cursor-pointer"
                  title="Switch back to Walk-in Retail Customer"
                >
                  Clear (Walk-in)
                </button>
              )}
              <button
                onClick={() => setIsNewCustomerOpen(true)}
                title="Register New Customer Account [F4]"
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ New Customer</span>
                <span className="text-[10px] opacity-75 font-mono hidden sm:inline">[F4]</span>
              </button>
            </div>
          </div>

          <select
            value={selectedCustomer?.id || ''}
            onChange={(e) => {
              const found = customers.find((c) => c.id === e.target.value);
              setSelectedCustomer(found || null);
            }}
            className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400/20 shadow-2xs"
          >
            <option value="">Walk-in Retail Customer (Default)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `(${c.phone})` : ''} • [{c.customer_type || 'RETAIL'}] • Bal: ${Number(c.balance).toFixed(2)}
              </option>
            ))}
          </select>

          {/* Active Customer Details Display Card */}
          {selectedCustomer ? (
            <div className="bg-white border border-indigo-200/90 rounded-xl p-2.5 shadow-2xs text-xs space-y-1.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-bold text-slate-900 truncate">{selectedCustomer.name}</span>
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                    selectedCustomer.customer_type === 'VIP' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                    selectedCustomer.customer_type === 'CORPORATE' ? 'bg-purple-100 text-purple-900 border-purple-300' :
                    selectedCustomer.customer_type === 'WHOLESALE' ? 'bg-blue-100 text-blue-900 border-blue-300' :
                    'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    {selectedCustomer.customer_type || 'RETAIL'}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-bold shrink-0">
                  Account Active
                </span>
              </div>

              {/* Contact Information */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
                {selectedCustomer.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {selectedCustomer.phone}
                  </span>
                )}
                {selectedCustomer.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    {selectedCustomer.email}
                  </span>
                )}
                {selectedCustomer.city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {selectedCustomer.city}
                  </span>
                )}
              </div>

              {/* Financial Metrics & Credit Availability */}
              <div className="pt-1.5 border-t border-slate-100 grid grid-cols-3 gap-1.5 text-[10px] font-mono">
                <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[9px] font-sans">Current Balance</span>
                  <span className={`font-bold ${Number(selectedCustomer.balance) > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                    ${Number(selectedCustomer.balance).toFixed(2)}
                  </span>
                </div>
                <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[9px] font-sans">Credit Limit</span>
                  <span className="font-bold text-slate-700">
                    ${Number(selectedCustomer.credit_limit).toFixed(2)}
                  </span>
                </div>
                <div className="bg-emerald-50/70 p-1.5 rounded-lg border border-emerald-100">
                  <span className="text-emerald-700 block text-[9px] font-sans font-semibold">Available Credit</span>
                  <span className="font-bold text-emerald-800">
                    ${(Number(selectedCustomer.credit_limit) - Number(selectedCustomer.balance)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-100/70 border border-slate-200/80 rounded-xl p-2 flex items-center justify-between text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Walk-in Customer • Standard retail pricing • Instant receipt & invoice</span>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCustomerOpen(true)}
                className="text-indigo-600 hover:text-indigo-700 font-bold hover:underline shrink-0 ml-2"
              >
                + Register
              </button>
            </div>
          )}
        </div>

        {/* Cart Item Docket */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/30">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-8 px-4 space-y-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                <ShoppingCart className="w-6 h-6 stroke-1.5" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-xs font-bold text-slate-800">Cart Ready for Sale</p>
                <p className="text-[11px] text-slate-400 max-w-[240px]">
                  Click items on the left or scan barcode/serial numbers to build invoice.
                </p>
              </div>

              {/* 3-Step Guidance For New Cashiers */}
              <div className="w-full bg-white border border-slate-200/80 rounded-xl p-3 text-left space-y-2 shadow-2xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Info className="w-3 h-3 text-indigo-500" />
                  Quick POS Workflow
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-start gap-2 text-slate-700">
                    <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <span><strong>Select Items:</strong> Click product card or press <code className="bg-slate-100 px-1 py-0.2 rounded font-mono text-[10px]">F3</code> to scan barcode / serial.</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-700">
                    <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <span><strong>Assign Customer:</strong> Defaults to Walk-in Retail, or select registered account for store credit.</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-700">
                    <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <span><strong>Tender & Print:</strong> Press <strong>Quick Cash</strong> for 1-click cash sale, or <strong>Checkout</strong> for split payments.</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsGuideOpen(true)}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <BookOpen className="w-3 h-3" />
                <span>Open Cashier Handbook & Shortcuts [F8]</span>
              </button>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200/90 rounded-xl p-3 text-xs space-y-2 shadow-2xs hover:border-slate-300 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 mr-2">
                    <h5 className="font-bold text-slate-900 line-clamp-1">{item.product.product_name}</h5>
                    <span className="text-[10px] font-mono text-slate-400">{item.product.sku}</span>
                  </div>
                  <button
                    onClick={() => removeFromCart(idx)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Serial Selector for Serialized Items */}
                {item.product.serial_tracking_enabled && (
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                      <span className="flex items-center">
                        <ShieldCheck className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                        Unit Serial Assignment:
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {item.selectedSerials.length} of {item.quantity} assigned
                      </span>
                    </div>

                    {item.selectedSerials.map((currSerial, sIdx) => (
                      <div key={sIdx} className="flex items-center space-x-1.5">
                        <span className="text-[10px] font-mono text-slate-400">#{sIdx + 1}:</span>
                        <select
                          value={currSerial}
                          onChange={(e) => updateItemSerial(idx, sIdx, e.target.value)}
                          className="flex-1 font-mono text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-900 focus:outline-hidden"
                        >
                          {item.availableSerials?.map((av) => (
                            <option key={av.id} value={av.serial_number}>
                              SN: {av.serial_number} ({av.current_location || 'Shelf'})
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pricing & Quantity Row */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      onClick={() => updateQuantity(idx, -1)}
                      className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white rounded cursor-pointer transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-bold font-mono px-2 text-slate-900 text-xs">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(idx, 1)}
                      className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white rounded cursor-pointer transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex items-center space-x-3 text-right">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">@ Price</span>
                      <span className="font-mono font-semibold text-slate-700">
                        ${Number(item.unitPrice).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Line Total</span>
                      <span className="font-bold font-mono text-slate-900 text-sm">
                        ${Number((item.unitPrice * item.quantity) - (item.discount || 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Docket & Checkout Button */}
        <div className="p-3.5 border-t border-slate-200/90 bg-slate-50/90 space-y-2.5 shrink-0">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono font-bold text-slate-900">${cartSubtotal.toFixed(2)}</span>
            </div>

            {/* Promo / Coupon Code Input */}
            <div className="py-1 border-y border-slate-200/60 my-1">
              {!appliedCoupon ? (
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <Tag className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Coupon (e.g. GAMING10)"
                      value={couponCodeInput}
                      onChange={(e) => {
                        setCouponCodeInput(e.target.value.toUpperCase());
                        setCouponError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyCoupon();
                        }
                      }}
                      className="w-full pl-6 pr-2 py-1 text-xs bg-white border border-slate-200 rounded font-mono font-bold uppercase placeholder:font-normal placeholder:normal-case focus:outline-none focus:ring-1 focus:ring-indigo-500 text-indigo-700"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={couponLoading || !couponCodeInput.trim() || cart.length === 0}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded transition-colors"
                  >
                    {couponLoading ? '...' : 'Apply'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-1 rounded">
                  <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{appliedCoupon.code}</span>
                    <span className="text-[10px] text-emerald-600 font-normal">(-${appliedCoupon.discount_amount.toFixed(2)})</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-slate-400 hover:text-rose-600 text-[11px] font-bold underline"
                  >
                    Remove
                  </button>
                </div>
              )}
              {couponError && (
                <p className="text-[10px] text-rose-600 mt-1 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {couponError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span className="text-amber-700 font-medium">Order Discount ($):</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={invoiceDiscount === 0 ? '' : invoiceDiscount}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const v = e.target.value;
                  setInvoiceDiscount(v === '' ? 0 : Math.max(0, parseFloat(v) || 0));
                }}
                className="w-20 text-right font-mono text-xs bg-white border border-slate-200 rounded px-2 py-0.5 text-amber-800 font-bold focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Tax ({taxRate}%):</span>
              <span className="font-mono text-slate-800">${calculatedTax.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
              <span>Total Payable:</span>
              <span className="font-mono text-xl text-slate-900 font-extrabold tracking-tight">
                ${grandTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Quick Cash Presets */}
          <div className="flex items-center gap-1.5 pt-1">
            {[20, 50, 100, 500].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleApplyCashPreset(amt)}
                className="flex-1 py-1 text-[11px] font-mono font-semibold bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 transition-colors cursor-pointer"
              >
                ${amt}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleApplyCashPreset(Number(grandTotal.toFixed(2)))}
              className="flex-1 py-1 text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-indigo-700 transition-colors cursor-pointer"
            >
              Exact
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setCart([])}
              disabled={cart.length === 0}
              className="px-3 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              Clear
            </button>
            <button
              onClick={handleQuickCashSale}
              disabled={cart.length === 0 || isSubmitting}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
              title="1-Click Cash Sale & Save to Invoices"
            >
              <Zap className="w-3.5 h-3.5 mr-1 text-emerald-200" />
              <span>Quick Cash</span>
            </button>
            <button
              onClick={handleOpenPayment}
              disabled={cart.length === 0}
              className="flex-1 flex items-center justify-center px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <span>Charge & Tender</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= MODAL: SPLIT PAYMENT & CHECKOUT ================= */}
      {isPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Payment & Tender Checkout</h3>
                <p className="text-xs text-slate-500">
                  Total Due: <strong className="text-slate-900 font-mono text-sm">${grandTotal.toFixed(2)}</strong>
                </p>
              </div>
              <button
                onClick={() => setIsPaymentOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {checkoutError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
                  {checkoutError}
                </div>
              )}

              {/* Tender Methods */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Payment Tender Split
                  </label>
                  <button
                    type="button"
                    onClick={handleAddPaymentRow}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                  >
                    + Add Split Tender
                  </button>
                </div>

                {payments.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <select
                      value={p.method}
                      onChange={(e) => {
                        const updated = [...payments];
                        updated[idx].method = e.target.value as any;
                        setPayments(updated);
                      }}
                      className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-hidden"
                    >
                      <option value="Cash">💵 Cash</option>
                      <option value="Card">💳 Credit/Debit Card</option>
                      <option value="Bank Transfer">🏦 Bank Wire / EFT</option>
                      <option value="Credit">📋 Store Credit</option>
                    </select>

                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-mono">$</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={p.amount === 0 ? '' : p.amount}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const v = e.target.value;
                          const updated = [...payments];
                          updated[idx].amount = v === '' ? 0 : parseFloat(v) || 0;
                          setPayments(updated);
                        }}
                        className="w-full pl-6 pr-2 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden"
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Auth / Ref #"
                      value={p.referenceNumber}
                      onChange={(e) => {
                        const updated = [...payments];
                        updated[idx].referenceNumber = e.target.value;
                        setPayments(updated);
                      }}
                      className="w-24 px-2 py-1 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden"
                    />

                    {payments.length > 1 && (
                      <button
                        onClick={() => handleRemovePaymentRow(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Cash Change Calculator */}
              {payments.some((p) => p.method === 'Cash') && (
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 text-xs space-y-2 font-sans">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-emerald-950">Cash Received from Customer:</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={cashTendered === 0 ? '' : cashTendered}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCashTendered(v === '' ? 0 : parseFloat(v) || 0);
                      }}
                      className="w-28 text-right font-mono font-bold text-sm bg-white border border-emerald-300 rounded-lg px-2 py-1 text-emerald-950"
                    />
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-emerald-200/80 text-emerald-900 font-bold">
                    <span>Change Due Back:</span>
                    <span className="font-mono text-base font-extrabold text-emerald-700">
                      ${changeGiven.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Split Balance Summary */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Grand Total:</span>
                  <span className="font-mono font-bold">${grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Split Allocated:</span>
                  <span className="font-mono font-bold text-emerald-700">${totalPaidInRows.toFixed(2)}</span>
                </div>
                {remainingDue > 0 && (
                  <div className="flex justify-between text-amber-800 font-bold pt-1 border-t border-slate-200">
                    <span>Balance Deferred to Customer Credit:</span>
                    <span className="font-mono">${remainingDue.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Note input */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Invoice Notes / PO #</label>
                <input
                  type="text"
                  placeholder="e.g. Purchase Order #8821, Customer Pickup"
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsPaymentOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Back to Cart
              </button>
              <button
                type="button"
                onClick={handleFinalCheckout}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" />
                    Complete Sale & Print
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: ENHANCED NEW CUSTOMER WITH LIVE DATA PREVIEW ================= */}
      {isNewCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          {(() => {
            const cleanPhone = (p?: string) => (p || '').replace(/\D/g, '');
            const duplicateCustomer = customers.find((c) => {
              const pMatch = newCustPhone.trim() && c.phone && cleanPhone(c.phone).length >= 7 && cleanPhone(c.phone) === cleanPhone(newCustPhone);
              const eMatch = newCustEmail.trim() && c.email && c.email.trim().toLowerCase() === newCustEmail.trim().toLowerCase();
              return pMatch || eMatch;
            });

            const getInitials = (name: string) => {
              if (!name.trim()) return 'CU';
              const parts = name.trim().split(/\s+/);
              if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
              return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            };

            return (
              <form
                onSubmit={handleCreateCustomer}
                className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh]"
              >
                {/* Modal Header */}
                <div className="px-6 py-3.5 border-b border-slate-100 bg-slate-50/90 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Register New Customer Account</h4>
                      <p className="text-[11px] text-slate-500">
                        Create customer profile with contact information, credit limits, and billing terms.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNewCustomerOpen(false)}
                    className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Modal Body - 2 Columns: Form Fields on Left, Live Data Preview on Right */}
                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Form Inputs (7 cols) */}
                  <div className="lg:col-span-7 space-y-4 text-xs">
                    {/* Customer Classification */}
                    <div>
                      <label className="font-bold text-slate-700 block mb-1.5">
                        Customer Classification *
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: 'RETAIL', label: 'Retail', desc: 'Standard client' },
                          { id: 'WHOLESALE', label: 'Wholesale', desc: 'Bulk buyer' },
                          { id: 'CORPORATE', label: 'Corporate', desc: 'B2B company' },
                          { id: 'VIP', label: 'VIP', desc: 'Priority client' },
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setNewCustType(t.id)}
                            className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                              newCustType === t.id
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-2 ring-indigo-500/20 shadow-2xs'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span className="font-bold block text-xs">{t.label}</span>
                            <span className="text-[10px] text-slate-400">{t.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Customer Name */}
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Full Name / Business Name *
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="e.g. Apex Dynamics Ltd or Michael Scott"
                        value={newCustName}
                        onChange={(e) => setNewCustName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden"
                      />
                    </div>

                    {/* Contact Grid: Phone & Secondary / WhatsApp */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>Primary Phone</span>
                        </label>
                        <input
                          type="tel"
                          placeholder="+1 (555) 234-5678"
                          value={newCustPhone}
                          onChange={(e) => setNewCustPhone(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>Alt Phone / WhatsApp</span>
                        </label>
                        <input
                          type="tel"
                          placeholder="+1 (555) 987-6543"
                          value={newCustAltPhone}
                          onChange={(e) => setNewCustAltPhone(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>Email Address (for Invoices)</span>
                      </label>
                      <input
                        type="email"
                        placeholder="billing@customer.com"
                        value={newCustEmail}
                        onChange={(e) => setNewCustEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden"
                      />
                    </div>

                    {/* Address & City */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>Street Address</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 742 Evergreen Terrace, Suite 100"
                          value={newCustAddress}
                          onChange={(e) => setNewCustAddress(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">City</label>
                        <input
                          type="text"
                          placeholder="e.g. Springfield"
                          value={newCustCity}
                          onChange={(e) => setNewCustCity(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Financial Terms: Credit Limit & Opening Balance */}
                    <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/80 space-y-3">
                      <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                        Account Credit & Ledger Terms
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">
                            Credit Limit ($)
                          </label>
                          <input
                            type="number"
                            placeholder="0"
                            value={newCustCreditLimit === 0 ? '' : newCustCreditLimit}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const v = e.target.value;
                              setNewCustCreditLimit(v === '' ? 0 : parseFloat(v) || 0);
                            }}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono font-bold bg-white focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden"
                          />
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            {[0, 500, 1000, 2500, 5000].map((val) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setNewCustCreditLimit(val)}
                                className={`text-[10px] px-1.5 py-0.5 rounded border font-mono transition-colors cursor-pointer ${
                                  newCustCreditLimit === val
                                    ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                ${val}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="font-semibold text-slate-700 block mb-1">
                            Opening Balance ($)
                          </label>
                          <input
                            type="number"
                            placeholder="0"
                            value={newCustOpeningBalance === 0 ? '' : newCustOpeningBalance}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const v = e.target.value;
                              setNewCustOpeningBalance(v === '' ? 0 : parseFloat(v) || 0);
                            }}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 text-xs font-mono bg-white focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">
                            Prior debt or receivable balance if migrating from another system.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Internal Notes */}
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Internal Notes / Tax Registration ID (NTN / CNIC)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Tax ID #TX-984210, Authorized contact: John Doe"
                        value={newCustNotes}
                        onChange={(e) => setNewCustNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Right Column: LIVE DATA PREVIEW (5 cols) */}
                  <div className="lg:col-span-5 space-y-4">
                    {/* Duplicate Alert if phone or email matches existing */}
                    {duplicateCustomer && (
                      <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 space-y-2 animate-in fade-in duration-150">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="text-xs">
                            <span className="font-bold block text-amber-900">Existing Customer Detected</span>
                            <p className="text-[11px] text-amber-800">
                              A customer named <strong>{duplicateCustomer.name}</strong> already exists with matching contact details.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(duplicateCustomer);
                            setIsNewCustomerOpen(false);
                          }}
                          className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-colors cursor-pointer"
                        >
                          Select "{duplicateCustomer.name}" in POS
                        </button>
                      </div>
                    )}

                    {/* Live Data Preview Card */}
                    <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-4 shadow-lg border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-xl bg-indigo-500/30 border border-indigo-400/40 text-indigo-300 flex items-center justify-center font-black text-sm">
                            {getInitials(newCustName)}
                          </div>
                          <div>
                            <span className="text-[10px] text-indigo-300 uppercase tracking-wider font-mono block">
                              Live Customer Preview
                            </span>
                            <h5 className="font-bold text-sm text-white truncate max-w-[180px]">
                              {newCustName.trim() || 'Customer Name Preview'}
                            </h5>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                          newCustType === 'VIP' ? 'bg-amber-400/20 text-amber-300 border-amber-400/30' :
                          newCustType === 'CORPORATE' ? 'bg-purple-400/20 text-purple-300 border-purple-400/30' :
                          newCustType === 'WHOLESALE' ? 'bg-blue-400/20 text-blue-300 border-blue-400/30' :
                          'bg-white/10 text-slate-300 border-white/20'
                        }`}>
                          {newCustType}
                        </span>
                      </div>

                      {/* Contact Preview */}
                      <div className="space-y-1.5 text-xs text-slate-300">
                        <div className="flex items-center gap-2 text-[11px]">
                          <Phone className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="font-mono">{newCustPhone.trim() || 'No primary phone entered'}</span>
                          {newCustAltPhone.trim() && (
                            <span className="text-slate-400 text-[10px] font-mono">
                              / {newCustAltPhone.trim()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <Mail className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="truncate">{newCustEmail.trim() || 'No email provided'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="truncate">
                            {[newCustAddress.trim(), newCustCity.trim()].filter(Boolean).join(', ') || 'No address specified'}
                          </span>
                        </div>
                      </div>

                      {/* Financial Preview Box */}
                      <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-white/5 p-2 rounded-xl border border-white/10">
                          <span className="text-[10px] text-slate-400 block">Credit Limit</span>
                          <span className="font-mono font-bold text-sm text-white">
                            ${Number(newCustCreditLimit || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="bg-white/5 p-2 rounded-xl border border-white/10">
                          <span className="text-[10px] text-slate-400 block">Opening Balance</span>
                          <span className="font-mono font-bold text-sm text-emerald-400">
                            ${Number(newCustOpeningBalance || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Receipt Bill-To Simulation */}
                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 text-xs font-mono space-y-1.5 text-slate-800">
                      <div className="flex items-center justify-between text-[10px] uppercase font-bold text-amber-900 border-b border-amber-200 pb-1">
                        <span className="flex items-center gap-1">
                          <Receipt className="w-3 h-3" />
                          Invoice Bill-To Preview
                        </span>
                        <span className="text-[9px] bg-amber-200/60 px-1 py-0.2 rounded">Receipt Format</span>
                      </div>
                      <p className="font-bold text-slate-900">
                        {newCustName.trim() || 'ACME CORPORATION'} [{newCustType}]
                      </p>
                      <p className="text-[11px] text-slate-600">
                        Phone: {newCustPhone.trim() || '+1 (000) 000-0000'}
                      </p>
                      <p className="text-[11px] text-slate-600 truncate">
                        Address: {[newCustAddress.trim() || 'Business Address', newCustCity.trim() || 'City'].join(', ')}
                      </p>
                      <p className="text-[10px] text-indigo-700 font-bold pt-1">
                        Branch: {currentBranchObj?.branch_name || 'Main Branch'}
                      </p>
                    </div>

                    <div className="p-2.5 bg-slate-100 rounded-xl text-[11px] text-slate-500 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Upon saving, this customer will be auto-selected for the current POS transaction.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
                  <span className="text-xs text-slate-400">
                    Pressing Save registers customer in database and syncs to ledger.
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsNewCustomerOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Create & Select Customer</span>
                    </button>
                  </div>
                </div>
              </form>
            );
          })()}
        </div>
      )}

      {/* ================= MODAL: POS TERMINAL CASHIER HANDBOOK & GUIDE ================= */}
      {isGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh]">
            {/* Guide Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">POS Terminal Guide & Cashier Handbook</h3>
                  <p className="text-[11px] text-slate-400">
                    Complete reference for ringing up sales, managing customers, serialized hardware, and tenders.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Guide Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
              {/* 1. Workflow overview */}
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">1</span>
                  Standard 3-Step POS Sale Workflow
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                    <span className="font-bold text-slate-900 block text-xs">Step 1: Add Hardware</span>
                    <p className="text-[11px] text-slate-500">
                      Click any product card, or use <code className="bg-white px-1 py-0.5 rounded border text-[10px] font-mono">[F3]</code> to scan barcode. Serial numbers auto-prompt if required.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                    <span className="font-bold text-slate-900 block text-xs">Step 2: Assign Customer</span>
                    <p className="text-[11px] text-slate-500">
                      Default is <strong>Walk-in Retail</strong> (no account required). For B2B or credit sales, pick from dropdown or hit <code className="bg-white px-1 py-0.5 rounded border text-[10px] font-mono">[F4]</code> to register.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                    <span className="font-bold text-slate-900 block text-xs">Step 3: Tender Payment</span>
                    <p className="text-[11px] text-slate-500">
                      Click <strong>Quick Cash</strong> for immediate cash sale, or <strong>Checkout</strong> for split tenders (Card + Cash + Store Credit) and receipt printing.
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Customer Accounts & Credit Limits */}
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">2</span>
                  Customer Types & Credit Limits
                </h4>
                <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-2.5">
                  <p className="text-[11px] text-indigo-950 leading-relaxed">
                    The POS Terminal supports two customer categories:
                  </p>
                  <ul className="space-y-1.5 text-[11px] text-indigo-900 list-disc list-inside">
                    <li>
                      <strong>Walk-in Retail Customer:</strong> Used for general foot traffic. Requires no registration. Invoices are generated with auto-assigned invoice numbers and full warranty coverage.
                    </li>
                    <li>
                      <strong>Registered Accounts (Retail, Wholesale, Corporate, VIP):</strong> Tracks customer credit limits, prior balance, and total spending. Unpaid balances are automatically transferred to the customer's ledger.
                    </li>
                  </ul>
                  <div className="p-2.5 bg-white rounded-lg border border-indigo-200/60 text-[11px] text-indigo-950 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>
                      Credit Limit Guard: The system prevents store credit checkout if the new invoice exceeds the customer's available credit limit.
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Serial Number Tracking & Warranties */}
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">3</span>
                  Serial Numbers & Warranty Protection
                </h4>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    High-value hardware (such as GPUs, Laptops, CPUs, and Motherboards) have serial tracking enabled. When added to the cart, the terminal requires you to assign specific serial numbers before checkout.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block">Unique Device Verification:</strong>
                      <span className="text-slate-500">Each serial number can only be sold once. Sold serials update stock status to 'SOLD'.</span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block">Automated Warranty:</strong>
                      <span className="text-slate-500">The customer invoice prints the serial numbers and exact warranty expiration dates.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Keyboard Shortcuts Cheat Sheet */}
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">4</span>
                  Cashier Keyboard Shortcuts
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                  <div className="p-2 bg-slate-100 rounded-lg flex items-center justify-between">
                    <span className="font-bold text-slate-900">[F2]</span>
                    <span className="text-slate-600 font-sans">Search Catalog</span>
                  </div>
                  <div className="p-2 bg-slate-100 rounded-lg flex items-center justify-between">
                    <span className="font-bold text-slate-900">[F3]</span>
                    <span className="text-slate-600 font-sans">Barcode Scanner</span>
                  </div>
                  <div className="p-2 bg-slate-100 rounded-lg flex items-center justify-between">
                    <span className="font-bold text-slate-900">[F4]</span>
                    <span className="text-slate-600 font-sans">+ New Customer</span>
                  </div>
                  <div className="p-2 bg-slate-100 rounded-lg flex items-center justify-between">
                    <span className="font-bold text-slate-900">[F8]</span>
                    <span className="text-slate-600 font-sans">Toggle Guide</span>
                  </div>
                  <div className="p-2 bg-slate-100 rounded-lg flex items-center justify-between">
                    <span className="font-bold text-slate-900">[Esc]</span>
                    <span className="text-slate-600 font-sans">Close Modals</span>
                  </div>
                  <div className="p-2 bg-slate-100 rounded-lg flex items-center justify-between">
                    <span className="font-bold text-slate-900">Enter</span>
                    <span className="text-slate-600 font-sans">Confirm / Scan</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Guide Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
              <span className="text-[11px] text-slate-500">
                Tip: All sales immediately persist to database and sync to the Sales Ledger.
              </span>
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Got It, Close Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: INVOICE & RECEIPT PREVIEW ================= */}
      <InvoiceModal
        isOpen={Boolean(completedSale)}
        onClose={() => setCompletedSale(null)}
        sale={completedSale}
        items={completedItems}
        payments={completedPayments}
        onNavigate={onNavigate}
      />
    </div>
  );
};
