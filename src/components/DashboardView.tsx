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
} from 'lucide-react';
import {
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
  transactions: Transaction[];
  payslips: Payslip[];
  investments: Investment[];
  budgetGoals: BudgetGoal[];
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
  transactions,
  payslips,
  investments,
  budgetGoals,
  onUpdateTransactionCategory,
  onDeleteTransaction,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | Transaction['type']>('all');

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
      .slice(-6);
  }, [transactions]);

  const latestMonth = useMemo(() => {
    const months = Array.from(new Set(transactions.map((t) => t.date.slice(0, 7)))).sort();
    return months[months.length - 1] ?? new Date().toISOString().slice(0, 7);
  }, [transactions]);

  const categoryExpenses = useMemo(() => {
    const map = new Map<string, number>();
    transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(latestMonth))
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
  }, [transactions, latestMonth, budgetGoals]);

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
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            t.description.toLowerCase().includes(q) ||
            t.category.toLowerCase().includes(q) ||
            t.date.includes(q)
          );
        }
        return true;
      })
      .slice(0, 25);
  }, [transactions, typeFilter, searchQuery]);

  const latestPayslip = payslips[0] ?? null;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Patrimônio Investido Total</span>
            <EducationalTooltip term="IPCA+" inlineLabel="Proteção" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-white">
            {formatBRL(summary.totalPortfolioValue)}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span
              className={`inline-flex items-center gap-0.5 font-semibold ${
                summary.portfolioGain >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {summary.portfolioGain >= 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              {formatBRL(summary.portfolioGain)} ({formatPercent(summary.portfolioGainPct, 1)})
            </span>
            <span className="text-slate-500">sobre custo</span>
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Holerite Mercedes-Benz ({latestPayslip?.competence ?? '--'})</span>
            <Building2 className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-white">
            {formatBRL(latestPayslip?.netSalary ?? 0)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Bruto: {formatBRL(latestPayslip?.grossSalary ?? 0)}</span>
            {latestPayslip?.reconciledTransactionId && (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="h-3 w-3" /> BB conciliado
              </span>
            )}
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Fluxo de Caixa BB ({latestMonth})</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-white">
            {formatBRL(summary.monthlyIncome - summary.monthlyExpenses)}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-emerald-400">+{formatBRL(summary.monthlyIncome)}</span>
            <span className="text-rose-400">-{formatBRL(summary.monthlyExpenses)}</span>
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>Reserva de Emergência (D+0/D+1)</span>
            <ShieldCheck className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-white">
            {summary.emergencyFundMonths.toFixed(1).replace('.', ',')} meses
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Liquidez: {formatBRL(summary.liquidReserves)}</span>
            <EducationalTooltip term="CDI" inlineLabel="CDI" />
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="glass-card p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Fluxo de Caixa Mensal (Banco do Brasil)</h3>
              <p className="text-xs text-slate-400">
                Receitas (Salário MB + Dividendos), Despesas e Aportes em Investimentos
              </p>
            </div>
            <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
              Poupança: {formatPercent(summary.savingsRate, 1)}
            </span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyCashflowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
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
            <EducationalTooltip term="Marcação a Mercado" inlineLabel="Risco & Marcação" />
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
                    backgroundColor: '#0f172a',
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
                <span className="ml-2 font-semibold text-slate-200">
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
              <h3 className="text-base font-bold text-white">Detalhamento Holerite Mercedes-Benz</h3>
              <p className="text-xs text-slate-400">
                Competência {latestPayslip?.competence ?? '--'} · Pagamento{' '}
                {latestPayslip?.paymentDate ?? '--'}
              </p>
            </div>
            <EducationalTooltip term="PGBL vs VGBL" inlineLabel="Benefício PGBL" />
          </div>

          {latestPayslip ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-center">
                <div>
                  <div className="text-[11px] text-slate-400">Bruto</div>
                  <div className="text-sm font-bold text-emerald-400">
                    {formatBRL(latestPayslip.grossSalary)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Descontos</div>
                  <div className="text-sm font-bold text-rose-400">
                    {formatBRL(latestPayslip.totalDeductions)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Líquido</div>
                  <div className="text-sm font-bold text-white">
                    {formatBRL(latestPayslip.netSalary)}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                {latestPayslip.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="mr-2 font-mono text-[10px] text-slate-500">{item.code}</span>
                      <span className="text-slate-200">{item.description}</span>
                    </div>
                    <span
                      className={`shrink-0 font-semibold ${
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
              Nenhum holerite importado ainda.
            </div>
          )}
        </div>

        <div className="glass-card p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Gastos por Categoria ({latestMonth})</h3>
              <p className="text-xs text-slate-400">Comparado às metas mensais configuradas</p>
            </div>
            <span className="text-xs font-medium text-slate-400">
              Total despesas: <strong className="text-rose-400">{formatBRL(summary.monthlyExpenses)}</strong>
            </span>
          </div>

          <div className="space-y-3">
            {categoryExpenses.length === 0 ? (
              <p className="text-xs text-slate-400">Sem despesas registradas para {latestMonth}.</p>
            ) : (
              categoryExpenses.map((cat) => {
                const pct = cat.limit ? Math.min(100, (cat.amount / cat.limit) * 100) : 0;
                const over = cat.limit !== null && cat.amount > cat.limit;
                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-200">{cat.category}</span>
                      <span className="text-slate-400">
                        <strong className={over ? 'text-rose-400' : 'text-slate-100'}>
                          {formatBRL(cat.amount)}
                        </strong>
                        {cat.limit ? ` / meta ${formatBRL(cat.limit)}` : ''}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all ${
                          over ? 'bg-rose-500' : cat.limit ? 'bg-emerald-500' : 'bg-cyan-500'
                        }`}
                        style={{ width: `${cat.limit ? pct : Math.min(100, (cat.amount / Math.max(summary.monthlyExpenses, 1)) * 100)}%` }}
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
            <h3 className="text-base font-bold text-white">Extrato Consolidado (Banco do Brasil &amp; RH)</h3>
            <p className="text-xs text-slate-400">
              Recategorize qualquer lançamento diretamente no SQLite em memória
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar descrição ou categoria..."
                className="input-dark pl-8 py-1.5 text-xs w-56"
              />
            </div>
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
                <th className="pb-2.5 pr-4 font-medium">Data</th>
                <th className="pb-2.5 pr-4 font-medium">Descrição</th>
                <th className="pb-2.5 pr-4 font-medium">Categoria</th>
                <th className="pb-2.5 pr-4 font-medium">Conta / Origem</th>
                <th className="pb-2.5 pr-4 text-right font-medium">Valor</th>
                <th className="pb-2.5 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTransactions.map((tx) => {
                const categoryOptions =
                  tx.type === 'income'
                    ? INCOME_CATEGORIES
                    : Array.from(new Set([...EXPENSE_CATEGORIES, tx.category]));
                return (
                  <tr key={tx.id} className="hover:bg-slate-900/60">
                    <td className="py-2.5 pr-4 font-mono text-slate-400 whitespace-nowrap">{tx.date}</td>
                    <td className="py-2.5 pr-4 font-medium text-slate-200 max-w-xs truncate">
                      {tx.description}
                    </td>
                    <td className="py-2.5 pr-4">
                      <select
                        value={tx.category}
                        onChange={(e) => onUpdateTransactionCategory(tx.id, e.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      >
                        {categoryOptions.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-400 whitespace-nowrap">{tx.account}</td>
                    <td
                      className={`py-2.5 pr-4 text-right font-semibold whitespace-nowrap ${
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
