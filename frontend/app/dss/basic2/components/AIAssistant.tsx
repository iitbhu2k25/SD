'use client';

import { useState, useRef, useEffect } from 'react';
import { useBasicStore } from '../shared/store/basic.store';
import { API_BASE_URL } from '../shared/utils/constants';
import { Bot, Send, X, Minimize2, Maximize2, Loader2, Sparkles } from 'lucide-react';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    confirmedLocation,
    mode,
    populationForecast,
    selectedPopMethod,
    population2025,
    populationReportData,
    waterDemandTotals,
    waterDemandReportData,
    waterSupplyTotal,
    waterSupplyReportData,
    sewageReportData,
    thematicMapData,
    thematicMapMethod,
    thematicMapYear,
  } = useBasicStore();

  useEffect(() => {
    if (open && !minimized) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open, minimized]);

  useEffect(() => {
    if (open && !minimized) inputRef.current?.focus();
  }, [open, minimized]);

  const buildPayload = (q: string) => {
    const pop: Record<string, number> = {};
    if (populationForecast) {
      for (const [yr, val] of Object.entries(populationForecast)) pop[String(yr)] = val;
    }
    const demand: Record<string, number> = {};
    if (waterDemandTotals) {
      for (const [yr, val] of Object.entries(waterDemandTotals)) demand[String(yr)] = val;
    }
    return {
      question: q,
      // location
      location_label: confirmedLocation?.label ?? null,
      location_mode: mode ?? null,
      // population
      population_forecast: Object.keys(pop).length ? pop : null,
      selected_pop_method: selectedPopMethod ?? null,
      population_2025: population2025 ?? null,
      population_report: populationReportData ?? null,
      // water demand
      water_demand_totals: Object.keys(demand).length ? demand : null,
      water_demand_report: waterDemandReportData ?? null,
      // water supply
      water_supply_total: waterSupplyTotal ?? null,
      water_supply_report: waterSupplyReportData ?? null,
      // sewage
      sewage_report: sewageReportData ?? null,
      // thematic map
      thematic_map_method: thematicMapMethod ?? null,
      thematic_map_year: thematicMapYear ?? null,
      thematic_map_features: thematicMapData?.features ?? null,
    };
  };

  const handleSubmit = async () => {
    const q = question.trim();
    if (!q || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setQuestion('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/basic/generate-basic-data-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(q)),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `Error ${res.status}`);
      }
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'ai', text: data.response }]);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="AI Assistant"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 999,
          width: 52, height: 52, borderRadius: '50%', border: 'none',
          background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
          color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(99,102,241,0.5)',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <Sparkles size={22} />
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 999,
      width: 380,
      height: minimized ? 52 : 500,
      borderRadius: 16,
      background: '#fff',
      boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
      border: '1px solid #e2e8f0',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      transition: 'height 0.25s cubic-bezier(0.4,0,0.2,1)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px', flexShrink: 0,
        background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
        color: '#fff',
      }}>
        <Bot size={18} />
        <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>AI Assistant</span>
        <button type="button" onClick={() => setMinimized((v) => !v)}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
          {minimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
          <X size={14} />
        </button>
      </div>

      {!minimized && (
        <>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
                <Sparkles size={28} style={{ margin: '0 auto 8px', display: 'block', color: '#a5b4fc' }} />
                Ask me anything about the Basic Module results.<br />
                <span style={{ fontSize: 11, color: '#cbd5e1' }}>e.g. "What is the projected water demand in 2040?"</span>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  background: msg.role === 'user' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#f1f5f9',
                  color: msg.role === 'user' ? '#fff' : '#1e293b',
                  fontSize: 12.5,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6366f1' }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Thinking…</span>
              </div>
            )}
            {error && (
              <div style={{ fontSize: 12, color: '#ef4444', background: '#fef2f2', borderRadius: 8, padding: '6px 10px', border: '1px solid #fecaca' }}>
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid #f1f5f9', flexShrink: 0, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about the results… (Enter to send)"
              rows={2}
              style={{
                flex: 1, resize: 'none', border: '1px solid #e2e8f0', borderRadius: 10,
                padding: '8px 10px', fontSize: 12.5, outline: 'none', fontFamily: 'inherit',
                lineHeight: 1.5, color: '#1e293b',
              }}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!question.trim() || loading}
              style={{
                width: 36, height: 36, borderRadius: 10, border: 'none', flexShrink: 0,
                background: question.trim() && !loading ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#e2e8f0',
                color: question.trim() && !loading ? '#fff' : '#94a3b8',
                cursor: question.trim() && !loading ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
