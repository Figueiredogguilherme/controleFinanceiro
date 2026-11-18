import React, { useState } from 'react';
import {
  Save,
  Cloud,
  KeyRound,
  Database,
  RefreshCw,
  Trash2,
  Download,
  ExternalLink,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { AppSettings, BudgetGoal } from '../types/finance';
import { DEFAULT_DRIVE_FOLDER_ID, getDriveFolderUrl } from '../services/googleDrive';
import { formatBRL } from '../services/financialEngine';

interface SettingsViewProps {
  settings: AppSettings;
  budgetGoals: BudgetGoal[];
  onSaveSettings: (next: Partial<AppSettings>) => Promise<void>;
  onUpsertBudgetGoal: (category: string, limit: number) => Promise<void>;
  onExportDb: () => void;
  onExportJson: () => void;
  onResetSeed: () => Promise<void>;
  onClearData: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  budgetGoals,
  onSaveSettings,
  onUpsertBudgetGoal,
  onExportDb,
  onExportJson,
  onResetSeed,
  onClearData,
}) => {
  const [form, setForm] = useState<AppSettings>(settings);
  const [savedBanner, setSavedBanner] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings(form);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Configurações &amp; Segurança (Zero Segredos no GitHub)</h2>
          <p className="text-xs text-slate-400">
            Todas as chaves de API e tokens são gravados exclusivamente no seu SQLite local sincronizado com sua pasta do Google Drive.
          </p>
        </div>
        {savedBanner && (
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            Salvo no SQLite!
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Google Drive Config */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white">Persistência Google Drive (OAuth2)</h3>
            </div>
            <a
              href={getDriveFolderUrl(form.driveFolderId)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline"
            >
              Abrir Pasta <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="mb-1 block text-slate-400">Google OAuth 2.0 Client ID (Aplicativo Web)</label>
              <input
                type="text"
                value={form.googleClientId}
                onChange={(e) => setForm({ ...form, googleClientId: e.target.value })}
                placeholder="1234567890-abcdefg.apps.googleusercontent.com"
                className="input-dark font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-slate-400">ID da Pasta no Google Drive</label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, driveFolderId: DEFAULT_DRIVE_FOLDER_ID })}
                    className="text-[10px] text-emerald-400 hover:underline"
                  >
                    Restaurar padrão
                  </button>
                </div>
                <input
                  type="text"
                  value={form.driveFolderId}
                  onChange={(e) => setForm({ ...form, driveFolderId: e.target.value })}
                  className="input-dark font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Nome do Banco SQLite</label>
                <input
                  type="text"
                  value={form.driveFileName}
                  onChange={(e) => setForm({ ...form, driveFileName: e.target.value })}
                  className="input-dark font-mono text-xs"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 pt-1 text-slate-300">
              <input
                type="checkbox"
                checked={form.autoSyncDrive}
                onChange={(e) => setForm({ ...form, autoSyncDrive: e.target.checked })}
                className="rounded border-slate-600 bg-slate-900 text-emerald-500"
              />
              <span>Auto-sincronizar alterações no Google Drive quando conectado</span>
            </label>
          </div>
        </div>

        {/* LLM Config */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">Assistente IA (Gemini / OpenAI)</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="mb-1 block text-slate-400">Provedor do Assistente</label>
              <select
                value={form.llmProvider}
                onChange={(e) =>
                  setForm({ ...form, llmProvider: e.target.value as AppSettings['llmProvider'] })
                }
                className="input-dark text-xs"
              >
                <option value="local_only">Motor Analítico Local (Sem chave externa)</option>
                <option value="gemini">Google Gemini API (Recomendado / Plano Gratuito)</option>
                <option value="openai">OpenAI API</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-slate-400">Google Gemini API Key</label>
                <input
                  type="password"
                  value={form.geminiApiKey}
                  onChange={(e) => setForm({ ...form, geminiApiKey: e.target.value })}
                  placeholder="AIza..."
                  className="input-dark font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Modelo Gemini</label>
                <input
                  type="text"
                  value={form.geminiModel}
                  onChange={(e) => setForm({ ...form, geminiModel: e.target.value })}
                  className="input-dark font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">OpenAI API Key</label>
                <input
                  type="password"
                  value={form.openaiApiKey}
                  onChange={(e) => setForm({ ...form, openaiApiKey: e.target.value })}
                  placeholder="sk-..."
                  className="input-dark font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-slate-400">Modelo OpenAI</label>
                <input
                  type="text"
                  value={form.openaiModel}
                  onChange={(e) => setForm({ ...form, openaiModel: e.target.value })}
                  className="input-dark font-mono text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Open Finance Pluggy & Macro */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Open Finance (Pluggy BB) &amp; Parâmetros Macro</h3>
          </div>

          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-slate-400">Pluggy Client ID</label>
              <input
                type="text"
                value={form.pluggyClientId}
                onChange={(e) => setForm({ ...form, pluggyClientId: e.target.value })}
                className="input-dark font-mono text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-400">Pluggy Client Secret</label>
              <input
                type="password"
                value={form.pluggyClientSecret}
                onChange={(e) => setForm({ ...form, pluggyClientSecret: e.target.value })}
                className="input-dark font-mono text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-400">Pluggy BB Item ID</label>
              <input
                type="text"
                value={form.pluggyItemId}
                onChange={(e) => setForm({ ...form, pluggyItemId: e.target.value })}
                className="input-dark font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-slate-400">Titular</label>
              <input
                type="text"
                value={form.userName}
                onChange={(e) => setForm({ ...form, userName: e.target.value })}
                className="input-dark text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-400">Selic (% a.a.)</label>
              <input
                type="number"
                step="0.25"
                value={form.benchmarkSelic}
                onChange={(e) => setForm({ ...form, benchmarkSelic: Number(e.target.value) })}
                className="input-dark text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-400">CDI (% a.a.)</label>
              <input
                type="number"
                step="0.25"
                value={form.benchmarkCdi}
                onChange={(e) => setForm({ ...form, benchmarkCdi: Number(e.target.value) })}
                className="input-dark text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-400">IPCA (% a.a.)</label>
              <input
                type="number"
                step="0.1"
                value={form.benchmarkIpca}
                onChange={(e) => setForm({ ...form, benchmarkIpca: Number(e.target.value) })}
                className="input-dark text-xs"
              />
            </div>
          </div>

          <button type="submit" className="btn-primary w-full text-xs">
            <Save className="h-4 w-4" />
            Salvar Todas as Configurações no SQLite
          </button>
        </div>

        {/* Budget & Database Tools */}
        <div className="glass-card p-6 space-y-5">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Database className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white">Metas de Orçamento &amp; Banco SQLite</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {budgetGoals.map((goal) => (
                <div
                  key={goal.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2"
                >
                  <span className="text-slate-300">{goal.category}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const raw = prompt(`Nova meta mensal para ${goal.category}:`, String(goal.monthlyLimit));
                      if (raw !== null) {
                        const val = Number(raw);
                        if (Number.isFinite(val) && val > 0) onUpsertBudgetGoal(goal.category, val);
                      }
                    }}
                    className="font-semibold text-emerald-400 hover:underline"
                  >
                    {formatBRL(goal.monthlyLimit)}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Manutenção de Dados
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onExportDb} className="btn-secondary text-xs">
                <Download className="h-3.5 w-3.5" /> Baixar SQLite (.db)
              </button>
              <button type="button" onClick={onExportJson} className="btn-secondary text-xs">
                <Download className="h-3.5 w-3.5" /> Exportar JSON
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (confirm('Restaurar dados iniciais de demonstração (BB + Mercedes-Benz + Carteira)?')) {
                    await onResetSeed();
                  }
                }}
                className="btn-secondary text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5 text-amber-400" /> Restaurar Dados Exemplo
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (confirm('Tem certeza que deseja apagar todas as transações, holerites e ativos (mantendo as configurações)?')) {
                    await onClearData();
                  }
                }}
                className="btn-secondary text-xs text-rose-300 hover:border-rose-500/40"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-400" /> Zerar Dados Financeiros
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
