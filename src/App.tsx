import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addPayslip,
  addTransactions,
  applyPluggySyncToDatabase,
  clearAllFinancialData,
  computeFinancialSummary,
  deleteInvestment,
  deletePayslip,
  deleteTransaction,
  exportDatabaseAsJsonString,
  exportDatabaseBytes,
  getBankAccounts,
  getBudgetGoals,
  getInvestments,
  getPayslips,
  getSettings,
  getTransactions,
  hasDemoSeedData,
  importDatabaseBytes,
  initDatabase,
  removeDemoSeedData,
  resetToSeedDatabase,
  saveSettings,
  updateTransactionCategory,
  upsertBudgetGoal,
  upsertInvestment,
} from './services/database';
import {
  createDatabaseFileInFolder,
  DEFAULT_DB_FILENAME,
  DEFAULT_DRIVE_FOLDER_ID,
  downloadDatabaseFile,
  fetchDriveUserInfo,
  getDriveFolderUrl,
  loadOrInitializeDatabaseFromDrive,
  requestGoogleDriveAccessToken,
  updateDatabaseFile,
} from './services/googleDrive';
import { syncBancoDoBrasilViaPluggy } from './services/openFinancePluggy';
import { fetchLiveBcbMacroRates } from './services/bcbApi';
import {
  AppSettings,
  BankAccount,
  BudgetGoal,
  DriveSyncState,
  Investment,
  Payslip,
  PayslipItem,
  Transaction,
} from './types/finance';
import { ActiveTab, Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { IngestionView } from './components/IngestionView';
import { PortfolioView } from './components/PortfolioView';
import { SimulatorView } from './components/SimulatorView';
import { AiAdvisorView } from './components/AiAdvisorView';
import { SettingsView } from './components/SettingsView';
import { DriveSyncModal } from './components/DriveSyncModal';
import { CheckCircle2, Cloud, ExternalLink, AlertCircle, X } from 'lucide-react';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function App(): React.ReactElement {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [driveModalOpen, setDriveModalOpen] = useState(false);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [budgetGoals, setBudgetGoals] = useState<BudgetGoal[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isDemoDataPresent, setIsDemoDataPresent] = useState(false);

  // Pluggy Sync state
  const [isSyncingPluggy, setIsSyncingPluggy] = useState(false);
  const [pluggySyncLogs, setPluggySyncLogs] = useState<string[]>([]);
  const [pluggySyncError, setPluggySyncError] = useState<string | null>(null);
  const [toastBanner, setToastBanner] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  // BCB Macro state
  const [isRefreshingBcb, setIsRefreshingBcb] = useState(false);

  const [hasUnsavedLocalChanges, setHasUnsavedLocalChanges] = useState(false);
  const [driveState, setDriveState] = useState<DriveSyncState>({
    status: 'disconnected',
    folderId: DEFAULT_DRIVE_FOLDER_ID,
    fileId: null,
    fileName: DEFAULT_DB_FILENAME,
    lastSyncedAt: null,
    errorMessage: null,
    accessToken: null,
    tokenExpiresAt: null,
  });

  const syncTimerRef = useRef<number | null>(null);
  const autoPluggyTriedRef = useRef(false);

  const refreshStateFromDb = useCallback(() => {
    setBankAccounts(getBankAccounts());
    setTransactions(getTransactions());
    setPayslips(getPayslips());
    setInvestments(getInvestments());
    setBudgetGoals(getBudgetGoals());
    setIsDemoDataPresent(hasDemoSeedData());
    const nextSettings = getSettings();
    setSettings(nextSettings);
    setDriveState((prev) => ({
      ...prev,
      folderId: nextSettings.driveFolderId,
      fileName: nextSettings.driveFileName,
    }));
    return nextSettings;
  }, []);

  useEffect(() => {
    initDatabase()
      .then(() => {
        refreshStateFromDb();
        setReady(true);
      })
      .catch((err) => {
        setInitError(
          err instanceof Error
            ? err.message
            : 'Erro ao inicializar SQLite WebAssembly (sql.js).',
        );
      });
  }, [refreshStateFromDb]);

  const uploadCurrentSnapshotToDrive = useCallback(
    async (explicitState?: DriveSyncState, explicitSettings?: AppSettings) => {
      const ds = explicitState ?? driveState;
      const cfg = explicitSettings ?? settings;
      if (!ds.accessToken || !cfg) return;

      if (ds.tokenExpiresAt && Date.now() > ds.tokenExpiresAt) {
        setDriveState((prev) => ({
          ...prev,
          status: 'disconnected',
          accessToken: null,
          errorMessage:
            'Sessão OAuth expirada. Clique em Conectar Google Drive para renovar.',
        }));
        return;
      }

      setDriveState((prev) => ({ ...prev, status: 'syncing', errorMessage: null }));
      try {
        const bytes = exportDatabaseBytes();
        let updatedFileId = ds.fileId;
        if (updatedFileId) {
          await updateDatabaseFile(ds.accessToken, updatedFileId, bytes);
        } else {
          const created = await createDatabaseFileInFolder(
            ds.accessToken,
            cfg.driveFolderId,
            cfg.driveFileName,
            bytes,
          );
          updatedFileId = created.id;
        }
        setHasUnsavedLocalChanges(false);
        setDriveState((prev) => ({
          ...prev,
          status: 'connected',
          fileId: updatedFileId,
          lastSyncedAt: new Date().toISOString(),
          errorMessage: null,
        }));
      } catch (err) {
        setDriveState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage:
            err instanceof Error
              ? err.message
              : 'Falha ao sincronizar com Google Drive.',
        }));
      }
    },
    [driveState, settings],
  );

  const markDbMutated = useCallback(() => {
    refreshStateFromDb();
    setHasUnsavedLocalChanges(true);

    if (
      driveState.status === 'connected' &&
      driveState.accessToken &&
      settings?.autoSyncDrive
    ) {
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
      }
      syncTimerRef.current = window.setTimeout(() => {
        uploadCurrentSnapshotToDrive();
      }, 1500);
    }
  }, [
    refreshStateFromDb,
    driveState.status,
    driveState.accessToken,
    settings?.autoSyncDrive,
    uploadCurrentSnapshotToDrive,
  ]);

  const handleRunPluggySync = useCallback(
    async (
      overrideSettings?: Partial<AppSettings>,
      removeDemoFirst: boolean = true,
    ) => {
      const cfg = { ...(settings ?? getSettings()), ...(overrideSettings ?? {}) };
      setIsSyncingPluggy(true);
      setPluggySyncError(null);
      try {
        const res = await syncBancoDoBrasilViaPluggy({
          clientId: cfg.pluggyClientId,
          clientSecret: cfg.pluggyClientSecret,
          itemId: cfg.pluggyItemId,
        });

        const applied = await applyPluggySyncToDatabase(res, removeDemoFirst);
        const summaryLog = `✓ Gravado no SQLite: ${applied.accountsUpdated} conta(s), ${applied.transactionsInserted} nova(s) transação(ões) (${applied.transactionsSkipped} já existentes) e ${applied.investmentsUpdated} ativo(s) de investimento.`;

        setPluggySyncLogs([...res.logs, summaryLog]);
        markDbMutated();
        setToastBanner({
          type: 'ok',
          text: `Pluggy sincronizado! ${applied.accountsUpdated} conta(s), ${applied.transactionsInserted} transações e ${applied.investmentsUpdated} investimentos atualizados.`,
        });
        setTimeout(() => setToastBanner(null), 6000);
      } catch (err) {
        const errMsg =
          err instanceof Error
            ? err.message
            : 'Erro ao sincronizar dados com a Pluggy.';
        setPluggySyncError(errMsg);
        setToastBanner({
          type: 'err',
          text: errMsg,
        });
      } finally {
        setIsSyncingPluggy(false);
      }
    },
    [settings, markDbMutated],
  );

  // Auto-fetch Pluggy if credentials are saved in DB but never synced yet
  useEffect(() => {
    if (!ready || !settings || autoPluggyTriedRef.current) return;
    if (
      settings.pluggyClientId.trim() &&
      settings.pluggyClientSecret.trim() &&
      settings.pluggyItemId.trim() &&
      !settings.lastPluggySyncAt
    ) {
      autoPluggyTriedRef.current = true;
      handleRunPluggySync(settings, true);
    }
  }, [ready, settings, handleRunPluggySync]);

  const handleRefreshBcbRates = useCallback(async () => {
    if (!settings) return;
    setIsRefreshingBcb(true);
    try {
      const live = await fetchLiveBcbMacroRates({
        selic: settings.benchmarkSelic,
        cdi: settings.benchmarkCdi,
        ipca: settings.benchmarkIpca,
      });
      await saveSettings({
        benchmarkSelic: live.selic,
        benchmarkCdi: live.cdi,
        benchmarkIpca: live.ipca12m,
      });
      markDbMutated();
      setToastBanner({
        type: 'ok',
        text: `Taxas BCB atualizadas: Selic ${live.selic}% · CDI ${live.cdi}% · IPCA ${live.ipca12m}%`,
      });
      setTimeout(() => setToastBanner(null), 4000);
    } finally {
      setIsRefreshingBcb(false);
    }
  }, [settings, markDbMutated]);

  const handleConnectDrive = async () => {
    const currentCfg = getSettings();
    setDriveState((prev) => ({ ...prev, status: 'connecting', errorMessage: null }));
    try {
      const { accessToken, expiresAt } = await requestGoogleDriveAccessToken(
        currentCfg.googleClientId,
      );
      const userInfo = await fetchDriveUserInfo(accessToken);

      const syncRes = await loadOrInitializeDatabaseFromDrive({
        accessToken,
        folderId: currentCfg.driveFolderId,
        fileName: currentCfg.driveFileName,
        localSnapshot: exportDatabaseBytes(),
      });

      if (syncRes.action === 'loaded_remote' && syncRes.remoteBytes) {
        await importDatabaseBytes(syncRes.remoteBytes);
        refreshStateFromDb();
      }

      setHasUnsavedLocalChanges(false);
      setDriveState({
        status: 'connected',
        folderId: currentCfg.driveFolderId,
        fileId: syncRes.file.id,
        fileName: syncRes.file.name,
        lastSyncedAt: new Date().toISOString(),
        errorMessage: null,
        userEmail: userInfo.emailAddress,
        accessToken,
        tokenExpiresAt: expiresAt,
      });
      setToastBanner({
        type: 'ok',
        text: `Conectado ao Google Drive (${syncRes.file.name} na pasta ${currentCfg.driveFolderId}).`,
      });
      setTimeout(() => setToastBanner(null), 5000);
    } catch (err) {
      setDriveState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage:
          err instanceof Error ? err.message : 'Erro ao conectar no Google Drive.',
      }));
    }
  };

  const handleDownloadRemoteNow = async () => {
    if (!driveState.accessToken || !driveState.fileId) return;
    setDriveState((prev) => ({ ...prev, status: 'syncing', errorMessage: null }));
    try {
      const bytes = await downloadDatabaseFile(
        driveState.accessToken,
        driveState.fileId,
      );
      await importDatabaseBytes(bytes);
      refreshStateFromDb();
      setHasUnsavedLocalChanges(false);
      setDriveState((prev) => ({
        ...prev,
        status: 'connected',
        lastSyncedAt: new Date().toISOString(),
      }));
    } catch (err) {
      setDriveState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage:
          err instanceof Error ? err.message : 'Erro ao baixar banco do Drive.',
      }));
    }
  };

  const handleExportLocalDb = () => {
    const bytes = exportDatabaseBytes();
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    triggerDownload(
      new Blob([copy.buffer], { type: 'application/x-sqlite3' }),
      settings?.driveFileName || DEFAULT_DB_FILENAME,
    );
  };

  const handleExportJson = () => {
    const json = exportDatabaseAsJsonString();
    triggerDownload(
      new Blob([json], { type: 'application/json;charset=utf-8' }),
      'financas_export.json',
    );
  };

  const handleImportLocalDbFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    await importDatabaseBytes(new Uint8Array(buffer));
    markDbMutated();
  };

  const summary = useMemo(
    () =>
      computeFinancialSummary(transactions, payslips, investments, bankAccounts),
    [transactions, payslips, investments, bankAccounts],
  );

  if (initError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070B14] p-6 text-center">
        <div className="glass-card max-w-md p-6 space-y-3">
          <h1 className="text-lg font-bold text-rose-400">
            Falha ao iniciar banco SQLite
          </h1>
          <p className="text-xs text-slate-300">{initError}</p>
        </div>
      </div>
    );
  }

  if (!ready || !settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070B14]">
        <div className="text-center space-y-2">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-xs text-slate-400">
            Inicializando motor SQLite WebAssembly...
          </p>
        </div>
      </div>
    );
  }

  const isPluggyConfigured = Boolean(
    settings.pluggyClientId.trim() &&
      settings.pluggyClientSecret.trim() &&
      settings.pluggyItemId.trim(),
  );

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        driveState={driveState}
        settings={settings}
        onOpenDriveModal={() => setDriveModalOpen(true)}
        onQuickSyncDrive={() => uploadCurrentSnapshotToDrive()}
        onQuickSyncPluggy={() => handleRunPluggySync(undefined, true)}
        isSyncingPluggy={isSyncingPluggy}
        onRefreshBcbRates={handleRefreshBcbRates}
        isRefreshingBcb={isRefreshingBcb}
        hasUnsavedLocalChanges={hasUnsavedLocalChanges}
      />

      {/* Global Toast Notification */}
      {toastBanner && (
        <div className="mx-auto mt-4 w-full max-w-[1440px] px-4 sm:px-6">
          <div
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs shadow-lg ${
              toastBanner.type === 'ok'
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                : 'border-rose-500/40 bg-rose-500/15 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {toastBanner.type === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              )}
              <span className="font-medium">{toastBanner.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastBanner(null)}
              className="rounded-lg p-1 hover:bg-black/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            summary={summary}
            bankAccounts={bankAccounts}
            transactions={transactions}
            payslips={payslips}
            investments={investments}
            budgetGoals={budgetGoals}
            isDemoDataPresent={isDemoDataPresent}
            isPluggyConfigured={isPluggyConfigured}
            isSyncingPluggy={isSyncingPluggy}
            lastPluggySyncAt={settings.lastPluggySyncAt}
            onSyncPluggyNow={() => handleRunPluggySync(undefined, true)}
            onRemoveDemoData={async () => {
              await removeDemoSeedData();
              markDbMutated();
            }}
            onNavigateToTab={setActiveTab}
            onUpdateTransactionCategory={async (id, cat) => {
              await updateTransactionCategory(id, cat);
              markDbMutated();
            }}
            onDeleteTransaction={async (id) => {
              await deleteTransaction(id);
              markDbMutated();
            }}
          />
        )}

        {activeTab === 'ingestion' && (
          <IngestionView
            settings={settings}
            payslips={payslips}
            isSyncingPluggy={isSyncingPluggy}
            pluggySyncLogs={pluggySyncLogs}
            pluggySyncError={pluggySyncError}
            onRunPluggyFullSync={(removeDemoFirst) =>
              handleRunPluggySync(undefined, removeDemoFirst)
            }
            onSavePluggyItemIdAndSync={async (newItemId) => {
              const updated = await saveSettings({ pluggyItemId: newItemId });
              markDbMutated();
              await handleRunPluggySync(updated, true);
            }}
            onImportTransactions={async (items) => {
              const res = await addTransactions(items);
              if (res.inserted > 0) markDbMutated();
              return res;
            }}
            onAddPayslip={async (
              payslip: Omit<Payslip, 'id' | 'createdAt' | 'items'>,
              items: Omit<PayslipItem, 'id' | 'payslipId'>[],
              alsoCreateTx: boolean,
            ) => {
              const created = await addPayslip(payslip, items, alsoCreateTx);
              markDbMutated();
              return created;
            }}
            onDeletePayslip={async (id) => {
              await deletePayslip(id);
              markDbMutated();
            }}
            onGoToSettings={() => setActiveTab('settings')}
          />
        )}

        {activeTab === 'portfolio' && (
          <PortfolioView
            investments={investments}
            onUpsertInvestment={async (inv) => {
              await upsertInvestment(inv);
              markDbMutated();
            }}
            onDeleteInvestment={async (id) => {
              await deleteInvestment(id);
              markDbMutated();
            }}
          />
        )}

        {activeTab === 'simulator' && (
          <SimulatorView settings={settings} summary={summary} />
        )}

        {activeTab === 'ai' && (
          <AiAdvisorView
            settings={settings}
            summary={summary}
            transactions={transactions}
            payslips={payslips}
            investments={investments}
            budgetGoals={budgetGoals}
            onGoToSettings={() => setActiveTab('settings')}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            budgetGoals={budgetGoals}
            isSyncingPluggy={isSyncingPluggy}
            pluggySyncLogs={pluggySyncLogs}
            pluggySyncError={pluggySyncError}
            onSaveSettings={async (next) => {
              await saveSettings(next);
              markDbMutated();
            }}
            onSaveAndSyncPluggy={async (nextSettings, removeDemoFirst) => {
              const merged = await saveSettings(nextSettings);
              markDbMutated();
              await handleRunPluggySync(merged, removeDemoFirst);
            }}
            onConnectDriveNow={handleConnectDrive}
            onRefreshBcbRates={handleRefreshBcbRates}
            onUpsertBudgetGoal={async (category, limit) => {
              await upsertBudgetGoal(category, limit);
              markDbMutated();
            }}
            onExportDb={handleExportLocalDb}
            onExportJson={handleExportJson}
            onRemoveDemoData={async () => {
              await removeDemoSeedData();
              markDbMutated();
            }}
            onResetSeed={async () => {
              await resetToSeedDatabase();
              markDbMutated();
            }}
            onClearData={async () => {
              await clearAllFinancialData();
              markDbMutated();
            }}
          />
        )}
      </main>

      <footer className="border-t border-slate-900 bg-[#070B14] py-4 px-4 text-xs text-slate-500">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-2 sm:flex-row">
          <div className="flex items-center gap-2">
            <Cloud className="h-3.5 w-3.5 text-emerald-500" />
            <span>
              Banco SQLite WebAssembly sincronizado com Google Drive Pasta{' '}
              <code className="text-slate-300">{settings.driveFolderId}</code>
            </span>
          </div>
          <a
            href={getDriveFolderUrl(settings.driveFolderId)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-emerald-400 hover:underline"
          >
            Abrir Pasta no Google Drive <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </footer>

      <DriveSyncModal
        isOpen={driveModalOpen}
        onClose={() => setDriveModalOpen(false)}
        driveState={driveState}
        settings={settings}
        onConnectDrive={handleConnectDrive}
        onUploadNow={() => uploadCurrentSnapshotToDrive()}
        onDownloadRemoteNow={handleDownloadRemoteNow}
        onExportLocalDb={handleExportLocalDb}
        onImportLocalDbFile={handleImportLocalDbFile}
        onGoToSettings={() => setActiveTab('settings')}
      />
    </div>
  );
}

export default App;
