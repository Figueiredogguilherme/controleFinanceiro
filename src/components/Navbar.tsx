import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  PieChart,
  Calculator,
  Bot,
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Link2,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { AppSettings, DriveSyncState } from '../types/finance';

export type ActiveTab =
  | 'dashboard'
  | 'ingestion'
  | 'portfolio'
  | 'simulator'
  | 'ai'
  | 'settings';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  driveState: DriveSyncState;
  settings: AppSettings;
  onOpenDriveModal: () => void;
  onQuickSyncDrive: () => void;
  onQuickSyncPluggy: () => void;
  isSyncingPluggy: boolean;
  onRefreshBcbRates: () => void;
  isRefreshingBcb: boolean;
  hasUnsavedLocalChanges: boolean;
}

const NAV_ITEMS: {
  id: ActiveTab;
  label: string;
  subtitle: string;
  icon: React.FC<{ className?: string }>;
  highlight?: boolean;
}[] = [
  {
    id: 'dashboard',
    label: 'Visão Geral',
    subtitle: 'Patrimônio, Contas BB & KPIs',
    icon: LayoutDashboard,
  },
  {
    id: 'ingestion',
    label: 'Extrato BB & Holerite MB',
    subtitle: 'Open Finance Pluggy, OFX & PDF',
    icon: UploadCloud,
  },
  {
    id: 'portfolio',
    label: 'Carteira & Raio-X',
    subtitle: 'Ativos, Indexadores & Educação',
    icon: PieChart,
  },
  {
    id: 'simulator',
    label: 'Simulador de Futuro',
    subtitle: 'CDB, LCI, IPCA+, FIIs & IR',
    icon: Calculator,
  },
  {
    id: 'ai',
    label: 'Consultor IA & Glossário',
    subtitle: 'Análise PGBL, Gastos & Chat',
    icon: Bot,
  },
  {
    id: 'settings',
    label: 'Conexões & Guias',
    subtitle: 'Passo a Passo IA, Pluggy & Drive',
    icon: BookOpen,
    highlight: true,
  },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  driveState,
  settings,
  onOpenDriveModal,
  onQuickSyncDrive,
  onQuickSyncPluggy,
  isSyncingPluggy,
  onRefreshBcbRates,
  isRefreshingBcb,
  hasUnsavedLocalChanges,
}) => {
  const isPluggyConfigured = Boolean(
    settings.pluggyClientId.trim() &&
      settings.pluggyClientSecret.trim() &&
      settings.pluggyItemId.trim(),
  );

  const isAiConfigured = Boolean(
    (settings.llmProvider === 'gemini' && settings.geminiApiKey.trim()) ||
      (settings.llmProvider === 'openai' && settings.openaiApiKey.trim()) ||
      settings.geminiApiKey.trim() ||
      settings.openaiApiKey.trim(),
  );

  const renderDrivePill = () => {
    if (driveState.status === 'syncing' || driveState.status === 'connecting') {
      return (
        <button
          type="button"
          onClick={onOpenDriveModal}
          className="inline-flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300"
        >
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          <span>{driveState.status === 'connecting' ? 'Conectando...' : 'Salvando Drive...'}</span>
        </button>
      );
    }

    if (driveState.status === 'connected') {
      return (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenDriveModal}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
            title={`Sincronizado na pasta ${driveState.folderId}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Drive Ativo</span>
            {hasUnsavedLocalChanges && (
              <span
                className="ml-1 h-2 w-2 rounded-full bg-amber-400"
                title="Alterações pendentes de upload"
              />
            )}
          </button>
          <button
            type="button"
            onClick={onQuickSyncDrive}
            className="rounded-xl border border-slate-700 bg-slate-800/80 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white transition"
            title="Forçar sincronização imediata com Google Drive"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    }

    if (driveState.status === 'error') {
      return (
        <button
          type="button"
          onClick={onOpenDriveModal}
          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Erro Drive</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={onOpenDriveModal}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300 transition"
      >
        <CloudOff className="h-3.5 w-3.5 text-amber-400" />
        <span>Conectar Drive</span>
      </button>
    );
  };

  return (
    <>
      {/* Top Executive Status Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#070B14]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 shadow-lg shadow-emerald-950/60">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-white sm:text-lg">
                  Patrimônio<span className="text-emerald-400">Pro</span>
                </span>
                <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 sm:inline-flex items-center gap-1">
                  <Cloud className="h-3 w-3" /> Cloud SQLite
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Mercedes-Benz RH · Banco do Brasil Open Finance · Gestão de Patrimônio
              </p>
            </div>
          </div>

          {/* Macro Indicators Strip (Banco Central) */}
          <div className="hidden xl:flex items-center gap-2 rounded-xl border border-slate-800/90 bg-[#0D1322] px-3 py-1.5 text-xs">
            <span className="text-slate-400 font-medium">Taxas BCB:</span>
            <span className="font-mono-num text-slate-200">
              Selic <strong className="text-emerald-400">{settings.benchmarkSelic}%</strong>
            </span>
            <span className="text-slate-700">|</span>
            <span className="font-mono-num text-slate-200">
              CDI <strong className="text-cyan-400">{settings.benchmarkCdi}%</strong>
            </span>
            <span className="text-slate-700">|</span>
            <span className="font-mono-num text-slate-200">
              IPCA <strong className="text-amber-400">{settings.benchmarkIpca}%</strong>
            </span>
            <button
              type="button"
              onClick={onRefreshBcbRates}
              disabled={isRefreshingBcb}
              className="ml-1 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              title="Atualizar taxas Selic, CDI e IPCA direto do Banco Central do Brasil"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingBcb ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>

          {/* Live Integration Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Pluggy Quick Sync Button */}
            {isPluggyConfigured ? (
              <button
                type="button"
                onClick={onQuickSyncPluggy}
                disabled={isSyncingPluggy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25 transition disabled:opacity-60"
                title="Buscar Contas, Transações e Investimentos do Banco do Brasil via Pluggy agora"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${isSyncingPluggy ? 'animate-spin' : ''}`} />
                <span>{isSyncingPluggy ? 'Buscando Pluggy...' : 'Sincronizar Pluggy BB'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSelectTab('settings')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition"
                title="Configurar Open Finance Banco do Brasil (Pluggy)"
              >
                <Link2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Conectar Pluggy BB</span>
              </button>
            )}

            {/* AI Status Pill */}
            <button
              type="button"
              onClick={() => onSelectTab(isAiConfigured ? 'ai' : 'settings')}
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                isAiConfigured
                  ? 'border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
              title={
                isAiConfigured
                  ? 'Assistente IA conectado e pronto'
                  : 'Clique para ver o guia de como conectar o Google Gemini gratuitamente'
              }
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isAiConfigured ? 'IA Ativa' : 'Conectar IA'}</span>
            </button>

            {/* Google Drive Pill */}
            {renderDrivePill()}
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="border-t border-slate-800/60 bg-[#0A0F1D]/90">
          <div className="mx-auto flex max-w-[1440px] items-center gap-1.5 overflow-x-auto px-4 py-2 sm:px-6">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`group flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2 text-left transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-white border border-emerald-500/40 shadow-sm'
                      : item.highlight
                        ? 'border border-amber-500/30 bg-amber-500/5 text-amber-200 hover:bg-amber-500/15'
                        : 'border border-transparent text-slate-400 hover:bg-slate-900/90 hover:text-slate-200'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive
                        ? 'text-emerald-400'
                        : item.highlight
                          ? 'text-amber-400'
                          : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <div>
                    <div className="text-xs font-bold leading-tight">{item.label}</div>
                    <div className="hidden text-[10px] text-slate-500 md:block">{item.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </header>
    </>
  );
};
