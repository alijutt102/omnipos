import React from 'react';

interface BadgeProps {
  status: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ status, className = '', size = 'sm' }) => {
  const normalized = status.toUpperCase().replace(/\s+/g, '_');

  let config = {
    bg: 'bg-slate-100 text-slate-700 border-slate-200/80',
    dot: 'bg-slate-400',
  };

  if (['IN_STOCK', 'ACTIVE', 'PAID', 'COMPLETED', 'RECEIVED', 'READY', 'DELIVERED', 'HEALTHY'].includes(normalized)) {
    config = {
      bg: 'bg-emerald-50/90 text-emerald-800 border-emerald-200/70',
      dot: 'bg-emerald-500',
    };
  } else if (['SOLD', 'RESERVED', 'PARTIAL', 'DISPATCHED', 'WAITING_FOR_PARTS', 'REPAIRING'].includes(normalized)) {
    config = {
      bg: 'bg-amber-50/90 text-amber-800 border-amber-200/70',
      dot: 'bg-amber-500',
    };
  } else if (['UNDER_REPAIR', 'DIAGNOSING', 'WAITING_FOR_APPROVAL', 'REQUESTED', 'PENDING'].includes(normalized)) {
    config = {
      bg: 'bg-sky-50/90 text-sky-800 border-sky-200/70',
      dot: 'bg-sky-500',
    };
  } else if (['RETURNED', 'TRANSFERRED', 'UNPAID', 'SERIALIZED'].includes(normalized)) {
    config = {
      bg: 'bg-indigo-50/90 text-indigo-800 border-indigo-200/70',
      dot: 'bg-indigo-500',
    };
  } else if (['DAMAGED', 'LOST', 'CANCELLED', 'INACTIVE', 'DEFECTIVE', 'VOID', 'OUT_OF_STOCK'].includes(normalized)) {
    config = {
      bg: 'bg-rose-50/90 text-rose-800 border-rose-200/70',
      dot: 'bg-rose-500',
    };
  }

  const paddingClass = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-md border tracking-tight tabular-nums whitespace-nowrap shadow-2xs ${paddingClass} ${config.bg} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      {status}
    </span>
  );
};
