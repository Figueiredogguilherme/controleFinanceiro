import React, { useMemo, useState } from 'react';
import {
  Info,
  Plus,
  Trash2,
  TrendingUp,
  BookOpen,
  ShieldAlert,
  X,
} from 'lucide-react';
import { AssetClass, AssetIndexer, Investment } from '../types/finance';
import { formatBRL, formatPercent } from '../services/financialEngine';
import { getAssetEducationalInsight } from '../services/aiAssistant';
import { EducationalTooltip } from './EducationalTooltip';

interface PortfolioViewProps {
  investments: Investment[];
  onUpsertInvestment: (inv: Omit<Investment, 'id' | 'updatedAt'> & { id?: string }) => Promise<void>;
  onDeleteInvestment: (id: string) => Promise<void>;
}

const INDEXER_LABELS: Record<AssetIndexer, string> = {
  CDI: 'CDI (Pós)',
  SELIC: 'Selic',
  IPCA: 'IPCA+ (Inflação)',
  PREFIXADO: 'Prefixado',
  IBOV: 'Ações B3',
  IFIX: 'FIIs',
  USD_BTC: 'Cripto / Dólar',
};

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  investments,
  onUpsertInvestment,
  onDeleteInvestment,
}) => {
  const defaultSelected =
    investments.find((i) => i.name.includes('IPCA+')) ?? investments[0] ?? null;

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(defaultSelected?.id ?? null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [formState, setFormState] = useState({
    ticker: '',
    name: '',
    assetClass: 'renda_fixa_ipca' as AssetClass,
    indexer: 'IPCA' as AssetIndexer,
    institution: 'Banco do Brasil',
    quantity: '1',
    averagePrice: '',
    currentPrice: '',
    rateDescription: 'IPCA + 6,30% a.a.',
    liquidity: 'Vencimento / D+1',
    taxRule: 'IR Regressivo (22,5% a 15%)',
  });

  const selectedAsset = useMemo(
    () => investments.find((i) => i.id === selectedAssetId) ?? investments[0] ?? null,
    [investments, selectedAssetId],
  );

  const totalCurrent = investments.reduce((acc, i) => acc + i.currentValue, 0);
  const totalInvested = investments.reduce((acc, i) => acc + i.totalInvested, 0);
  const totalGain = totalCurrent - totalInvested;

  const byIndexer = useMemo(() => {
    const map = new Map<AssetIndexer, number>();
    investments.forEach((i) => {
      map.set(i.indexer, (map.get(i.indexer) ?? 0) + i.currentValue);
    });
    return Array.from(map.entries())
      .map(([indexer, value]) => ({
        indexer,
        label: INDEXER_LABELS[indexer] ?? indexer,
        value,
        pct: totalCurrent > 0 ? (value / totalCurrent) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [investments, totalCurrent]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(formState.quantity.replace(',', '.')) || 1;
    const avg = Number(formState.averagePrice.replace(',', '.')) || 0;
    const cur = Number(formState.currentPrice.replace(',', '.')) || avg;

    if (!formState.ticker.trim() || !formState.name.trim() || cur <= 0) return;

    await onUpsertInvestment({
      ticker: formState.ticker.trim().toUpperCase(),
      name: formState.name.trim(),
      assetClass: formState.assetClass,
      indexer: formState.indexer,
      institution: formState.institution.trim() || 'Corretora',
      quantity: qty,
      averagePrice: avg || cur,
      currentPrice: cur,
      totalInvested: Number(((avg || cur) * qty).toFixed(2)),
      currentValue: Number((cur * qty).toFixed(2)),
      rateDescription: formState.rateDescription.trim(),
      liquidity: formState.liquidity.trim(),
      taxRule: formState.taxRule.trim(),
    });

    setShowAddForm(false);
    setFormState({ ...formState, ticker: '', name: '', averagePrice: '', currentPrice: '' });
  };

  return (
    <div className="space-y-6">
      {/* Header & KPIs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Carteira de Investimentos &amp; Educação Financeira</h2>
          <p className="text-xs text-slate-400">
            Clique em qualquer ativo (como o Tesouro IPCA+ 2035) para ver riscos, tributação e explicação didática
          </p>
        </div>
        <button type="button" onClick={() => setShowAddForm(true)} className="btn-primary text-xs">
          <Plus className="h-4 w-4" />
          Adicionar Ativo
        </button>
      </div>

      {/* Indexer Breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="glass-card p-5 lg:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Exposição por Indexador Econômico</h3>
            <div className="flex gap-2">
              <EducationalTooltip term="CDI" />
              <EducationalTooltip term="P/L" />
            </div>
          </div>
          <div className="space-y-2.5">
            {byIndexer.map((item) => (
              <div key={item.indexer} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-200">{item.label}</span>
                  <span className="text-slate-300">
                    {formatBRL(item.value)} ({formatPercent(item.pct, 1)})
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                    style={{ width: `${Math.min(100, item.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3 text-xs">
            <span className="text-slate-400">
              Total Aplicado: <strong className="text-slate-200">{formatBRL(totalInvested)}</strong>
            </span>
            <span className="text-slate-400">
              Saldo Atual: <strong className="text-white">{formatBRL(totalCurrent)}</strong>
            </span>
            <span className={totalGain >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
              Resultado: {formatBRL(totalGain)} (
              {totalInvested > 0 ? formatPercent((totalGain / totalInvested) * 100, 1) : '0%'})
            </span>
          </div>
        </div>

        {/* Didactic Inspector Card */}
        <div className="glass-card border-emerald-500/30 p-5 lg:col-span-5">
          {selectedAsset ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                    <BookOpen className="h-3 w-3" /> Raio-X Didático do Ativo
                  </span>
                  <h3 className="mt-1.5 text-lg font-bold text-white">{selectedAsset.name}</h3>
                  <p className="text-xs text-slate-400">
                    {selectedAsset.ticker} · {selectedAsset.institution}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-base font-extrabold text-emerald-400">
                    {formatBRL(selectedAsset.currentValue)}
                  </div>
                  <div className="text-[11px] text-slate-400">{selectedAsset.rateDescription}</div>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 text-xs leading-relaxed text-slate-200">
                <div className="mb-1 flex items-center gap-1.5 font-semibold text-emerald-300">
                  <Info className="h-4 w-4" />
                  Como funciona este investimento:
                </div>
                <p>{getAssetEducationalInsight(selectedAsset)}</p>
              </div>

              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
                  <div className="text-[10px] uppercase text-slate-500">Liquidez &amp; Resgate</div>
                  <div className="mt-0.5 font-medium text-slate-200">{selectedAsset.liquidity}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
                  <div className="text-[10px] uppercase text-slate-500">Regra Tributária (IR/FGC)</div>
                  <div className="mt-0.5 font-medium text-slate-200">{selectedAsset.taxRule}</div>
                </div>
              </div>

              {selectedAsset.assetClass === 'renda_fixa_ipca' && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <span>
                    Dica de Marcação a Mercado: leve até o vencimento ({selectedAsset.maturityDate ?? '2035'}) para garantir a taxa real contratada sem oscilações de preço.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Selecione ou cadastre um ativo para inspecionar.</p>
          )}
        </div>
      </div>

      {/* Add Investment Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <form onSubmit={handleAddSubmit} className="glass-card w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Adicionar Ativo à Carteira</h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Ticker / Código</label>
                <input
                  type="text"
                  required
                  value={formState.ticker}
                  onChange={(e) => setFormState({ ...formState, ticker: e.target.value })}
                  placeholder="Ex: IVVB11 ou CDB-BB"
                  className="input-dark text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Nome do Ativo</label>
                <input
                  type="text"
                  required
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  placeholder="Ex: Tesouro IPCA+ 2045"
                  className="input-dark text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Classe</label>
                <select
                  value={formState.assetClass}
                  onChange={(e) => setFormState({ ...formState, assetClass: e.target.value as AssetClass })}
                  className="input-dark text-xs"
                >
                  <option value="renda_fixa_pos">Renda Fixa Pós (Selic/CDI)</option>
                  <option value="renda_fixa_ipca">Renda Fixa IPCA+</option>
                  <option value="renda_fixa_pre">Renda Fixa Prefixada</option>
                  <option value="fiis">FIIs</option>
                  <option value="acoes">Ações</option>
                  <option value="previdencia">Previdência Privada</option>
                  <option value="cripto">Criptoativos</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Indexador</label>
                <select
                  value={formState.indexer}
                  onChange={(e) => setFormState({ ...formState, indexer: e.target.value as AssetIndexer })}
                  className="input-dark text-xs"
                >
                  <option value="CDI">CDI</option>
                  <option value="SELIC">SELIC</option>
                  <option value="IPCA">IPCA+</option>
                  <option value="PREFIXADO">PREFIXADO</option>
                  <option value="IFIX">IFIX (FIIs)</option>
                  <option value="IBOV">IBOV (Ações)</option>
                  <option value="USD_BTC">Cripto / USD</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Quantidade</label>
                <input
                  type="number"
                  step="any"
                  value={formState.quantity}
                  onChange={(e) => setFormState({ ...formState, quantity: e.target.value })}
                  className="input-dark text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Instituição</label>
                <input
                  type="text"
                  value={formState.institution}
                  onChange={(e) => setFormState({ ...formState, institution: e.target.value })}
                  className="input-dark text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Preço Médio Unit. (R$)</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={formState.averagePrice}
                  onChange={(e) => setFormState({ ...formState, averagePrice: e.target.value })}
                  className="input-dark text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Preço Atual Unit. (R$)</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={formState.currentPrice}
                  onChange={(e) => setFormState({ ...formState, currentPrice: e.target.value })}
                  className="input-dark text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Rentabilidade / Taxa</label>
                <input
                  type="text"
                  value={formState.rateDescription}
                  onChange={(e) => setFormState({ ...formState, rateDescription: e.target.value })}
                  className="input-dark text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Liquidez</label>
                <input
                  type="text"
                  value={formState.liquidity}
                  onChange={(e) => setFormState({ ...formState, liquidity: e.target.value })}
                  className="input-dark text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddForm(false)} className="btn-secondary text-xs">
                Cancelar
              </button>
              <button type="submit" className="btn-primary text-xs">
                Salvar Ativo no SQLite
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Portfolio Table */}
      <div className="glass-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <h3 className="text-base font-bold text-white">Posições Detalhadas (clique na linha para explicação)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-2.5 pr-3">Ativo</th>
                <th className="pb-2.5 pr-3">Instituição</th>
                <th className="pb-2.5 pr-3">Taxa / Indexador</th>
                <th className="pb-2.5 pr-3 text-right">Investido</th>
                <th className="pb-2.5 pr-3 text-right">Saldo Atual</th>
                <th className="pb-2.5 pr-3 text-right">Retorno</th>
                <th className="pb-2.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {investments.map((inv) => {
                const gain = inv.currentValue - inv.totalInvested;
                const gainPct = inv.totalInvested > 0 ? (gain / inv.totalInvested) * 100 : 0;
                const isSelected = selectedAsset?.id === inv.id;
                return (
                  <tr
                    key={inv.id}
                    onClick={() => setSelectedAssetId(inv.id)}
                    className={`cursor-pointer transition ${
                      isSelected ? 'bg-emerald-500/10' : 'hover:bg-slate-900/70'
                    }`}
                  >
                    <td className="py-3 pr-3">
                      <div className="font-bold text-white">{inv.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {inv.ticker} · Qtd: {inv.quantity}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-slate-300">{inv.institution}</td>
                    <td className="py-3 pr-3">
                      <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 text-[11px] text-cyan-300">
                        {inv.rateDescription}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-right text-slate-400">
                      {formatBRL(inv.totalInvested)}
                    </td>
                    <td className="py-3 pr-3 text-right font-bold text-white">
                      {formatBRL(inv.currentValue)}
                    </td>
                    <td
                      className={`py-3 pr-3 text-right font-semibold ${
                        gain >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatPercent(gainPct, 1)}
                    </td>
                    <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onDeleteInvestment(inv.id)}
                        className="rounded-lg p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
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
