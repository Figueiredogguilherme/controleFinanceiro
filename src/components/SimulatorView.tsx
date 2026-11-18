import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import { Calculator, Sparkles, AlertTriangle } from 'lucide-react';
import { AppSettings, FinancialSummary } from '../types/finance';
import {
  formatBRL,
  formatPercent,
  simulateInvestmentScenarios,
  SimulatorInput,
} from '../services/financialEngine';
import { EducationalTooltip } from './EducationalTooltip';

interface SimulatorViewProps {
  settings: AppSettings;
  summary: FinancialSummary;
}

export const SimulatorView: React.FC<SimulatorViewProps> = ({ settings, summary }) => {
  const [viewRealPower, setViewRealPower] = useState(false);

  const [input, setInput] = useState<SimulatorInput>({
    initialAmount: 20000,
    monthlyContribution: 1500,
    years: 5,
    cdiAnnual: settings.benchmarkCdi,
    ipcaAnnual: settings.benchmarkIpca,
    cdbPctCdi: 100,
    lciPctCdi: 92,
    tesouroIpcaRealRate: 6.3,
    mixedFiisPct: 50,
    mixedSelicPct: 35,
    mixedEquitiesPct: 15,
    fiisAnnualReturn: 12.0,
    equitiesAnnualReturn: 14.5,
    applyIncomeTax: true,
    shortTermDaysForIofCheck: 365,
  });

  const output = useMemo(() => simulateInvestmentScenarios(input), [input]);

  const chartData = useMemo(
    () =>
      output.points.map((p) => ({
        label: p.label,
        'Total Aportado': p.totalInvested,
        [`CDB ${input.cdbPctCdi}% CDI`]: viewRealPower ? p.cdbNetReal : p.cdbNetNominal,
        [`LCI ${input.lciPctCdi}% CDI (Isenta)`]: viewRealPower ? p.lciNetReal : p.lciNetNominal,
        'Tesouro IPCA+': viewRealPower ? p.ipcaNetReal : p.ipcaNetNominal,
        'Carteira Mista (FIIs+Selic+Ações)': viewRealPower
          ? p.mixedNetReal
          : p.mixedNetNominal,
      })),
    [output.points, viewRealPower, input.cdbPctCdi, input.lciPctCdi],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Simulador Comparativo de Investimentos</h2>
          <p className="text-xs text-slate-400">
            Compare juros compostos, tabela regressiva de IR, equivalência LCI/CDB e poder de compra real (descontando IPCA)
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setInput((prev) => ({
                ...prev,
                initialAmount: 0,
                monthlyContribution: 1500,
                years: 5,
                cdbPctCdi: 100,
              }))
            }
            className="btn-secondary text-xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            Cenário R$ 1.500/mês · 5 anos
          </button>
          <button
            type="button"
            onClick={() =>
              setInput((prev) => ({
                ...prev,
                initialAmount: Math.round(summary.totalPortfolioValue),
                monthlyContribution: Math.max(
                  500,
                  Math.round(Math.max(0, summary.monthlyIncome - summary.monthlyExpenses)),
                ),
                years: 10,
              }))
            }
            className="btn-primary text-xs"
          >
            <Calculator className="h-3.5 w-3.5" />
            Carregar Minha Realidade Atual
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Controls */}
        <div className="glass-card p-5 space-y-4 lg:col-span-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Parâmetros da Simulação</h3>
            <EducationalTooltip term="Tabela Regressiva IR" inlineLabel="Regras IR" />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="mb-1 block text-slate-400">Valor Inicial (R$)</label>
              <input
                type="number"
                min={0}
                step={500}
                value={input.initialAmount}
                onChange={(e) => setInput({ ...input, initialAmount: Number(e.target.value) })}
                className="input-dark text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-400">Aporte Mensal (R$)</label>
              <input
                type="number"
                min={0}
                step={100}
                value={input.monthlyContribution}
                onChange={(e) =>
                  setInput({ ...input, monthlyContribution: Number(e.target.value) })
                }
                className="input-dark text-xs"
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-400">Prazo da Simulação</span>
              <span className="font-bold text-emerald-400">{input.years} anos</span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              value={input.years}
              onChange={(e) => setInput({ ...input, years: Number(e.target.value) })}
              className="w-full accent-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="mb-1 block text-slate-400">CDI Estimado (% a.a.)</label>
              <input
                type="number"
                step="0.25"
                value={input.cdiAnnual}
                onChange={(e) => setInput({ ...input, cdiAnnual: Number(e.target.value) })}
                className="input-dark text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-400">IPCA Estimado (% a.a.)</label>
              <input
                type="number"
                step="0.25"
                value={input.ipcaAnnual}
                onChange={(e) => setInput({ ...input, ipcaAnnual: Number(e.target.value) })}
                className="input-dark text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-400">CDB (% do CDI)</label>
              <input
                type="number"
                step="5"
                value={input.cdbPctCdi}
                onChange={(e) => setInput({ ...input, cdbPctCdi: Number(e.target.value) })}
                className="input-dark text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-400">LCI/LCA Isenta (% CDI)</label>
              <input
                type="number"
                step="1"
                value={input.lciPctCdi}
                onChange={(e) => setInput({ ...input, lciPctCdi: Number(e.target.value) })}
                className="input-dark text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-400">Tesouro IPCA+ (Real %)</label>
              <input
                type="number"
                step="0.1"
                value={input.tesouroIpcaRealRate}
                onChange={(e) =>
                  setInput({ ...input, tesouroIpcaRealRate: Number(e.target.value) })
                }
                className="input-dark text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-400">Retorno FIIs (% a.a.)</label>
              <input
                type="number"
                step="0.5"
                value={input.fiisAnnualReturn}
                onChange={(e) =>
                  setInput({ ...input, fiisAnnualReturn: Number(e.target.value) })
                }
                className="input-dark text-xs"
              />
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-800 pt-3 text-xs">
            <label className="flex items-center justify-between text-slate-300">
              <span>Descontar Imposto de Renda (IR Regressivo)</span>
              <input
                type="checkbox"
                checked={input.applyIncomeTax}
                onChange={(e) => setInput({ ...input, applyIncomeTax: e.target.checked })}
                className="rounded border-slate-600 bg-slate-900 text-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between text-slate-300">
              <span>Exibir Poder de Compra Real (Hoje)</span>
              <input
                type="checkbox"
                checked={viewRealPower}
                onChange={(e) => setViewRealPower(e.target.checked)}
                className="rounded border-slate-600 bg-slate-900 text-emerald-500"
              />
            </label>

            <div>
              <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                <span>Simular Resgate Curto Prazo (checar IOF &lt; 30d)</span>
                <span>{input.shortTermDaysForIofCheck ?? 365} dias</span>
              </div>
              <input
                type="range"
                min={1}
                max={60}
                value={Math.min(60, input.shortTermDaysForIofCheck ?? 60)}
                onChange={(e) =>
                  setInput({ ...input, shortTermDaysForIofCheck: Number(e.target.value) })
                }
                className="w-full accent-amber-500"
              />
              {output.iofWarningRate > 0 && (
                <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <span>
                    Resgate em {input.shortTermDaysForIofCheck} dias sofre{' '}
                    <strong>{(output.iofWarningRate * 100).toFixed(0)}% de IOF</strong> + 22,5% de IR sobre o lucro!
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
            💡 <strong>Equivalência LCI vs CDB:</strong> Neste prazo (IR{' '}
            {formatPercent(output.irRateApplied * 100, 1)}), uma LCI de{' '}
            <strong>{input.lciPctCdi}% CDI isenta</strong> equivale a um CDB tributado de{' '}
            <strong className="text-emerald-400">
              {formatPercent(output.equivalentCdbForLciPct, 1)} do CDI
            </strong>
            .
          </div>
        </div>

        {/* Chart & Cards */}
        <div className="space-y-6 lg:col-span-8">
          <div className="glass-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-white">
                  Projeção Patrimonial —{' '}
                  {viewRealPower ? 'Poder de Compra Real (Descontado IPCA)' : 'Valor Nominal Líquido'}
                </h3>
                <p className="text-xs text-slate-400">
                  Comparativo ano a ano líquido de imposto de renda
                </p>
              </div>
              <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setViewRealPower(false)}
                  className={`rounded-lg px-3 py-1 font-medium transition ${
                    !viewRealPower ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Valor Nominal
                </button>
                <button
                  type="button"
                  onClick={() => setViewRealPower(true)}
                  className={`rounded-lg px-3 py-1 font-medium transition ${
                    viewRealPower ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Poder de Compra Real
                </button>
              </div>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={12}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  />
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
                  <Area
                    type="monotone"
                    dataKey="Total Aportado"
                    stroke="#64748b"
                    fill="#334155"
                    fillOpacity={0.25}
                  />
                  <Area
                    type="monotone"
                    dataKey={`CDB ${input.cdbPctCdi}% CDI`}
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.12}
                  />
                  <Area
                    type="monotone"
                    dataKey={`LCI ${input.lciPctCdi}% CDI (Isenta)`}
                    stroke="#06b6d4"
                    fill="#06b6d4"
                    fillOpacity={0.12}
                  />
                  <Area
                    type="monotone"
                    dataKey="Tesouro IPCA+"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.15}
                  />
                  <Area
                    type="monotone"
                    dataKey="Carteira Mista (FIIs+Selic+Ações)"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.22}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {output.summaries.map((item) => (
              <div key={item.id} className="glass-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-white">{item.name}</h4>
                    <p className="text-[11px] text-slate-400">{item.subtitle}</p>
                  </div>
                  <span className="rounded-lg bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                    +{formatPercent(item.nominalReturnPct, 1)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400">Líquido Nominal</div>
                    <div className="text-sm font-extrabold text-white">
                      {formatBRL(item.netNominalValue)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Poder de Compra (Hoje)</div>
                    <div className="text-sm font-extrabold text-emerald-400">
                      {formatBRL(item.netRealValue)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">IR Pago no Resgate</div>
                    <div className="text-xs font-semibold text-rose-400">
                      -{formatBRL(item.taxPaid)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Renda Passiva Est. (0,5%/mês)</div>
                    <div className="text-xs font-semibold text-cyan-300">
                      {formatBRL(item.estimatedMonthlyRealIncome)}/mês
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
