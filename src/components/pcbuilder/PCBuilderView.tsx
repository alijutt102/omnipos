import React, { useState, useEffect, useMemo } from 'react';
import { Product, User } from '../../types.ts';
import { api } from '../../services/api.ts';
import {
  Cpu, CircuitBoard, Layers, Zap, HardDrive, Box, Fan,
  ShieldCheck, AlertTriangle, CheckCircle2, ShoppingCart,
  Printer, RefreshCw, Sparkles, FileText, ArrowRight,
  Info, Check, Plus, Trash2, Sliders, ExternalLink
} from 'lucide-react';

interface PCBuilderViewProps {
  user: User;
  activeBranchId: string;
  onNavigate?: (tab: string) => void;
  onSendToPOS?: (items: { product: Product; quantity: number }[]) => void;
  onLoadCartItems?: (items: { product: Product; quantity: number }[]) => void;
}

interface BuildSlot {
  key: string;
  label: string;
  category: string;
  required: boolean;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const BUILD_SLOTS: BuildSlot[] = [
  { key: 'cpu', label: 'Processor (CPU)', category: 'CPU', required: true, icon: Cpu, description: 'Core compute engine (AM5, LGA1700, etc.)' },
  { key: 'motherboard', label: 'Motherboard', category: 'Motherboard', required: true, icon: CircuitBoard, description: 'Mainboard matching CPU socket and RAM generation' },
  { key: 'ram', label: 'System Memory (RAM)', category: 'RAM', required: true, icon: Layers, description: 'DDR4 or DDR5 high-speed memory kit' },
  { key: 'gpu', label: 'Graphics Card (GPU)', category: 'GPU', required: false, icon: Zap, description: 'Dedicated gaming or workstation accelerator' },
  { key: 'storage', label: 'Primary Storage (SSD)', category: 'SSD', required: true, icon: HardDrive, description: 'High-speed NVMe PCIe 4.0/5.0 or SATA storage' },
  { key: 'psu', label: 'Power Supply (PSU)', category: 'Power Supply', required: true, icon: Zap, description: 'Clean, continuous wattage with 80+ efficiency' },
  { key: 'case', label: 'PC Chassis / Case', category: 'Case', required: true, icon: Box, description: 'Form-factor compatible enclosure' },
  { key: 'cooler', label: 'CPU Cooler', category: 'Cooler', required: false, icon: Fan, description: 'Air tower cooler or liquid AIO radiator' },
];

export const PCBuilderView: React.FC<PCBuilderViewProps> = ({
  user,
  activeBranchId,
  onNavigate,
  onSendToPOS,
  onLoadCartItems,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedParts, setSelectedParts] = useState<Record<string, Product | null>>({
    cpu: null,
    motherboard: null,
    ram: null,
    gpu: null,
    storage: null,
    psu: null,
    case: null,
    cooler: null,
  });

  const [activeSlotPicker, setActiveSlotPicker] = useState<string | null>(null);
  const [assemblyFeeEnabled, setAssemblyFeeEnabled] = useState(true);
  const [assemblyFeeAmount, setAssemblyFeeAmount] = useState(75);
  const [osInstallEnabled, setOsInstallEnabled] = useState(true);
  const [osInstallAmount, setOsInstallAmount] = useState(45);
  const [buildName, setBuildName] = useState('Custom Gaming & Creator Rig');
  const [customerName, setCustomerName] = useState('');
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [posTransferNotice, setPosTransferNotice] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, [activeBranchId]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await api.getProducts({ branch_id: activeBranchId || undefined });
      setProducts(res.products || []);
    } catch (err) {
      console.error('Failed to load products for PC Builder:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper parser for hardware metadata
  const extractHardwareSpecs = (product: Product | null) => {
    if (!product) return null;
    const text = `${product.product_name} ${product.description || ''} ${product.model || ''}`.toUpperCase();

    // CPU Socket
    let socket = 'UNKNOWN';
    if (text.includes('AM5') || text.includes('RYZEN 7000') || text.includes('RYZEN 8000') || text.includes('RYZEN 9000') || text.includes('7800X3D')) socket = 'AM5';
    else if (text.includes('AM4') || text.includes('RYZEN 5000') || text.includes('5800X')) socket = 'AM4';
    else if (text.includes('LGA1700') || text.includes('LGA 1700') || text.includes('14700') || text.includes('13700') || text.includes('14900') || text.includes('Z790') || text.includes('B760')) socket = 'LGA1700';
    else if (text.includes('LGA1851') || text.includes('CORE ULTRA 200')) socket = 'LGA1851';

    // RAM Type
    let ramType = 'UNKNOWN';
    if (text.includes('DDR5') || text.includes('6000MHZ') || text.includes('5600MHZ')) ramType = 'DDR5';
    else if (text.includes('DDR4') || text.includes('3200MHZ') || text.includes('3600MHZ')) ramType = 'DDR4';

    // Form Factor
    let formFactor = 'ATX';
    if (text.includes('MINI-ITX') || text.includes('ITX')) formFactor = 'Mini-ITX';
    else if (text.includes('MICRO-ATX') || text.includes('MATX') || text.includes('MICRO ATX')) formFactor = 'Micro-ATX';
    else if (text.includes('E-ATX') || text.includes('EATX')) formFactor = 'E-ATX';

    // PSU Wattage
    let wattage = 0;
    const wattMatch = text.match(/(\d{3,4})\s*(W|WATT)/);
    if (wattMatch) {
      wattage = parseInt(wattMatch[1], 10);
    }

    // CPU TDP
    let cpuTdp = 65;
    if (text.includes('14700K') || text.includes('14900K') || text.includes('13900K')) cpuTdp = 253;
    else if (text.includes('7800X3D') || text.includes('7950X3D')) cpuTdp = 120;
    else if (text.includes('14600K') || text.includes('7700X')) cpuTdp = 125;
    else if (text.includes('7600') || text.includes('14400')) cpuTdp = 65;

    // GPU TDP
    let gpuTdp = 150;
    if (text.includes('4090')) gpuTdp = 450;
    else if (text.includes('4080')) gpuTdp = 320;
    else if (text.includes('4070')) gpuTdp = 220;
    else if (text.includes('4060')) gpuTdp = 115;
    else if (text.includes('7900 XTX')) gpuTdp = 355;
    else if (text.includes('7800 XT')) gpuTdp = 263;

    return { socket, ramType, formFactor, wattage, cpuTdp, gpuTdp };
  };

  // Compatibility validation rules
  const compatibilityReport = useMemo(() => {
    const issues: { type: 'ERROR' | 'WARNING'; message: string; details: string }[] = [];
    const cpuSpecs = extractHardwareSpecs(selectedParts.cpu);
    const moboSpecs = extractHardwareSpecs(selectedParts.motherboard);
    const ramSpecs = extractHardwareSpecs(selectedParts.ram);
    const psuSpecs = extractHardwareSpecs(selectedParts.psu);
    const caseSpecs = extractHardwareSpecs(selectedParts.case);
    const gpuSpecs = extractHardwareSpecs(selectedParts.gpu);

    // Rule 1: CPU Socket vs Motherboard Socket
    if (cpuSpecs && moboSpecs && cpuSpecs.socket !== 'UNKNOWN' && moboSpecs.socket !== 'UNKNOWN') {
      if (cpuSpecs.socket !== moboSpecs.socket) {
        issues.push({
          type: 'ERROR',
          message: `Incompatible Socket: CPU (${cpuSpecs.socket}) does not match Motherboard (${moboSpecs.socket})`,
          details: `The processor will physically not fit into this motherboard socket. Please select a ${cpuSpecs.socket} motherboard or change the CPU.`,
        });
      }
    }

    // Rule 2: Motherboard RAM generation vs RAM kit
    if (moboSpecs && ramSpecs && moboSpecs.ramType !== 'UNKNOWN' && ramSpecs.ramType !== 'UNKNOWN') {
      if (moboSpecs.ramType !== ramSpecs.ramType) {
        issues.push({
          type: 'ERROR',
          message: `Memory Standard Mismatch: Motherboard requires ${moboSpecs.ramType}, but selected RAM is ${ramSpecs.ramType}`,
          details: `DDR4 and DDR5 memory slots are physically keyed differently. They cannot be interchanged.`,
        });
      }
    }

    // Rule 3: Form Factor fit (Motherboard vs Case)
    if (moboSpecs && caseSpecs) {
      if (caseSpecs.formFactor === 'Mini-ITX' && (moboSpecs.formFactor === 'ATX' || moboSpecs.formFactor === 'E-ATX')) {
        issues.push({
          type: 'ERROR',
          message: `Chassis Size Restriction: ${moboSpecs.formFactor} motherboard cannot fit in ${caseSpecs.formFactor} case`,
          details: `Selected case only supports Mini-ITX form factor boards. Pick an ATX mid/full tower or a Mini-ITX motherboard.`,
        });
      }
    }

    // Rule 4: Estimated Power Supply Wattage calculation
    const baseOverhead = 75; // storage, fans, motherboard, peripherals
    const cpuDraw = cpuSpecs ? cpuSpecs.cpuTdp : 0;
    const gpuDraw = gpuSpecs ? gpuSpecs.gpuTdp : (selectedParts.gpu ? 200 : 0);
    const estimatedDraw = baseOverhead + cpuDraw + gpuDraw;
    const recommendedPsu = Math.ceil((estimatedDraw * 1.35) / 50) * 50; // 35% safety & efficiency headroom

    if (psuSpecs && psuSpecs.wattage > 0) {
      if (psuSpecs.wattage < estimatedDraw) {
        issues.push({
          type: 'ERROR',
          message: `Insufficient Power Supply: Selected PSU (${psuSpecs.wattage}W) is lower than estimated peak draw (${estimatedDraw}W)`,
          details: `System will crash under load. Minimum recommended is at least ${recommendedPsu}W.`,
        });
      } else if (psuSpecs.wattage < recommendedPsu) {
        issues.push({
          type: 'WARNING',
          message: `Tight PSU Headroom: ${psuSpecs.wattage}W is close to peak power draw (${estimatedDraw}W)`,
          details: `For optimal efficiency (50-70% load curve) and transient spikes, an ${recommendedPsu}W+ power supply is recommended.`,
        });
      }
    }

    return {
      issues,
      hasErrors: issues.some((i) => i.type === 'ERROR'),
      estimatedDraw,
      recommendedPsu,
      selectedPsuWattage: psuSpecs?.wattage || 0,
    };
  }, [selectedParts]);

  // Financial calculations
  const partsSubtotal = useMemo(() => {
    return (Object.values(selectedParts) as (Product | null)[]).reduce((acc: number, part: Product | null) => {
      return acc + (part ? Number(part.selling_price) : 0);
    }, 0);
  }, [selectedParts]);

  const serviceFees = (assemblyFeeEnabled ? assemblyFeeAmount : 0) + (osInstallEnabled ? osInstallAmount : 0);
  const grandTotal = partsSubtotal + serviceFees;

  const totalWarrantyMonths = useMemo(() => {
    let minWarrantyDays = 9999;
    let hasParts = false;
    (Object.values(selectedParts) as (Product | null)[]).forEach((part: Product | null) => {
      if (part && part.warranty_period) {
        hasParts = true;
        if (part.warranty_period < minWarrantyDays) minWarrantyDays = part.warranty_period;
      }
    });
    return hasParts ? Math.floor(minWarrantyDays / 30) : 12;
  }, [selectedParts]);

  // Handle Preset Load
  const handleApplyPreset = (presetType: 'HIGH_END_GAMING' | 'MAINSTREAM_VALUE' | 'CREATOR_STATION') => {
    const newParts = { ...selectedParts };

    if (presetType === 'HIGH_END_GAMING') {
      setBuildName('Apex 4K Ultra Gaming & Streaming Rig');
      newParts.cpu = products.find((p) => p.sku.includes('7800X3D') || p.product_name.includes('7800X3D')) || null;
      newParts.motherboard = products.find((p) => p.sku.includes('B650') || p.product_name.includes('B650')) || null;
      newParts.ram = products.find((p) => p.sku.includes('DDR5') || p.product_name.includes('DDR5')) || null;
      newParts.gpu = products.find((p) => p.sku.includes('4080') || p.product_name.includes('4080')) || null;
      newParts.storage = products.find((p) => p.sku.includes('990') || p.product_name.includes('SSD')) || null;
      newParts.psu = products.find((p) => p.sku.includes('850') || p.product_name.includes('850')) || null;
      newParts.case = products.find((p) => p.sku.includes('O11') || p.product_name.includes('Case') || p.product_type === 'Case') || null;
      newParts.cooler = products.find((p) => p.sku.includes('KRAKEN') || p.product_type === 'Cooler') || null;
    } else if (presetType === 'CREATOR_STATION') {
      setBuildName('Pro Studio CAD & 3D Render Workstation');
      newParts.cpu = products.find((p) => p.sku.includes('14700K') || p.product_name.includes('14700K')) || null;
      newParts.motherboard = products.find((p) => p.sku.includes('Z790') || p.product_name.includes('Z790')) || null;
      newParts.ram = products.find((p) => p.sku.includes('DDR5') || p.product_name.includes('DDR5')) || null;
      newParts.gpu = products.find((p) => p.sku.includes('4070') || p.product_name.includes('4070')) || null;
      newParts.storage = products.find((p) => p.sku.includes('990') || p.product_name.includes('SSD')) || null;
      newParts.psu = products.find((p) => p.sku.includes('850') || p.product_name.includes('850')) || null;
      newParts.case = products.find((p) => p.product_type === 'Case') || null;
      newParts.cooler = products.find((p) => p.product_type === 'Cooler') || null;
    } else {
      setBuildName('Esports 1080p High-FPS Rig');
      newParts.cpu = products.find((p) => p.sku.includes('7800X3D') || p.product_name.includes('i7') || p.product_type === 'CPU') || null;
      newParts.motherboard = products.find((p) => p.product_type === 'Motherboard') || null;
      newParts.ram = products.find((p) => p.product_type === 'RAM') || null;
      newParts.gpu = products.find((p) => p.sku.includes('4070') || p.product_type === 'GPU') || null;
      newParts.storage = products.find((p) => p.product_type === 'SSD') || null;
      newParts.psu = products.find((p) => p.product_type === 'Power Supply') || null;
      newParts.case = products.find((p) => p.product_type === 'Case') || null;
    }

    setSelectedParts(newParts);
  };

  // Convert to POS Cart
  const handlePushToPOS = () => {
    if (compatibilityReport.hasErrors) {
      alert('Cannot send to POS: Please resolve compatibility errors first.');
      return;
    }

    const itemsToSend: { product: Product; quantity: number }[] = [];
    (Object.values(selectedParts) as (Product | null)[]).forEach((part) => {
      if (part) {
        itemsToSend.push({ product: part, quantity: 1 });
      }
    });

    if (itemsToSend.length === 0) {
      alert('Please select at least one component to ring up in the POS.');
      return;
    }

    if (onSendToPOS) {
      onSendToPOS(itemsToSend);
      setPosTransferNotice(`Successfully transferred ${itemsToSend.length} build components to POS cart!`);
    } else if (onLoadCartItems) {
      onLoadCartItems(itemsToSend);
      setPosTransferNotice(`Successfully transferred ${itemsToSend.length} build components to POS cart!`);
      setTimeout(() => {
        if (onNavigate) onNavigate('pos');
      }, 800);
    } else if (onNavigate) {
      onNavigate('pos');
    }
  };

  // Filter products for the active picker modal
  const pickerProducts = useMemo(() => {
    if (!activeSlotPicker) return [];
    const slot = BUILD_SLOTS.find((s) => s.key === activeSlotPicker);
    if (!slot) return [];

    return products.filter((p) => {
      const type = (p.product_type || '').toUpperCase();
      const name = p.product_name.toUpperCase();
      const cat = (p.category_name || '').toUpperCase();

      if (slot.key === 'cpu') return type === 'CPU' || name.includes('RYZEN') || name.includes('CORE I') || name.includes('INTEL CORE');
      if (slot.key === 'motherboard') return type === 'MOTHERBOARD' || name.includes('MOTHERBOARD') || name.includes('B650') || name.includes('Z790') || name.includes('B760');
      if (slot.key === 'ram') return type === 'RAM' || name.includes('RAM') || name.includes('DDR4') || name.includes('DDR5') || name.includes('MEMORY');
      if (slot.key === 'gpu') return type === 'GPU' || name.includes('RTX') || name.includes('RADEON') || name.includes('GEFORCE') || name.includes('GRAPHICS');
      if (slot.key === 'storage') return type === 'SSD' || type === 'STORAGE' || name.includes('SSD') || name.includes('NVME') || name.includes('SAMSUNG 990');
      if (slot.key === 'psu') return type === 'POWER SUPPLY' || name.includes('PSU') || name.includes('POWER SUPPLY') || name.includes('850W') || name.includes('750W');
      if (slot.key === 'case') return type === 'CASE' || name.includes('CASE') || name.includes('CHASSIS') || name.includes('O11') || name.includes('TOWER');
      if (slot.key === 'cooler') return type === 'COOLER' || name.includes('COOLER') || name.includes('AIO') || name.includes('KRAKEN') || name.includes('LIQUID');

      return cat.includes('COMPONENT');
    });
  }, [activeSlotPicker, products]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Hardware Engine v2.5
            </span>
            <span className="text-xs text-slate-400">• Real-Time Socket & RAM Verification</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-600" />
            Custom PC Builder & Compatibility Checker
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Assemble high-performance rigs with automated socket, DDR4/DDR5 RAM, and wattage checks. One-click conversion to POS sales.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleApplyPreset('HIGH_END_GAMING')}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>4K Gaming Preset</span>
          </button>
          <button
            onClick={() => handleApplyPreset('CREATOR_STATION')}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl border border-amber-200 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <CircuitBoard className="w-3.5 h-3.5" />
            <span>CAD / Creator Preset</span>
          </button>
          <button
            onClick={() => {
              setSelectedParts({
                cpu: null, motherboard: null, ram: null, gpu: null,
                storage: null, psu: null, case: null, cooler: null,
              });
            }}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Reset Build
          </button>
        </div>
      </div>

      {posTransferNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">{posTransferNotice}</span>
          </div>
          <span className="text-[11px] text-emerald-600">Redirecting to checkout...</span>
        </div>
      )}

      {/* Main Grid: Component Slots on Left (8 cols), Compatibility & Invoice Summary on Right (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Build Slots (8 cols) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Component Slots & Part Selection
            </h2>
            <span className="text-xs text-slate-400">
              {Object.values(selectedParts).filter(Boolean).length} of {BUILD_SLOTS.length} components configured
            </span>
          </div>

          <div className="space-y-2.5">
            {BUILD_SLOTS.map((slot) => {
              const part = selectedParts[slot.key];
              const Icon = slot.icon;

              return (
                <div
                  key={slot.key}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    part
                      ? 'bg-white border-slate-200/90 shadow-xs'
                      : slot.required
                      ? 'bg-slate-50/70 border-dashed border-slate-300 hover:border-indigo-400'
                      : 'bg-slate-50/40 border-dashed border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    {/* Slot Info & Icon */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          part
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-200/80 text-slate-500'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{slot.label}</span>
                          {slot.required && !part && (
                            <span className="text-[10px] font-semibold text-rose-500 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-100">
                              Required
                            </span>
                          )}
                          {part && (
                            <span className="text-[10px] font-mono font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                              SKU: {part.sku}
                            </span>
                          )}
                        </div>

                        {part ? (
                          <div className="mt-0.5">
                            <p className="text-xs font-semibold text-indigo-950 truncate">
                              {part.product_name}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate max-w-lg">
                              {part.description || 'Verified compatible hardware component'}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {slot.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Price & Action Button */}
                    <div className="flex items-center gap-3 shrink-0">
                      {part ? (
                        <>
                          <div className="text-right">
                            <span className="font-mono font-bold text-sm text-slate-900 block">
                              ${Number(part.selling_price).toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {part.warranty_period ? `${Math.round(part.warranty_period / 30)} mo warranty` : 'Std warranty'}
                            </span>
                          </div>
                          <button
                            onClick={() => setActiveSlotPicker(slot.key)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Change Component"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSelectedParts({ ...selectedParts, [slot.key]: null })}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove Component"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setActiveSlotPicker(slot.key)}
                          className="px-3 py-1.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Select {slot.category}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Value-Add Services: Assembly, Cable Management & OS */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Workshop Assembly & Technical Services
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={assemblyFeeEnabled}
                  onChange={(e) => setAssemblyFeeEnabled(e.target.checked)}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">Custom Rig Assembly & Cable Management</span>
                    <span className="font-mono font-bold text-slate-900">${assemblyFeeAmount}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Clean routing, thermal paste application, BIOS update to latest stable release, and 2-hour stress test.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={osInstallEnabled}
                  onChange={(e) => setOsInstallEnabled(e.target.checked)}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">OS Setup, GPU Drivers & Optimization</span>
                    <span className="font-mono font-bold text-slate-900">${osInstallAmount}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Clean Windows 11 Pro installation, latest GeForce/Radeon Game-Ready drivers, and bloatware removal.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Compatibility Engine & Quote / POS Actions (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Live Compatibility Status Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Compatibility Engine
              </h3>
              {compatibilityReport.hasErrors ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Issue Detected
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  100% Compatible
                </span>
              )}
            </div>

            {/* Issues list */}
            {compatibilityReport.issues.length > 0 ? (
              <div className="space-y-2">
                {compatibilityReport.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs space-y-1 ${
                      issue.type === 'ERROR'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{issue.message}</span>
                    </div>
                    <p className="text-[11px] opacity-90 pl-5">{issue.details}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/70 rounded-xl text-xs text-emerald-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  All Selected Hardware Passes Verification
                </p>
                <p className="text-[11px] text-emerald-700">
                  CPU socket matches motherboard, memory generation is aligned, and form factors fit smoothly.
                </p>
              </div>
            )}

            {/* Live PSU Wattage Gauge */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Power Draw & PSU Meter
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {compatibilityReport.estimatedDraw}W / {compatibilityReport.selectedPsuWattage || 'No PSU'}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    compatibilityReport.selectedPsuWattage > 0 && compatibilityReport.estimatedDraw > compatibilityReport.selectedPsuWattage
                      ? 'bg-rose-500'
                      : compatibilityReport.selectedPsuWattage > 0 && compatibilityReport.estimatedDraw / compatibilityReport.selectedPsuWattage > 0.8
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      compatibilityReport.selectedPsuWattage > 0
                        ? (compatibilityReport.estimatedDraw / compatibilityReport.selectedPsuWattage) * 100
                        : 50
                    )}%`,
                  }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Peak Draw: {compatibilityReport.estimatedDraw}W</span>
                <span>Rec. PSU: {compatibilityReport.recommendedPsu}W+</span>
              </div>
            </div>
          </div>

          {/* Pricing & Checkout Summary Box */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl space-y-4">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Build Cost
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold font-mono text-white">
                  ${grandTotal.toFixed(2)}
                </span>
                <span className="text-xs text-slate-400 font-sans">USD</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300 border-t border-white/10 pt-3">
              <div className="flex justify-between">
                <span>Hardware Components ({Object.values(selectedParts).filter(Boolean).length} items):</span>
                <span className="font-mono font-bold text-white">${partsSubtotal.toFixed(2)}</span>
              </div>
              {assemblyFeeEnabled && (
                <div className="flex justify-between text-slate-400">
                  <span>Assembly & Thermal Benchmarking:</span>
                  <span className="font-mono text-white">${assemblyFeeAmount.toFixed(2)}</span>
                </div>
              )}
              {osInstallEnabled && (
                <div className="flex justify-between text-slate-400">
                  <span>OS Installation & Drivers:</span>
                  <span className="font-mono text-white">${osInstallAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-emerald-400 pt-1 border-t border-white/10 font-bold">
                <span>Comprehensive Shop Warranty:</span>
                <span>{totalWarrantyMonths} Months</span>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={handlePushToPOS}
                disabled={compatibilityReport.hasErrors || Object.values(selectedParts).filter(Boolean).length === 0}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Ring Up in POS (1-Click Invoice)</span>
              </button>

              <button
                onClick={() => setIsQuoteModalOpen(true)}
                className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-slate-300" />
                <span>Print Customer Spec Sheet / Quote</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= MODAL: PART PICKER CATALOG ================= */}
      {activeSlotPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Select {BUILD_SLOTS.find((s) => s.key === activeSlotPicker)?.label}
                </h3>
                <p className="text-xs text-slate-500">
                  Choose from currently available inventory at this branch.
                </p>
              </div>
              <button
                onClick={() => setActiveSlotPicker(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {pickerProducts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No products found for this component slot in current branch inventory.
                </div>
              ) : (
                pickerProducts.map((prod) => {
                  const isSelected = selectedParts[activeSlotPicker]?.id === prod.id;
                  const specs = extractHardwareSpecs(prod);

                  return (
                    <div
                      key={prod.id}
                      onClick={() => {
                        setSelectedParts({ ...selectedParts, [activeSlotPicker]: prod });
                        setActiveSlotPicker(null);
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{prod.product_name}</span>
                          {specs?.socket && specs.socket !== 'UNKNOWN' && (
                            <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded">
                              {specs.socket}
                            </span>
                          )}
                          {specs?.ramType && specs.ramType !== 'UNKNOWN' && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                              {specs.ramType}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          SKU: {prod.sku} • {prod.description || 'In Stock'}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-sm text-slate-900 block">
                          ${Number(prod.selling_price).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {prod.warranty_period ? `${Math.round(prod.warranty_period / 30)} mo warranty` : 'Std warranty'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: PRINTABLE CUSTOMER SPEC SHEET / QUOTE ================= */}
      {isQuoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                Hardware Build Specification & Official Quote
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Quote</span>
                </button>
                <button
                  onClick={() => setIsQuoteModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 text-xs text-slate-800 print:p-0">
              {/* Shop Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                    {user.organization_name || 'My Computer Store'}
                  </h2>
                  <p className="text-slate-500 text-xs">Custom PC Assembly & High-Performance Workstation Division</p>
                  <p className="text-slate-400 text-[11px]">Quote Date: {new Date().toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Quote Reference</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    PCQ-{Date.now().toString(36).toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Build Title */}
              <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Build Configuration</span>
                  <h3 className="text-sm font-bold text-indigo-950">{buildName}</h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-indigo-600 block">Estimated Peak Draw</span>
                  <span className="font-mono font-bold text-indigo-950">{compatibilityReport.estimatedDraw} Watts</span>
                </div>
              </div>

              {/* Parts Table */}
              <table className="w-full border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 text-left">Slot</th>
                    <th className="py-2 px-3 text-left">Selected Component</th>
                    <th className="py-2 px-3 text-left">SKU</th>
                    <th className="py-2 px-3 text-right">Warranty</th>
                    <th className="py-2 px-3 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {BUILD_SLOTS.map((slot) => {
                    const part = selectedParts[slot.key];
                    if (!part) return null;
                    return (
                      <tr key={slot.key}>
                        <td className="py-2.5 px-3 font-semibold text-slate-600">{slot.label}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{part.product_name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">{part.sku}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          {part.warranty_period ? `${Math.round(part.warranty_period / 30)} Months` : '1 Year'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          ${Number(part.selling_price).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                  {assemblyFeeEnabled && (
                    <tr className="bg-slate-50/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-600">Service</td>
                      <td className="py-2.5 px-3 text-slate-800" colSpan={2}>
                        Hardware Assembly, Cable Management & BIOS Flash
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">Shop Guarantee</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        ${assemblyFeeAmount.toFixed(2)}
                      </td>
                    </tr>
                  )}
                  {osInstallEnabled && (
                    <tr className="bg-slate-50/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-600">Software</td>
                      <td className="py-2.5 px-3 text-slate-800" colSpan={2}>
                        OS Installation, Driver Optimization & Stress Benchmark
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">Turn-Key Ready</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        ${osInstallAmount.toFixed(2)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Total Box */}
              <div className="flex justify-end">
                <div className="w-64 p-4 bg-slate-50 rounded-xl border border-slate-200/90 space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>Parts Subtotal:</span>
                    <span className="font-mono">${partsSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Services & Setup:</span>
                    <span className="font-mono">${serviceFees.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-1.5">
                    <span>Total Quote:</span>
                    <span className="font-mono text-base text-indigo-700">${grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Warranty Notice */}
              <div className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-200 pt-4">
                <strong>Warranty & Service Policy:</strong> All components covered under full manufacturer warranty. Built systems include free lifetime diagnostics and 30-day labor guarantee. Quotes valid for 7 business days subject to component market availability.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
