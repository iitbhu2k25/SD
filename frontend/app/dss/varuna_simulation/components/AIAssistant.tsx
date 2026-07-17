// 'use client';

// import { useEffect, useRef, useState } from 'react';
// import { Bot, Loader2, Maximize2, Minimize2, Send, X } from 'lucide-react';
// import { useVarunaSimStore } from '../shared/store/varunaSim.store';
// import { askChatbot } from '../shared/services/varunaSim.service';

// interface Message {
//   role: 'user' | 'ai';
//   text: string;
// }

// export default function AIAssistant() {
//   const [open, setOpen] = useState(false);
//   const [minimized, setMinimized] = useState(false);
//   const [question, setQuestion] = useState('');
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const bottomRef = useRef<HTMLDivElement>(null);
//   const inputRef = useRef<HTMLTextAreaElement>(null);

//   const scenarios = useVarunaSimStore((s) => s.scenarios);
//   const activeScenarioId = useVarunaSimStore((s) => s.activeScenarioId);
//   const activeScenario = scenarios.find((s) => s.id === activeScenarioId);

//   useEffect(() => {
//     if (open && !minimized) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [messages, open, minimized]);

//   useEffect(() => {
//     if (open && !minimized) inputRef.current?.focus();
//   }, [open, minimized]);

//   const handleSubmit = async () => {
//     const q = question.trim();
//     if (!q || loading) return;

//     setMessages((prev) => [...prev, { role: 'user', text: q }]);
//     setQuestion('');
//     setLoading(true);
//     setError(null);

//     try {
//       const res = await askChatbot(q, activeScenario?.name ?? 'Default Baseline');
//       setMessages((prev) => [...prev, { role: 'ai', text: res.answer }]);
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Failed to reach the assistant.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (!open) {
//     return (
//       <button
//         onClick={() => setOpen(true)}
//         className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-blue-700 px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-blue-800"
//       >
//         <Bot className="h-4 w-4" /> Ask Varuna Assistant
//       </button>
//     );
//   }

//   return (
//     <div
//       className={`fixed bottom-5 right-5 z-50 flex flex-col rounded-xl border border-blue-200 bg-white shadow-2xl dark:border-blue-900/40 dark:bg-[#0a0f1a] ${
//         minimized ? 'h-12 w-72' : 'h-[480px] w-96'
//       }`}
//     >
//       <div className="flex items-center justify-between rounded-t-xl bg-blue-700 px-3 py-2 text-white">
//         <span className="flex items-center gap-2 text-sm font-medium"><Bot className="h-4 w-4" /> Varuna River Assistant</span>
//         <div className="flex items-center gap-1">
//           <button onClick={() => setMinimized((m) => !m)}>
//             {minimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
//           </button>
//           <button onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
//         </div>
//       </div>

//       {!minimized && (
//         <>
//           <div className="flex-1 overflow-y-auto px-3 py-2 text-sm">
//             {activeScenario && (
//               <p className="mb-2 rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
//                 Context: {activeScenario.name}
//               </p>
//             )}
//             {messages.map((m, i) => (
//               <div key={i} className={`mb-2 rounded-lg px-3 py-2 ${m.role === 'user' ? 'ml-auto max-w-[85%] bg-blue-600 text-white' : 'mr-auto max-w-[85%] bg-muted'}`}>
//                 {m.text}
//               </div>
//             ))}
//             {error && <p className="text-xs text-destructive">{error}</p>}
//             <div ref={bottomRef} />
//           </div>

//           <div className="flex items-center gap-2 border-t p-2">
//             <textarea
//               ref={inputRef}
//               value={question}
//               onChange={(e) => setQuestion(e.target.value)}
//               onKeyDown={(e) => {
//                 if (e.key === 'Enter' && !e.shiftKey) {
//                   e.preventDefault();
//                   handleSubmit();
//                 }
//               }}
//               placeholder="Ask Varuna River Assistant..."
//               rows={1}
//               className="flex-1 resize-none rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
//             />
//             <button
//               onClick={handleSubmit}
//               disabled={loading || !question.trim()}
//               className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-white disabled:opacity-50"
//             >
//               {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
//             </button>
//           </div>
//         </>
//       )}
//     </div>
//   );
// }
