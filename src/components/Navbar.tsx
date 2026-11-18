import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  PieChart,
  Calculator,
  Bot,
  Settings,
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import { DriveSyncState } from '../types/finance';

export type ActiveTab = 'dashboard' | 'ingestion' | 'portfolio' | 'simulator' | 'ai' | 'settings';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  driveState: DriveSyncState;
  onOpenDriveModal: () => void;
  onQuickSyncDrive: () => void;
  hasUnsavedLocalChanges: boolean;
}

const NAV_ITEMS: { id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'ingestion', label: 'Ingestão BB & RH', icon: UploadCloud },
  { id: 'portfolio', label: 'Carteira', icon: PieChart },
  { id: 'simulator', label: 'Simulador', icon: Calculator },
  { id: 'ai', label: 'Assistente IA', icon: Bot },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  driveState,
  onOpenDriveModal,
  onQuickSyncDrive,
  hasUnsavedLocalChanges,
}) => {
  const renderDrivePill = () => {
    if (driveState.status === 'syncing' || driveState.status === 'connecting') {
      return (
        <button
          type="button"
          onClick={onOpenDriveModal}
          className="inline-flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300"
        >
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          <span>{driveState.status === 'connecting' ? 'Conectando Drive...' : 'Sincronizando...'}</span>
        </button>
      );
    }

    if (driveState.status === 'connected') {
      return (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenDriveModal}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
            title={`Conectado à pasta ${driveState.folderId}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Drive Conectado</span>
            {hasUnsavedLocalChanges && (
              <span className="ml-1 h-2 w-2 rounded-full bg-amber-400" title="Alterações pendentes de upload" />
            )}
          </button>
          <button
            type="button"
            onClick={onQuickSyncDrive}
            className="rounded-xl border border-slate-700 bg-slate-800/80 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white transition"
            title="Forçar sincronização com Google Drive agora"
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
          <span>Erro no Drive</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={onOpenDriveModal}
        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition"
      >
        <CloudOff className="h-3.5 w-3.5" />
        <span>Conectar Google Drive</span>
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/90 bg-slate-950/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 shadow-lg shadow-emerald-950/50">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
                  Finanças &amp; Patrimônio
                </h1>
                <span className="hidden rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300 sm:inline-flex items-center gap-1">
                  <Cloud className="h-3 w-3 text-emerald-400" />
                  SQLite + Drive
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Mercedes-Benz Holerite · Banco do Brasil · Carteira Inteligente
              </p>
            </div>
          </div>

          <div className="lg:hidden">{renderDrivePill()}</div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition sm:text-sm ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-inner'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="hidden lg:block">{renderDrivePill()}</div>
      </div>
    </header>
  );
};
