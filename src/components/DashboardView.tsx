import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Search,
  Trash2,
  CheckCircle2,
  CreditCard,
  Landmark,
  RefreshCw,
  Sparkles,
  BookOpen,
  Wallet,
} from 'lucide-react';
import {
  BankAccount,
  BudgetGoal,
  FinancialSummary,
  Investment,
  Payslip,
  Transaction,
} from '../types/finance';
import { formatBRL, formatPercent } from '../services/financialEngine';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../services/parsers/ofxParser';
import { EducationalTooltip } from './EducationalTooltip';

interface DashboardViewProps {
  summary: FinancialSummary;
  bankAccounts: BankAccount[];
  transactions: Transaction[];
  payslips: Payslip[];
  investments: Investment[];
  budgetGoals: BudgetGoal[];
  isDemoDataPresent: boolean;
  isPluggyConfigured: boolean;
  isSyncingPluggy: boolean;
  lastPluggySyncAt?: string;
  onSyncPluggyNow: () => Promise<void>;
  onRemoveDemoData: () => Promise<void>;
  onNavigateToTab: (tab: 'ingestion' | 'portfolio' | 'simulator' | 'ai' | 'settings') => void;
  onUpdateTransactionCategory: (id: string, category: string) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
}

const CHART_COLORS = [
  '#10b981',
  '#06b6d4',
  '#6366f1',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
];

const ASSET_CLASS_LABELS: Record<Investment['assetClass'], string> = {
  renda_fixa_pos: 'Renda Fixa Pós (Selic/CDI)',
  renda_fixa_pre: 'Renda Fixa Prefixada',
  renda_fixa_ipca: 'Renda Fixa Inflação (IPCA+)',
  acoes: 'Ações B3',
  fiis: 'Fundos Imobiliários (FIIs)',
  previdencia: 'Previdência (MBPrev)',
  cripto: 'Criptoativos',
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  bankAccounts,
  transactions,
  payslips,
  investments,
  budgetGoals,
  isDemoDataPresent,
  isPluggyConfigured,
  isSyncingPluggy,
  lastPluggySyncAt,
  onSyncPluggyNow,
  onRemoveDemoData,
  onNavigateToTab,
  onUpdateTransactionCategory,
  onDeleteTransaction,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | Transaction['type']>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');

  const availableMonths = useMemo(() => {
    return Array.from(new Set(transactions.map((t) => t.date.slice(0, 7))))
      .sort()
      .reverse();
  }, [transactions]);

  const monthlyCashflowData = useMemo(() => {
    const map = new Map<
      string,
      { month: string; Receitas: number; Despesas: number; Aportes: number }
    >();

    transactions.forEach((t) => {
      const m = t.date.slice(0, 7);
      const curr = map.get(m) ?? { month: m, Receitas: 0, Despesas: 0, Aportes: 0 };
      if (t.type === 'income') curr.Receitas += t.amount;
      else if (t.type === 'expense') curr.Despesas += t.amount;
      else if (t.type === 'investment') curr.Aportes += t.amount;
      map.set(m, curr);
    });

    return Array.from(map.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-8);
  }, [transactions]);

  const latestMonth = summary.activeMonthLabel;

  const categoryExpenses = useMemo(() => {
    const targetMonth = monthFilter !== 'all' ? monthFilter : latestMonth;
    const map = new Map<string, number>();
    transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(targetMonth))
      .forEach((t) => {
        map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
      });

    return Array.from(map.entries())
      .map(([category, amount]) => {
        const goal = budgetGoals.find((g) => g.category === category);
        return {
          category,
          amount,
          limit: goal?.monthlyLimit ?? null,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, latestMonth, monthFilter, budgetGoals]);

  const portfolioAllocationData = useMemo(() => {
    const map = new Map<string, number>();
    investments.forEach((inv) => {
      const label = ASSET_CLASS_LABELS[inv.assetClass] ?? inv.assetClass;
      map.set(label, (map.get(label) ?? 0) + inv.currentValue);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  }, [investments]);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        if (monthFilter !== 'all' && !t.date.startsWith(monthFilter)) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            t.description.toLowerCase().includes(q) ||
            t.category.toLowerCase().includes(q) ||
            t.account.toLowerCase().includes(q) ||
            t.date.includes(q)
          );
        }
        return true;
      })
      .slice(0, 40);
  }, [transactions, typeFilter, monthFilter, searchQuery]);

  const latestPayslip = payslips[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Demo vs Live Banner */}
      {isDemoDataPresent && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-slate-900/90 to-cyan-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Modo Demonstração Ativo (Dados de Exemplo carregados)
              </h3>
              <p className="text-xs text-slate-300">
                Estes valores iniciais são exemplos para você testar os gráficos. Conecte seu{' '}
                <strong>Pluggy Open Finance (BB)</strong> para importar seus dados reais automaticamente ou limpe os exemplos com 1 clique.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isPluggyConfigured ? (
              <button
                type="button"
                onClick={onSyncPluggyNow}
                disabled={isSyncingPluggy}
                className="btn-primary py-2 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncingPluggy ? 'animate-spin' : ''}`} />
                <span>
                  {isSyncingPluggy
                    ? 'Importando seus dados Pluggy...'
                    : 'Buscar Meus Dados Reais (Pluggy)'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigateToTab('settings')}
                className="btn-primary py-2 text-xs"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Guia de Conexão Pluggy &amp; IA</span>
              </button>
            )}
            <button
              type="button"
              onClick={onRemoveDemoData}
              className="btn-secondary py-2 text-xs"
            >
              Limpar Dados de Exemplo
            </button>
          </div>
        </div>
      )}

      {/* Primary KPI Executive Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Net Worth & Portfolio */}
        <div className="glass-card-hover p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span className="flex items-center gap-1.5">
              <Wallet className="h-4 w-4 text-emerald-400" />
              Patrimônio Líquido Total
            </span>
            <EducationalTooltip term="IPCA+" inlineLabel="IPCA+" />
          </div>
          <div className="mt-2.5 font-mono-num text-2xl font-extrabold text-white sm:text-3xl">
            {formatBRL(summary.netWorth)}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1 text-xs">
            <span className="text-slate-400">
              Investido:{' '}
              <strong className="font-mono-num text-slate-200">
                {formatBRL(summary.totalPortfolioValue)}
              </strong>
            </span>
            <span
              className={`inline-flex items-center gap-0.5 font-mono-num font-semibold ${
                summary.portfolioGain >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {summary.portfolioGain >= 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              {formatPercent(summary.portfolioGainPct, 1)}
            </span>
          </div>
        </div>

        {/* Card 2: Salário / Holerite Mercedes-Benz */}
        <div className="glass-card-hover p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-cyan-400" />
              Holerite MB ({latestPayslip?.competence ?? '--'})
            </span>
            {latestPayslip?.reconciledTransactionId && (
              <span className="badge-emerald text-[10px]">
                <CheckCircle2 className="h-3 w-3" /> BB Conciliado
              </span>
            )}
          </div>
          <div className="mt-2.5 font-mono-num text-2xl font-extrabold text-white sm:text-3xl">
            {formatBRL(latestPayslip?.netSalary ?? 0)}
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-slate-400">
            <span>
              Bruto:{' '}
              <strong className="font-mono-num text-slate-200">
                {formatBRL(latestPayslip?.grossSalary ?? 0)}
              </strong>
            </span>
            <span className="text-rose-400 font-mono-num">
              Retenções: -{formatBRL(latestPayslip?.totalDeductions ?? 0)}
            </span>
          </div>
        </div>

        {/* Card 3: Fluxo de Caixa do Mês */}
        <div className="glass-card-hover p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Resultado Mensal ({latestMonth})
            </span>
            <span className="badge-emerald font-mono-num">
              Poupança {formatPercent(summary.savingsRate, 1)}
            </span>
          </div>
          <div className="mt-2.5 font-mono-num text-2xl font-extrabold text-white sm:text-3xl">
            {formatBRL(summary.monthlyIncome - summary.monthlyExpenses)}
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs font-mono-num">
            <span className="text-emerald-400">+{formatBRL(summary.monthlyIncome)}</span>
            <span className="text-rose-400">-{formatBRL(summary.monthlyExpenses)}</span>
          </div>
        </div>

        {/* Card 4: Reserva de Liquidez */}
        <div className="glass-card-hover p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-amber-400" />
              Reserva de Liquidez (D+0/D+1)
            </span>
            <EducationalTooltip term="CDI" inlineLabel="CDI" />
          </div>
          <div className="mt-2.5 font-mono-num text-2xl font-extrabold text-white sm:text-3xl">
            {summary.emergencyFundMonths.toFixed(1).replace('.', ',')} meses
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-slate-400">
            <span>
              Caixa + Selic/DI:{' '}
              <strong className="font-mono-num text-slate-200">
                {formatBRL(summary.liquidReserves)}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Bank Accounts & Credit Cards Strip (Banco do Brasil / Open Finance Pluggy) */}
      <div className="glass-card p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">
                Contas Bancárias &amp; Cartões (Banco do Brasil / Open Finance)
              </h3>
              {lastPluggySyncAt && (
                <span className="badge-cyan text-[10px]">
                  Sincronizado em {new Date(lastPluggySyncAt).toLocaleString('pt-BR')}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Saldos das suas contas correntes e faturas de cartão conectadas via Pluggy ou importação OFX
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                isPluggyConfigured ? onSyncPluggyNow() : onNavigateToTab('settings')
              }
              disabled={isSyncingPluggy}
              className="btn-secondary py-1.5 text-xs"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-cyan-400 ${isSyncingPluggy ? 'animate-spin' : ''}`}
              />
              <span>
                {isSyncingPluggy
                  ? 'Sincronizando Pluggy...'
                  : isPluggyConfigured
                    ? 'Atualizar Saldos e Extrato (Pluggy)'
                    : 'Configurar Open Finance Pluggy'}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bankAccounts.map((acc) => {
            const isCredit = acc.type === 'CREDIT';
            return (
              <div
                key={acc.id}
                className="flex items-center justify-between rounded-xl border border-slate-800/90 bg-[#070B14]/80 p-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isCredit
                        ? 'bg-rose-500/15 text-rose-400'
                        : 'bg-emerald-500/15 text-emerald-400'
                    }`}
                  >
                    {isCredit ? (
                      <CreditCard className="h-5 w-5" />
                    ) : (
                      <Landmark className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-white">{acc.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {acc.institution}
                      {acc.number ? ` · ${acc.number}` : ''}
                      {acc.source === 'pluggy' ? ' · Open Finance' : ''}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 pl-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">
                    {isCredit ? 'Fatura Atual' : 'Saldo Disponível'}
                  </div>
                  <div
                    className={`font-mono-num text-base font-extrabold ${
                      isCredit ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {formatBRL(acc.balance)}
                  </div>
                  {isCredit && acc.availableCreditLimit !== undefined && (
                    <div className="text-[10px] text-slate-500 font-mono-num">
                      Disp: {formatBRL(acc.availableCreditLimit)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="glass-card p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">
                Evolução do Fluxo de Caixa (Banco do Brasil)
              </h3>
              <p className="text-xs text-slate-400">
                Comparativo mensal entre Entradas, Saídas e Aportes em Investimentos
              </p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyCashflowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#0D1322',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => formatBRL(value)}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Receitas" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Despesas" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Aportes" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-5 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Alocação da Carteira</h3>
              <p className="text-xs text-slate-400">Distribuição por classe de ativo</p>
            </div>
            <EducationalTooltip term="Marcação a Mercado" inlineLabel="Marcação" />
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={portfolioAllocationData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={84}
                  paddingAngle={3}
                >
                  {portfolioAllocationData.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#0D1322',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => formatBRL(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {portfolioAllocationData.map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                  />
                  <span className="truncate text-slate-300">{item.name}</span>
                </div>
                <span className="ml-2 font-mono-num font-semibold text-slate-200">
                  {summary.totalPortfolioValue > 0
                    ? `${((item.value / summary.totalPortfolioValue) * 100).toFixed(0)}%`
                    : '0%'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payslip Breakdown & Expense Categories */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="glass-card p-5 lg:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">
                Demonstrativo Mercedes-Benz
              </h3>
              <p className="text-xs text-slate-400">
                Competência {latestPayslip?.competence ?? '--'} · Crédito{' '}
                {latestPayslip?.paymentDate ?? '--'}
              </p>
            </div>
            <EducationalTooltip term="PGBL vs VGBL" inlineLabel="Dedução PGBL" />
          </div>

          {latestPayslip ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-800 bg-[#070B14] p-3 text-center">
                <div>
                  <div className="text-[11px] text-slate-400">Salário Bruto</div>
                  <div className="font-mono-num text-sm font-bold text-emerald-400">
                    {formatBRL(latestPayslip.grossSalary)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Descontos</div>
                  <div className="font-mono-num text-sm font-bold text-rose-400">
                    -{formatBRL(latestPayslip.totalDeductions)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Salário Líquido</div>
                  <div className="font-mono-num text-sm font-bold text-white">
                    {formatBRL(latestPayslip.netSalary)}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                {latestPayslip.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-[#070B14]/60 px-3 py-2"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="mr-2 font-mono text-[10px] text-slate-500">
                        {item.code}
                      </span>
                      <span className="text-slate-200">{item.description}</span>
                    </div>
                    <span
                      className={`shrink-0 font-mono-num font-semibold ${
                        item.kind === 'earning'
                          ? 'text-emerald-400'
                          : item.kind === 'deduction'
                            ? 'text-rose-400'
                            : 'text-cyan-400'
                      }`}
                    >
                      {item.kind === 'deduction' ? '-' : item.kind === 'earning' ? '+' : ''}
                      {formatBRL(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-400">
              Nenhum holerite importado ainda. Acesse a aba <strong>Extrato BB &amp; Holerite MB</strong>.
            </div>
          )}
        </div>

        <div className="glass-card p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">
                Orçamento por Categoria ({monthFilter !== 'all' ? monthFilter : latestMonth})
              </h3>
              <p className="text-xs text-slate-400">
                Acompanhamento de gastos frente aos limites mensais planejados
              </p>
            </div>
            <span className="text-xs font-medium text-slate-400">
              Saídas no mês:{' '}
              <strong className="font-mono-num text-rose-400">
                {formatBRL(summary.monthlyExpenses)}
              </strong>
            </span>
          </div>

          <div className="space-y-3">
            {categoryExpenses.length === 0 ? (
              <p className="text-xs text-slate-400">
                Sem despesas registradas para este período.
              </p>
            ) : (
              categoryExpenses.map((cat) => {
                const pct = cat.limit ? Math.min(100, (cat.amount / cat.limit) * 100) : 0;
                const over = cat.limit !== null && cat.amount > cat.limit;
                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-200">{cat.category}</span>
                      <span className="font-mono-num text-slate-400">
                        <strong className={over ? 'text-rose-400' : 'text-slate-100'}>
                          {formatBRL(cat.amount)}
                        </strong>
                        {cat.limit ? ` / meta ${formatBRL(cat.limit)}` : ''}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800/90">
                      <div
                        className={`h-full rounded-full transition-all ${
                          over
                            ? 'bg-rose-500'
                            : cat.limit
                              ? 'bg-emerald-500'
                              : 'bg-cyan-500'
                        }`}
                        style={{
                          width: `${
                            cat.limit
                              ? pct
                              : Math.min(
                                  100,
                                  (cat.amount / Math.max(summary.monthlyExpenses, 1)) * 100,
                                )
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Transactions Ledger */}
      <div className="glass-card p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-white">
              Movimentações Consolidadas ({transactions.length} registros)
            </h3>
            <p className="text-xs text-slate-400">
              Filtre por mês, tipo ou pesquise qualquer estabelecimento sincronizado do Banco do Brasil
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar descrição, conta..."
                className="input-dark pl-8 py-1.5 text-xs w-52"
              />
            </div>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="input-dark w-auto py-1.5 text-xs"
            >
              <option value="all">Todos os meses</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  Competência {m}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | Transaction['type'])}
              className="input-dark w-auto py-1.5 text-xs"
            >
              <option value="all">Todos os tipos</option>
              <option value="income">Receitas</option>
              <option value="expense">Despesas</option>
              <option value="investment">Aportes</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-2.5 pr-4 font-semibold">Data</th>
                <th className="pb-2.5 pr-4 font-semibold">Descrição</th>
                <th className="pb-2.5 pr-4 font-semibold">Categoria</th>
                <th className="pb-2.5 pr-4 font-semibold">Conta / Origem</th>
                <th className="pb-2.5 pr-4 text-right font-semibold">Valor</th>
                <th className="pb-2.5 text-right font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTransactions.map((tx) => {
                const categoryOptions =
                  tx.type === 'income'
                    ? INCOME_CATEGORIES
                    : Array.from(new Set([...EXPENSE_CATEGORIES, tx.category]));
                return (
                  <tr key={tx.id} className="hover:bg-slate-900/50 transition">
                    <td className="py-2.5 pr-4 font-mono-num text-slate-400 whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-slate-100 max-w-sm truncate">
                      {tx.description}
                    </td>
                    <td className="py-2.5 pr-4">
                      <select
                        value={tx.category}
                        onChange={(e) => onUpdateTransactionCategory(tx.id, e.target.value)}
                        className="rounded-lg border border-slate-700/80 bg-[#070B14] px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      >
                        {categoryOptions.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-400 whitespace-nowrap">
                      {tx.account}
                    </td>
                    <td
                      className={`py-2.5 pr-4 text-right font-mono-num font-bold whitespace-nowrap ${
                        tx.type === 'income'
                          ? 'text-emerald-400'
                          : tx.type === 'investment'
                            ? 'text-cyan-400'
                            : 'text-rose-400'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatBRL(tx.amount)}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteTransaction(tx.id)}
                        className="rounded-lg p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition"
                        title="Remover transação"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
