import { useState } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';

export default function CollapsibleSection({
  icon,
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card-light neo-elevated collapsible-section" style={{ width: '100%', minWidth: 0 }}>
      <button
        type="button"
        className="collapsible-section-trigger"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ display: 'flex', flexShrink: 0 }}>{icon}</span>
          <div style={{ minWidth: 0, textAlign: 'left' }}>
            <div className="card-light-title" style={{ margin: 0 }}>{title}</div>
            {subtitle && (
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>
            )}
          </div>
        </div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'flex', flexShrink: 0, color: 'var(--text-muted)' }}
        >
          <ChevronDown size={18} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="card-light-body" style={{ paddingTop: 4 }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
