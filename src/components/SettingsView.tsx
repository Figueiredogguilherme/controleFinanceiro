import React, { useEffect, useState } from 'react';
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
  Link2,
  Sparkles,
  Copy,
  Check,
  AlertCircle,
  BookOpen,
  FileText,
} from 'lucide-react';
import { AppSettings, BudgetGoal } from '../types/finance';
import { DEFAULT_DRIVE_FOLDER_ID, getDriveFolderUrl } from '../services/googleDrive';
import { formatBRL } from '../services/financialEngine';
import { testAiProviderConnection } from '../services/aiAssistant';
import { openPluggyConnectWidget } from '../services/openFinancePluggy';

interface SettingsViewProps {
  settings: AppSettings;
  budgetGoals: BudgetGoal[];
  isSyncingPluggy: boolean;
  pluggySyncLogs: string[];
  pluggySyncError: string | null;
  onSaveSettings: (next: Partial<AppSettings>) => Promise<void>;
  onSaveAndSyncPluggy: (
    nextSettings: Partial<AppSettings>,
    removeDemoFirst: boolean,
  ) => Promise<void>;
  onConnectDriveNow: () => Promise<void>;
  onRefreshBcbRates: () => Promise<void>;
  onUpsertBudgetGoal: (category: string, limit: number) => Promise<void>;
  onExportDb: () => void;
  onExportJson: () => void;
  onRemoveDemoData: () => Promise<void>;
  onResetSeed: () => Promise<void>;
  onClearData: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  budgetGoals,
  isSyncingPluggy,
  pluggySyncLogs,
  pluggySyncError,
  onSaveSettings,
  onSaveAndSyncPluggy,
  onConnectDriveNow,
  onRefreshBcbRates,
  onUpsertBudgetGoal,
  onExportDb,
  onExportJson,
  onRemoveDemoData,
  onResetSeed,
  onClearData,
}) => {
  const [form, setForm] = useState<AppSettings>(settings);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [cleanDemoOnPluggy, setCleanDemoOnPluggy] = useState(true);
  const [copiedOrigin, setCopiedOrigin] = useState(false);

  // AI Test state
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{
    ok: boolean;
    provider: string;
    message: string;
  } | null>(null);

  // Pluggy Widget state
  const [openingWidget, setOpeningWidget] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://figueiredogguilherme.github.io';

  const handleSaveAll = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const autoProvider =
      form.llmProvider === 'local_only' && form.geminiApiKey.trim()
        ? 'gemini'
        : form.llmProvider === 'local_only' && form.openaiApiKey.trim()
          ? 'openai'
          : form.llmProvider;

    const updated = { ...form, llmProvider: autoProvider };
    setForm(updated);
    await onSaveSettings(updated);
    setSavedBanner('Configurações gravadas com segurança no SQLite!');
    setTimeout(() => setSavedBanner(null), 4000);
  };

  const handleSaveAndTestAi = async () => {
    setTestingAi(true);
    setAiTestResult(null);
    try {
      const nextProvider =
        form.llmProvider === 'local_only' && form.geminiApiKey.trim()
          ? 'gemini'
          : form.llmProvider === 'local_only' && form.openaiApiKey.trim()
            ? 'openai'
            : form.llmProvider;

      const updated: AppSettings = { ...form, llmProvider: nextProvider };
      setForm(updated);
      await onSaveSettings(updated);

      const res = await testAiProviderConnection(updated);
      setAiTestResult({
        ok: res.ok,
        provider: res.providerUsed,
        message: res.sampleReply,
      });
    } catch (err) {
      setAiTestResult({
        ok: false,
        provider: 'Erro na Conexão IA',
        message:
          err instanceof Error
            ? err.message
            : 'Falha ao validar chave de API. Verifique se a chave está correta.',
      });
    } finally {
      setTestingAi(false);
    }
  };

  const handleSaveAndFetchPluggy = async () => {
    await onSaveAndSyncPluggy(form, cleanDemoOnPluggy);
    setSavedBanner('Credenciais Pluggy salvas e sincronização executada!');
    setTimeout(() => setSavedBanner(null), 4000);
  };

  const handleOpenPluggyWidgetFromSettings = async () => {
    setOpeningWidget(true);
    try {
      await onSaveSettings(form);
      await openPluggyConnectWidget({
        clientId: form.pluggyClientId,
        clientSecret: form.pluggyClientSecret,
        existingItemId: form.pluggyItemId,
        onItemConnected: async (newItemId) => {
          const next = { ...form, pluggyItemId: newItemId };
          setForm(next);
          await onSaveAndSyncPluggy(next, cleanDemoOnPluggy);
        },
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao abrir Widget Pluggy Connect');
    } finally {
      setOpeningWidget(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Sticky Action Bar */}
      <div className="glass-card border-emerald-500/30 p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-emerald-400" />
            <h2 className="text-xl font-extrabold text-white">
              Central de Conexões &amp; Guias Passo a Passo
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-300">
            Configure e teste cada integração abaixo. Suas chaves ficam salvas{' '}
            <strong>exclusivamente no seu banco SQLite</strong> sincronizado na sua pasta privada do Google Drive (nunca vão para o GitHub).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {savedBanner && (
            <span className="badge-emerald py-1.5 px-3">
              <CheckCircle2 className="h-4 w-4" />
              {savedBanner}
            </span>
          )}
          <button type="button" onClick={() => handleSaveAll()} className="btn-primary">
            <Save className="h-4 w-4" />
            <span>Salvar Todas as Configurações</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: PLUGGY OPEN FINANCE (BANCO DO BRASIL) */}
      <div className="glass-card border-cyan-500/30 p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Step-by-step Guide */}
          <div className="space-y-4 lg:col-span-5 border-b border-slate-800 pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 font-bold">
                1
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Guia: Como Conectar o Banco do Brasil (Pluggy)
                </h3>
                <p className="text-xs text-cyan-300">
                  Sincroniza Contas, Cartão Ourocard e Investimentos
                </p>
              </div>
            </div>

            <ol className="space-y-2.5 text-xs text-slate-300 list-decimal list-inside leading-relaxed">
              <li>
                Acesse o painel da{' '}
                <a
                  href="https://dashboard.pluggy.ai"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-cyan-400 underline hover:text-cyan-300 inline-flex items-center gap-1"
                >
                  Pluggy Dashboard <ExternalLink className="h-3 w-3" />
                </a>{' '}
                e copie o <strong>Client ID</strong> e o <strong>Client Secret</strong> da sua aplicação.
              </li>
              <li>
                Cole o <strong>Client ID</strong> e o <strong>Client Secret</strong> nos campos ao lado.
              </li>
              <li>
                <strong>Como informar sua conexão (Item ID):</strong>
                <ul className="mt-1 ml-4 space-y-1 list-disc text-slate-400">
                  <li>
                    <strong>Se já conectou o banco na Pluggy:</strong> copie o UUID da conexão (Item ID, formato <code className="text-slate-200">xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</code>) e cole no campo <strong>Pluggy BB Item ID</strong>.
                  </li>
                  <li>
                    <strong>Ou conecte direto por aqui:</strong> preencha apenas Client ID + Secret e clique em <strong>&ldquo;Abrir Widget Pluggy Connect&rdquo;</strong> para autorizar o Banco do Brasil e preencher o Item ID sozinho!
                  </li>
                </ul>
              </li>
              <li>
                Clique em <strong>&ldquo;Salvar &amp; Buscar Dados da Pluggy Agora&rdquo;</strong> para importar imediatamente suas contas, transações e investimentos para o Dashboard!
              </li>
            </ol>
          </div>

          {/* Right: Inputs & Test/Sync Action */}
          <div className="space-y-4 lg:col-span-7">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Link2 className="h-4 w-4" /> Credenciais Open Finance (Pluggy API)
              </span>
              {settings.lastPluggySyncAt && (
                <span className="text-[11px] text-emerald-400">
                  Última busca: {new Date(settings.lastPluggySyncAt).toLocaleString('pt-BR')}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-medium text-slate-300">
                  Pluggy Client ID
                </label>
                <input
                  type="text"
                  value={form.pluggyClientId}
                  onChange={(e) => setForm({ ...form, pluggyClientId: e.target.value })}
                  placeholder="Ex: 4a8b9c10-..."
                  className="input-dark font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-300">
                  Pluggy Client Secret
                </label>
                <input
                  type="password"
                  value={form.pluggyClientSecret}
                  onChange={(e) => setForm({ ...form, pluggyClientSecret: e.target.value })}
                  placeholder="••••••••••••"
                  className="input-dark font-mono text-xs"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="mb-1 block font-medium text-slate-300">
                Pluggy BB Item ID (UUID da conexão ou vários separados por vírgula)
              </label>
              <input
                type="text"
                value={form.pluggyItemId}
                onChange={(e) => setForm({ ...form, pluggyItemId: e.target.value })}
                placeholder="Ex: d290f1ee-6c54-4b01-90e6-d701748f0851"
                className="input-dark font-mono text-xs"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={cleanDemoOnPluggy}
                onChange={(e) => setCleanDemoOnPluggy(e.target.checked)}
                className="rounded border-slate-600 bg-slate-900 text-emerald-500"
              />
              <span>
                Remover automaticamente os dados fictícios de demonstração ao importar meus dados reais da Pluggy
              </span>
            </label>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleSaveAndFetchPluggy}
                disabled={isSyncingPluggy}
                className="btn-primary text-xs"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncingPluggy ? 'animate-spin' : ''}`} />
                <span>
                  {isSyncingPluggy
                    ? 'Autenticando e Buscando na Pluggy...'
                    : 'Salvar & Buscar Dados da Pluggy Agora'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleOpenPluggyWidgetFromSettings}
                disabled={
                  openingWidget ||
                  !form.pluggyClientId.trim() ||
                  !form.pluggyClientSecret.trim()
                }
                className="btn-secondary text-xs"
              >
                <ExternalLink className="h-4 w-4 text-cyan-400" />
                <span>
                  {openingWidget
                    ? 'Abrindo Widget...'
                    : 'Abrir Widget Pluggy Connect (Conectar Banco)'}
                </span>
              </button>
            </div>

            {pluggySyncError && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <div>
                  <strong className="text-rose-300">Erro ao sincronizar Pluggy: </strong>
                  {pluggySyncError}
                </div>
              </div>
            )}

            {pluggySyncLogs.length > 0 && (
              <div className="rounded-xl border border-emerald-500/30 bg-[#070B14] p-3 text-xs space-y-1">
                <div className="font-bold text-emerald-400">
                  Resultado da Sincronização Pluggy:
                </div>
                {pluggySyncLogs.map((l, idx) => (
                  <div key={idx} className="font-mono text-slate-300">
                    {l}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: AI ASSISTANT CONNECTION GUIDE (GEMINI & OPENAI) */}
      <div className="glass-card border-purple-500/30 p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Step-by-step AI Guide */}
          <div className="space-y-4 lg:col-span-5 border-b border-slate-800 pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300 font-bold">
                2
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Guia: Como Conectar uma IA (Google Gemini Gratuita)
                </h3>
                <p className="text-xs text-purple-300">
                  Ative o Consultor Financeiro Inteligente em 30 segundos
                </p>
              </div>
            </div>

            <ol className="space-y-2.5 text-xs text-slate-300 list-decimal list-inside leading-relaxed">
              <li>
                Abra o{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-purple-300 underline hover:text-purple-200 inline-flex items-center gap-1"
                >
                  Google AI Studio (aistudio.google.com/apikey) <ExternalLink className="h-3 w-3" />
                </a>{' '}
                e faça login com sua conta Google.
              </li>
              <li>
                Clique no botão <strong>&ldquo;Create API key&rdquo;</strong> (Criar chave de API). O plano gratuito do Google Gemini não exige cartão de crédito.
              </li>
              <li>
                Copie a chave gerada (ela começa com <code className="text-slate-100">AIzaSy...</code>) e cole no campo <strong>Google Gemini API Key</strong> ao lado.
              </li>
              <li>
                Clique em <strong>&ldquo;Salvar &amp; Testar Chave de IA Agora&rdquo;</strong> abaixo para validar a conexão na hora!
              </li>
            </ol>

            <div className="rounded-xl border border-slate-800 bg-[#070B14] p-3 text-[11px] text-slate-400">
              💡 <strong>Prefere OpenAI (ChatGPT)?</strong> Basta gerar uma chave em{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 underline"
              >
                platform.openai.com/api-keys
              </a>
              , mudar o seletor ao lado para <strong>OpenAI API</strong> e colar sua chave <code className="text-slate-200">sk-...</code>.
            </div>
          </div>

          {/* Right: AI Form & Live Test */}
          <div className="space-y-4 lg:col-span-7">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                <KeyRound className="h-4 w-4" /> Configuração do Motor de IA (LLM)
              </span>
              <span className="badge-emerald text-[10px]">
                Auto-descoberta de modelo ativa
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-medium text-slate-300">
                  Provedor de Inteligência Artificial
                </label>
                <select
                  value={form.llmProvider}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      llmProvider: e.target.value as AppSettings['llmProvider'],
                    })
                  }
                  className="input-dark text-xs"
                >
                  <option value="gemini">Google Gemini API (Recomendado · Gratuito)</option>
                  <option value="openai">OpenAI API (GPT-4o / Mini)</option>
                  <option value="local_only">Apenas Motor Analítico Local (Sem API)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-300">
                  Modelo Google Gemini Preferido
                </label>
                <select
                  value={form.geminiModel}
                  onChange={(e) => setForm({ ...form, geminiModel: e.target.value })}
                  className="input-dark text-xs font-mono"
                >
                  <option value="gemini-3.8-flash">gemini-3.8-flash (Padrão Rápido)</option>
                  <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Ultra-leve)</option>
                  <option value="gemini-4-argon">gemini-4-argon (Máxima Inteligência)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-medium text-slate-300">
                  Google Gemini API Key
                </label>
                <input
                  type="password"
                  value={form.geminiApiKey}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      geminiApiKey: e.target.value,
                      llmProvider: e.target.value.trim() ? 'gemini' : form.llmProvider,
                    })
                  }
                  placeholder="AIzaSy..."
                  className="input-dark font-mono text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-300">
                  OpenAI API Key (Opcional)
                </label>
                <input
                  type="password"
                  value={form.openaiApiKey}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      openaiApiKey: e.target.value,
                      llmProvider:
                        !form.geminiApiKey.trim() && e.target.value.trim()
                          ? 'openai'
                          : form.llmProvider,
                    })
                  }
                  placeholder="sk-..."
                  className="input-dark font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleSaveAndTestAi}
                disabled={testingAi}
                className="btn-primary text-xs"
              >
                <Sparkles className={`h-4 w-4 ${testingAi ? 'animate-spin' : ''}`} />
                <span>
                  {testingAi
                    ? 'Testando Comunicação com a IA...'
                    : 'Salvar & Testar Chave de IA Agora'}
                </span>
              </button>
            </div>

            {aiTestResult && (
              <div
                className={`rounded-xl border p-3.5 text-xs ${
                  aiTestResult.ok
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  {aiTestResult.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-rose-400" />
                  )}
                  <span>{aiTestResult.provider}</span>
                </div>
                <p className="mt-1 leading-relaxed">{aiTestResult.message}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: GOOGLE DRIVE CLOUD PERSISTENCE */}
      <div className="glass-card border-emerald-500/30 p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Google Drive Step-by-step Guide */}
          <div className="space-y-4 lg:col-span-5 border-b border-slate-800 pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 font-bold">
                3
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Guia: Banco SQLite no Google Drive
                </h3>
                <p className="text-xs text-emerald-300">
                  Sincronização exclusiva na pasta 1AL3UC1Jv5-cUbQv6et1vY0AoH712jMg4
                </p>
              </div>
            </div>

            <ol className="space-y-2.5 text-xs text-slate-300 list-decimal list-inside leading-relaxed">
              <li>
                No{' '}
                <a
                  href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-emerald-400 underline inline-flex items-center gap-1"
                >
                  Google Cloud Console <ExternalLink className="h-3 w-3" />
                </a>
                , ative a <strong>Google Drive API</strong>.
              </li>
              <li>
                Em <strong>Tela de permissão OAuth → Público-alvo</strong>, adicione seu próprio e-mail em <strong>Usuários de teste (Test users)</strong>.
              </li>
              <li>
                Em <strong>Credenciais → Criar ID do cliente OAuth (Aplicativo da Web)</strong>, adicione em <strong>Origens JavaScript autorizadas</strong> exatamente esta URL:
                <div className="mt-1.5 flex items-center justify-between rounded-lg border border-slate-700 bg-[#070B14] px-2.5 py-1.5 font-mono text-[11px] text-emerald-300">
                  <span className="truncate">{currentOrigin}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(currentOrigin);
                      setCopiedOrigin(true);
                      setTimeout(() => setCopiedOrigin(false), 2000);
                    }}
                    className="ml-2 inline-flex items-center gap-1 text-slate-300 hover:text-white"
                  >
                    {copiedOrigin ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>{copiedOrigin ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </li>
              <li>
                Cole o <strong>Client ID</strong> gerado ao lado, salve e clique em <strong>&ldquo;Conectar Google Drive Agora&rdquo;</strong>.
              </li>
            </ol>
          </div>

          {/* Right: Drive Form */}
          <div className="space-y-4 lg:col-span-7">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Cloud className="h-4 w-4" /> Persistência na Pasta Específica do Drive
              </span>
              <a
                href={getDriveFolderUrl(form.driveFolderId)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:underline"
              >
                Abrir Pasta no Drive <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="text-xs">
              <label className="mb-1 block font-medium text-slate-300">
                Google OAuth 2.0 Client ID (Aplicativo da Web)
              </label>
              <input
                type="text"
                value={form.googleClientId}
                onChange={(e) => setForm({ ...form, googleClientId: e.target.value })}
                placeholder="1234567890-abcdefg.apps.googleusercontent.com"
                className="input-dark font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="font-medium text-slate-300">ID da Pasta no Google Drive</label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({ ...form, driveFolderId: DEFAULT_DRIVE_FOLDER_ID })
                    }
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
                <label className="mb-1 block font-medium text-slate-300">
                  Nome do Arquivo SQLite
                </label>
                <input
                  type="text"
                  value={form.driveFileName}
                  onChange={(e) => setForm({ ...form, driveFileName: e.target.value })}
                  className="input-dark font-mono text-xs"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.autoSyncDrive}
                onChange={(e) => setForm({ ...form, autoSyncDrive: e.target.checked })}
                className="rounded border-slate-600 bg-slate-900 text-emerald-500"
              />
              <span>
                Auto-salvar alterações automaticamente no arquivo SQLite da pasta do Google Drive
              </span>
            </label>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={async () => {
                  await handleSaveAll();
                  await onConnectDriveNow();
                }}
                className="btn-primary text-xs"
              >
                <Cloud className="h-4 w-4" />
                <span>Salvar &amp; Conectar Google Drive Agora</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: MACRO PARAMETERS, BUDGET GOALS & DATABASE MAINTENANCE */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-400" />
              <h3 className="text-base font-bold text-white">
                Parâmetros Econômicos &amp; Perfil
              </h3>
            </div>
            <button
              type="button"
              onClick={onRefreshBcbRates}
              className="btn-secondary py-1.5 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />
              Buscar Taxas Atuais no BCB
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-slate-400">Nome do Titular</label>
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
                step="0.05"
                value={form.benchmarkSelic}
                onChange={(e) =>
                  setForm({ ...form, benchmarkSelic: Number(e.target.value) })
                }
                className="input-dark font-mono-num text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-400">CDI (% a.a.)</label>
              <input
                type="number"
                step="0.05"
                value={form.benchmarkCdi}
                onChange={(e) => setForm({ ...form, benchmarkCdi: Number(e.target.value) })}
                className="input-dark font-mono-num text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-400">IPCA 12m (%)</label>
              <input
                type="number"
                step="0.05"
                value={form.benchmarkIpca}
                onChange={(e) =>
                  setForm({ ...form, benchmarkIpca: Number(e.target.value) })
                }
                className="input-dark font-mono-num text-xs"
              />
            </div>
          </div>

          <div className="pt-2">
            <div className="mb-2 text-xs font-semibold text-slate-300">
              Metas Mensais de Orçamento por Categoria (clique no valor para ajustar):
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {budgetGoals.map((goal) => (
                <div
                  key={goal.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#070B14] px-3 py-2"
                >
                  <span className="text-slate-300">{goal.category}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const raw = prompt(
                        `Nova meta mensal para ${goal.category}:`,
                        String(goal.monthlyLimit),
                      );
                      if (raw !== null) {
                        const val = Number(raw);
                        if (Number.isFinite(val) && val > 0) {
                          onUpsertBudgetGoal(goal.category, val);
                        }
                      }
                    }}
                    className="font-mono-num font-bold text-emerald-400 hover:underline"
                  >
                    {formatBRL(goal.monthlyLimit)}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Database Maintenance & Backup */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">
              Gestão do Banco de Dados SQLite &amp; Backups
            </h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Exporte uma cópia física do seu arquivo <code className="text-slate-200">{form.driveFileName}</code> a qualquer momento ou remova os registros iniciais de demonstração para trabalhar apenas com seus dados reais.
          </p>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button type="button" onClick={onExportDb} className="btn-secondary text-xs">
              <Download className="h-4 w-4 text-emerald-400" />
              <span>Baixar Banco SQLite ({form.driveFileName})</span>
            </button>
            <button type="button" onClick={onExportJson} className="btn-secondary text-xs">
              <Download className="h-4 w-4 text-cyan-400" />
              <span>Exportar Relatório JSON</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                await onRemoveDemoData();
                setSavedBanner('Dados fictícios de exemplo removidos!');
                setTimeout(() => setSavedBanner(null), 3500);
              }}
              className="btn-secondary text-xs text-amber-300 hover:border-amber-500/40"
            >
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>Remover Apenas Dados de Exemplo</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                if (
                  confirm(
                    'Restaurar os dados iniciais de demonstração (BB + Mercedes-Benz + Carteira)?',
                  )
                ) {
                  await onResetSeed();
                }
              }}
              className="btn-secondary text-xs"
            >
              <RefreshCw className="h-4 w-4 text-slate-400" />
              <span>Restaurar Dados de Demonstração</span>
            </button>
          </div>

          <div className="border-t border-slate-800 pt-3">
            <button
              type="button"
              onClick={async () => {
                if (
                  confirm(
                    'Tem certeza que deseja apagar todas as contas, transações, holerites e investimentos (mantendo suas chaves de conexão)?',
                  )
                ) {
                  await onClearData();
                }
              }}
              className="btn-secondary w-full text-xs text-rose-300 hover:border-rose-500/40"
            >
              <Trash2 className="h-4 w-4 text-rose-400" />
              <span>Zerar Todos os Lançamentos Financeiros (Manter Chaves)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
