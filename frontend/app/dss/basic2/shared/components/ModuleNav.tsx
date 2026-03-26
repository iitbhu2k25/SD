'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';

interface NavButton {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'back' | 'next' | 'save';
}

interface ModuleNavProps {
  back?: NavButton;
  forward?: NavButton;
}

export default function ModuleNav({ back, forward }: ModuleNavProps) {
  if (!back && !forward) return null;

  const btnStyle = (variant: NavButton['variant'] = 'next', disabled = false): React.CSSProperties => {
    if (variant === 'back') return {
      display:'flex', alignItems:'center', gap:8,
      padding:'11px 22px', borderRadius:10,
      border:'2px solid #e2e8f0', background:'#fff',
      color: disabled ? '#cbd5e1' : '#475569',
      fontSize:14, fontWeight:700,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition:'all 0.15s',
      opacity: disabled ? 0.5 : 1,
    };
    if (variant === 'save') return {
      display:'flex', alignItems:'center', gap:8,
      padding:'11px 22px', borderRadius:10, border:'none',
      background: disabled
        ? '#e2e8f0'
        : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
      color: disabled ? '#94a3b8' : '#fff',
      fontSize:14, fontWeight:700,
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : '0 4px 12px rgba(22,163,74,0.3)',
      transition:'all 0.2s',
    };
    // next
    return {
      display:'flex', alignItems:'center', gap:8,
      padding:'11px 22px', borderRadius:10, border:'none',
      background: disabled ? '#e2e8f0' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
      color: disabled ? '#94a3b8' : '#fff',
      fontSize:14, fontWeight:700,
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : '0 4px 12px rgba(37,99,235,0.3)',
      transition:'all 0.2s',
    };
  };

  return (
    <div style={{
      display:'flex', alignItems:'center',
      justifyContent: back && forward ? 'space-between' : back ? 'flex-start' : 'flex-end',
      padding:'16px 20px',
      background:'#f8fafc',
      borderTop:'1px solid #e2e8f0',
      borderRadius:'0 0 12px 12px',
      marginTop:4,
    }}>
      {back && (
        <button type="button" onClick={back.onClick} disabled={back.disabled}
          style={btnStyle('back', back.disabled)}>
          <ArrowLeft size={15}/> {back.label}
        </button>
      )}
      {forward && (
        <button type="button" onClick={forward.onClick} disabled={forward.disabled}
          style={btnStyle(forward.variant ?? 'next', forward.disabled)}>
          {forward.label} <ArrowRight size={15}/>
        </button>
      )}
    </div>
  );
}