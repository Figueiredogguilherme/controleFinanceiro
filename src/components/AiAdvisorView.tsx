import React, { useMemo, useState } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  BookOpen,
  Settings,
} from 'lucide-react';
import {
  AppSettings,
  BudgetGoal,
  FinancialSummary,
  Investment,
  Payslip,
  Transaction,
} from '../types/finance';
import {
  askFinancialAssistant,
  FINANCIAL_GLOSSARY,
  generateProactiveInsights,
} from '../services/aiAssistant';

interface AiAdvisorViewProps {
  settings: AppSettings;
  summary: FinancialSummary;
  transactions: Transaction[];
  payslips: Payslip[];
  investments: Investment[];
  budgetGoals: BudgetGoal[];
  onGoToSettings: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
}

const QUICK_QUESTIONS = [
  'Explique o Tesouro IPCA+ 2035 e o que é marcação a mercado',
  'Como posso otimizar meu IRRF no holerite Mercedes-Benz usando PGBL?',
  'Vale mais a pena uma LCI a 93% do CDI ou um CDB a 110% do CDI?',
  'Avalie minha reserva de emergência e diversificação da carteira',
];

export const AiAdvisorView: React.FC<AiAdvisorViewProps> = ({
  settings,
  summary,
  transactions,
  payslips,
  investments,
  budgetGoals,
  onGoToSettings,
}) => {
  const insights = useMemo(
    () =>
      generateProactiveInsights({
        summary,
        transactions,
        payslips,
        investments,
        budgetGoals,
      }),
    [summary, transactions, payslips, investments, budgetGoals],
  );

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Olá! Sou seu Assistente Financeiro e Educador. Analisei seu holerite da Mercedes-Benz, suas despesas no Banco do Brasil e sua carteira de investimentos. Pergunte sobre qualquer ativo, estratégia tributária ou termo econômico (CDI, IPCA+, marcação a mercado, P/L).',
      provider:
        settings.llmProvider === 'gemini' && settings.geminiApiKey
          ? `Google Gemini (${settings.geminiModel})`
          : settings.llmProvider === 'openai' && settings.openaiApiKey
            ? `OpenAI (${settings.openaiModel})`
            : 'Motor Analítico Local',
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [glossaryFilter, setGlossaryFilter] = useState('');

  const handleSend = async (prompt?: string) => {
    const text = (prompt ?? inputText).trim();
    if (!text || loading) return;

    const nextHistory = [...messages, { role: 'user' as const, content: text }];
    setMessages(nextHistory);
    setInputText('');
    setLoading(true);

    try {
      const res = await askFinancialAssistant({
        question: text,
        history: nextHistory.map((m) => ({ role: m.role, content: m.content })),
        summary,
        transactions,
        payslips,
        investments,
        settings,
      });

      setMessages([
        ...nextHistory,
        {
          role: 'assistant',
          content: res.answer,
          provider: res.providerUsed,
        },
      ]);
    } catch (err) {
      setMessages([
        ...nextHistory,
        {
          role: 'assistant',
          content: `Não foi possível consultar o provedor de IA externo: ${
            err instanceof Error ? err.message : 'erro desconhecido'
          }. Verifique sua chave de API na aba Configurações.`,
          provider: 'Erro de Integração',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const filteredGlossary = useMemo(() => {
    const q = glossaryFilter.trim().toLowerCase();
    if (!q) return FINANCIAL_GLOSSARY;
    return FINANCIAL_GLOSSARY.filter(
      (g) =>
        g.term.toLowerCase().includes(q) ||
        g.shortTitle.toLowerCase().includes(q) ||
        g.simpleExplanation.toLowerCase().includes(q),
    );
  }, [glossaryFilter]);

  return (
    <div className="space-y-6">
      {/* Proactive Insights */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Diagnóstico Proativo (Holerite MB + BB + Carteira)</h2>
          </div>
          <button type="button" onClick={onGoToSettings} className="btn-secondary py-1.5 text-xs">
            <Settings className="h-3.5 w-3.5" />
            Configurar API Gemini / OpenAI
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {insights.map((ins) => (
            <div
              key={ins.id}
              className={`glass-card p-4 border-l-4 ${
                ins.severity === 'good'
                  ? 'border-l-emerald-500'
                  : ins.severity === 'warning'
                    ? 'border-l-amber-500'
                    : 'border-l-cyan-500'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {ins.severity === 'good' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                ) : ins.severity === 'warning' ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                ) : (
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                )}
                <div>
                  <h3 className="text-sm font-bold text-white">{ins.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">{ins.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat & Glossary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Chat */}
        <div className="glass-card flex h-[540px] flex-col p-5 lg:col-span-7">
          <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Consultor Financeiro Interativo</h3>
                <p className="text-[11px] text-slate-400">
                  {settings.llmProvider === 'local_only'
                    ? 'Modo Local Didático (Configure Gemini/OpenAI nas Configurações para LLM completo)'
                    : `Conectado ao provedor: ${settings.llmProvider.toUpperCase()}`}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-emerald-600 text-white'
                      : 'border border-slate-800 bg-slate-950/80 text-slate-200'
                  }`}
                >
                  {m.content}
                </div>
                {m.provider && (
                  <span className="mt-1 px-1 text-[10px] text-slate-500">{m.provider}</span>
                )}
              </div>
            ))}
            {loading && (
              <div className="text-xs text-slate-400 animate-pulse">Analisando seus dados financeiros...</div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleSend(q)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300 transition"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="mt-3 flex gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Pergunte sobre seus gastos, holerite MB, CDI, IPCA+, P/L..."
              className="input-dark text-xs"
            />
            <button type="submit" disabled={loading} className="btn-primary px-4">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* Didactic Glossary */}
        <div className="glass-card flex h-[540px] flex-col p-5 lg:col-span-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Guia Didático de Conceitos</h3>
            </div>
            <input
              type="text"
              value={glossaryFilter}
              onChange={(e) => setGlossaryFilter(e.target.value)}
              placeholder="Filtrar termo..."
              className="input-dark w-36 py-1 text-xs"
            />
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
            {filteredGlossary.map((item) => (
              <div
                key={item.term}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-emerald-400">
                    {item.term} — {item.shortTitle}
                  </span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                    {item.category}
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">{item.simpleExplanation}</p>
                <p className="text-[11px] text-amber-200/90">
                  <strong>Exemplo:</strong> {item.practicalExample}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
