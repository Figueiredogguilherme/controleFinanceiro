import React, { useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Plus,
  Trash2,
  Link2,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  AppSettings,
  DataSource,
  Payslip,
  PayslipItem,
  Transaction,
  TransactionType,
} from '../types/finance';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  parseBancoDoBrasilCsv,
  parseBancoDoBrasilOfx,
} from '../services/parsers/ofxParser';
import {
  extractTextFromPdfFile,
  ParsedPayslipDraft,
  parseMercedesPayslipText,
} from '../services/parsers/payslipPdfParser';
import {
  generateSampleBbOfx,
  generateSampleMercedesPayslipText,
} from '../services/parsers/sampleGenerator';
import {
  openPluggyConnectWidget,
  triggerPluggyItemRefresh,
} from '../services/openFinancePluggy';
import { formatBRL } from '../services/financialEngine';

interface IngestionViewProps {
  settings: AppSettings;
  payslips: Payslip[];
  isSyncingPluggy: boolean;
  pluggySyncLogs: string[];
  pluggySyncError: string | null;
  onRunPluggyFullSync: (removeDemoFirst?: boolean) => Promise<void>;
  onSavePluggyItemIdAndSync: (newItemId: string) => Promise<void>;
  onImportTransactions: (
    items: Omit<Transaction, 'id' | 'createdAt'>[],
  ) => Promise<{ inserted: number; skippedDuplicates: number }>;
  onAddPayslip: (
    payslip: Omit<Payslip, 'id' | 'createdAt' | 'items'>,
    items: Omit<PayslipItem, 'id' | 'payslipId'>[],
    alsoCreateSalaryTx: boolean,
  ) => Promise<Payslip>;
  onDeletePayslip: (id: string) => Promise<void>;
  onGoToSettings: () => void;
}

export const IngestionView: React.FC<IngestionViewProps> = ({
  settings,
  payslips,
  isSyncingPluggy,
  pluggySyncLogs,
  pluggySyncError,
  onRunPluggyFullSync,
  onSavePluggyItemIdAndSync,
  onImportTransactions,
  onAddPayslip,
  onDeletePayslip,
  onGoToSettings,
}) => {
  const [bbDraft, setBbDraft] = useState<Omit<Transaction, 'id' | 'createdAt'>[]>([]);
  const [bbStatus, setBbStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [cleanDemoOnSync, setCleanDemoOnSync] = useState(true);
  const [widgetLoading, setWidgetLoading] = useState(false);

  const [payslipRawText, setPayslipRawText] = useState('');
  const [payslipDraft, setPayslipDraft] = useState<ParsedPayslipDraft | null>(null);
  const [createSalaryTx, setCreateSalaryTx] = useState(true);
  const [payslipStatus, setPayslipStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(
    null,
  );
  const [pdfParsing, setPdfParsing] = useState(false);
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);

  // Manual Entry
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualDesc, setManualDesc] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualType, setManualType] = useState<TransactionType>('expense');
  const [manualCat, setManualCat] = useState('Alimentação');
  const [manualStatus, setManualStatus] = useState<string | null>(null);

  const hasPluggyKeys = Boolean(
    settings.pluggyClientId.trim() && settings.pluggyClientSecret.trim(),
  );
  const hasPluggyItem = Boolean(settings.pluggyItemId.trim());

  const handleOpenPluggyWidget = async () => {
    setWidgetLoading(true);
    setBbStatus(null);
    try {
      await openPluggyConnectWidget({
        clientId: settings.pluggyClientId,
        clientSecret: settings.pluggyClientSecret,
        existingItemId: settings.pluggyItemId,
        onItemConnected: async (newItemId, institutionName) => {
          setBbStatus({
            type: 'ok',
            msg: `Conta ${institutionName ?? 'Banco do Brasil'} conectada (Item ID: ${newItemId})! Sincronizando dados...`,
          });
          await onSavePluggyItemIdAndSync(newItemId);
        },
      });
    } catch (err) {
      setBbStatus({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Erro ao abrir Widget Pluggy Connect.',
      });
    } finally {
      setWidgetLoading(false);
    }
  };

  const handleForceRefreshPluggyItem = async () => {
    setBbStatus(null);
    try {
      const status = await triggerPluggyItemRefresh({
        clientId: settings.pluggyClientId,
        clientSecret: settings.pluggyClientSecret,
        itemId: settings.pluggyItemId,
      });
      setBbStatus({
        type: 'ok',
        msg: `Atualização bancária solicitada à Pluggy (Status: ${status.status}). Clique em "Sincronizar Tudo Agora" em alguns instantes.`,
      });
    } catch (err) {
      setBbStatus({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Erro ao solicitar atualização do Item.',
      });
    }
  };

  const handleBbFileUpload = async (file: File) => {
    setBbStatus(null);
    try {
      const text = await file.text();
      const lower = file.name.toLowerCase();
      const parsed = lower.endsWith('.csv')
        ? parseBancoDoBrasilCsv(text)
        : parseBancoDoBrasilOfx(text);

      if (parsed.length === 0) {
        setBbStatus({
          type: 'err',
          msg: `Nenhuma transação encontrada em "${file.name}". Verifique se é um arquivo OFX ou CSV válido do Banco do Brasil.`,
        });
        return;
      }
      setBbDraft(parsed);
      setBbStatus({
        type: 'ok',
        msg: `${parsed.length} transações identificadas em "${file.name}". Revise abaixo ou clique em Confirmar Importação.`,
      });
    } catch (err) {
      setBbStatus({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Erro ao ler arquivo do Banco do Brasil.',
      });
    }
  };

  const handleConfirmBbImport = async () => {
    if (bbDraft.length === 0) return;
    const res = await onImportTransactions(bbDraft);
    setBbDraft([]);
    setBbStatus({
      type: 'ok',
      msg: `Importação concluída: ${res.inserted} novas transações gravadas no SQLite (${res.skippedDuplicates} duplicadas ignoradas).`,
    });
  };

  const handlePayslipPdfUpload = async (file: File) => {
    setPdfParsing(true);
    setPayslipStatus(null);
    try {
      const text = await extractTextFromPdfFile(file);
      setPayslipRawText(text);
      const draft = parseMercedesPayslipText(text, 'mercedes_holerite_pdf');
      setPayslipDraft(draft);
      setPayslipStatus({
        type: 'ok',
        msg: `PDF "${file.name}" lido localmente no navegador! Confira os valores extraídos antes de salvar.`,
      });
    } catch (err) {
      setPayslipStatus({
        type: 'err',
        msg:
          err instanceof Error
            ? `Erro ao ler PDF: ${err.message}. Você também pode colar o texto do holerite manualmente.`
            : 'Erro ao processar PDF do holerite.',
      });
    } finally {
      setPdfParsing(false);
    }
  };

  const handleParseTextPayslip = (
    textToParse: string,
    source: DataSource = 'mercedes_holerite_pdf',
  ) => {
    setPayslipStatus(null);
    if (!textToParse.trim()) {
      setPayslipStatus({
        type: 'err',
        msg: 'Cole o texto do holerite ou carregue um PDF primeiro.',
      });
      return;
    }
    const draft = parseMercedesPayslipText(textToParse, source);
    setPayslipDraft(draft);
    setPayslipStatus({
      type: 'ok',
      msg: `Holerite interpretado (${draft.items.length} rubricas identificadas). Ajuste se necessário e salve.`,
    });
  };

  const handleSavePayslipDraft = async () => {
    if (!payslipDraft) return;
    await onAddPayslip(payslipDraft.payslip, payslipDraft.items, createSalaryTx);
    setPayslipStatus({
      type: 'ok',
      msg: `Holerite ${payslipDraft.payslip.competence} (${formatBRL(payslipDraft.payslip.netSalary)} líquido) salvo no SQLite!`,
    });
    setPayslipDraft(null);
    setPayslipRawText('');
  };

  const handleSaveManualTx = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(manualAmount.replace(',', '.'));
    if (!manualDesc.trim() || !Number.isFinite(num) || num <= 0) return;
    await onImportTransactions([
      {
        date: manualDate,
        description: manualDesc.trim(),
        amount: num,
        type: manualType,
        category: manualCat,
        account: 'Banco do Brasil CC',
        source: 'manual',
      },
    ]);
    setManualDesc('');
    setManualAmount('');
    setManualStatus('Lançamento salvo no SQLite!');
    setTimeout(() => setManualStatus(null), 3000);
  };

  const mercedesBookmarkletCode = `javascript:(function(){const txt=document.body.innerText;navigator.clipboard.writeText(txt).then(()=>alert('Texto do Holerite copiado! Cole na aba Extrato BB & Holerite MB do Assistente Financeiro.')).catch(()=>prompt('Copie o texto abaixo:',txt.slice(0,2500)));})();`;

  return (
    <div className="space-y-6">
      {/* Pluggy Open Finance Dedicated Hero Card */}
      <div className="glass-card border-cyan-500/30 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-400">
              <Link2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  Sincronização Automática Open Finance (Pluggy — Banco do Brasil)
                </h2>
                {hasPluggyKeys && hasPluggyItem ? (
                  <span className="badge-emerald">Credenciais Configuradas</span>
                ) : (
                  <span className="badge-amber">Configuração Pendente</span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-300">
                Importa automaticamente <strong>Saldos de Contas Correntes</strong>,{' '}
                <strong>Faturas de Cartão Ourocard</strong>, <strong>Extrato Completo</strong> e{' '}
                <strong>Carteira de Investimentos</strong> direto para o seu banco SQLite.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {hasPluggyKeys && hasPluggyItem && (
              <button
                type="button"
                onClick={() => onRunPluggyFullSync(cleanDemoOnSync)}
                disabled={isSyncingPluggy}
                className="btn-primary"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncingPluggy ? 'animate-spin' : ''}`} />
                <span>
                  {isSyncingPluggy
                    ? 'Buscando Dados na Pluggy...'
                    : 'Sincronizar Tudo Agora (Contas + Extrato + Ativos)'}
                </span>
              </button>
            )}

            {hasPluggyKeys && (
              <button
                type="button"
                onClick={handleOpenPluggyWidget}
                disabled={widgetLoading}
                className="btn-secondary text-xs"
              >
                <ExternalLink className="h-4 w-4 text-cyan-400" />
                <span>
                  {widgetLoading
                    ? 'Abrindo Pluggy Connect...'
                    : hasPluggyItem
                      ? 'Conectar Outra Conta / Atualizar via Widget'
                      : 'Abrir Widget Pluggy Connect (Conectar BB)'}
                </span>
              </button>
            )}

            {hasPluggyKeys && hasPluggyItem && (
              <button
                type="button"
                onClick={handleForceRefreshPluggyItem}
                className="btn-secondary text-xs"
                title="Pede para a Pluggy atualizar os dados junto ao Banco do Brasil"
              >
                Forçar Refresh Bancário
              </button>
            )}

            {(!hasPluggyKeys || !hasPluggyItem) && (
              <button type="button" onClick={onGoToSettings} className="btn-primary text-xs">
                Configurar Client ID / Item ID da Pluggy
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3 text-xs">
          <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={cleanDemoOnSync}
              onChange={(e) => setCleanDemoOnSync(e.target.checked)}
              className="rounded border-slate-600 bg-slate-900 text-emerald-500"
            />
            <span>
              Substituir automaticamente os dados fictícios de demonstração ao sincronizar meus dados reais da Pluggy
            </span>
          </label>
          {settings.pluggyItemId && (
            <span className="font-mono text-[11px] text-slate-400">
              Item ID ativo: <strong className="text-cyan-300">{settings.pluggyItemId}</strong>
            </span>
          )}
        </div>

        {pluggySyncError && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <div>
              <div className="font-bold text-rose-300">Falha ao buscar dados na Pluggy:</div>
              <p className="mt-0.5">{pluggySyncError}</p>
            </div>
          </div>
        )}

        {pluggySyncLogs.length > 0 && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-[#070B14] p-4 text-xs space-y-1">
            <div className="font-bold text-emerald-400 mb-1">
              Relatório da Última Sincronização Open Finance:
            </div>
            {pluggySyncLogs.map((log, i) => (
              <div key={i} className="font-mono text-slate-300">
                {log}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* OFX/CSV & Holerite Mercedes-Benz Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Banco do Brasil File Ingestion */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  Importar Extrato BB (.OFX / .CSV)
                </h2>
                <p className="text-xs text-slate-400">
                  Categorização inteligente e deduplicação automática por FITID
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const sample = generateSampleBbOfx();
                const parsed = parseBancoDoBrasilOfx(sample);
                setBbDraft(parsed);
                setBbStatus({
                  type: 'ok',
                  msg: `OFX de exemplo do BB carregado (${parsed.length} lançamentos prontos para importar).`,
                });
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Testar OFX Exemplo
            </button>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-[#070B14]/70 p-6 text-center hover:border-emerald-500/60 hover:bg-slate-900/60 transition">
            <Upload className="mb-2 h-7 w-7 text-emerald-400" />
            <span className="text-sm font-semibold text-slate-200">
              Arraste ou selecione seu arquivo .OFX ou .CSV do Banco do Brasil
            </span>
            <span className="mt-1 text-xs text-slate-500">
              Processado 100% no seu navegador — nenhum arquivo sai do seu computador
            </span>
            <input
              type="file"
              accept=".ofx,.OFX,.csv,.CSV"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleBbFileUpload(f);
                e.target.value = '';
              }}
            />
          </label>

          {bbStatus && (
            <div
              className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${
                bbStatus.type === 'ok'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
              }`}
            >
              {bbStatus.type === 'ok' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              )}
              <span>{bbStatus.msg}</span>
            </div>
          )}

          {bbDraft.length > 0 && (
            <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-[#070B14] p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-300">
                  Pré-visualização ({bbDraft.length} lançamentos)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBbDraft([])}
                    className="rounded-lg px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBbImport}
                    className="btn-primary py-1.5 text-xs"
                  >
                    Confirmar Importação no SQLite
                  </button>
                </div>
              </div>
              <div className="max-h-52 overflow-y-auto space-y-1.5 text-xs">
                {bbDraft.map((tx, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-1.5"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="mr-2 font-mono text-[11px] text-slate-400">{tx.date}</span>
                      <span className="text-slate-200">{tx.description}</span>
                      <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                        {tx.category}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 font-mono-num font-semibold ${
                        tx.type === 'income'
                          ? 'text-emerald-400'
                          : tx.type === 'investment'
                            ? 'text-cyan-400'
                            : 'text-rose-400'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatBRL(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Holerite Mercedes-Benz Ingestion */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  Holerite Corporativo Mercedes-Benz
                </h2>
                <p className="text-xs text-slate-400">
                  Parser PDF client-side (pdf.js) + Bookmarklet para Portal RH
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const sample = generateSampleMercedesPayslipText();
                setPayslipRawText(sample);
                handleParseTextPayslip(sample, 'mercedes_holerite_pdf');
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              Testar Holerite Exemplo
            </button>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-[#070B14]/70 p-5 text-center hover:border-cyan-500/60 hover:bg-slate-900/60 transition">
            <Upload className="mb-2 h-6 w-6 text-cyan-400" />
            <span className="text-sm font-semibold text-slate-200">
              {pdfParsing
                ? 'Extraindo texto e rubricas do PDF...'
                : 'Selecione o PDF do Holerite da Mercedes-Benz'}
            </span>
            <span className="mt-1 text-xs text-slate-500">
              Extrai Salário Bruto, INSS, IRRF, Previdência MBPrev, Plano Médico, FGTS e Líquido
            </span>
            <input
              type="file"
              accept=".pdf,.PDF"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePayslipPdfUpload(f);
                e.target.value = '';
              }}
            />
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">
                Ou cole o texto capturado do Portal RH / Bookmarklet:
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(mercedesBookmarkletCode);
                  setCopiedBookmarklet(true);
                  setTimeout(() => setCopiedBookmarklet(false), 2500);
                }}
                className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
              >
                {copiedBookmarklet ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>
                  {copiedBookmarklet ? 'Bookmarklet copiado!' : 'Copiar Bookmarklet RH'}
                </span>
              </button>
            </div>
            <textarea
              rows={3}
              value={payslipRawText}
              onChange={(e) => setPayslipRawText(e.target.value)}
              placeholder="Cole aqui o conteúdo do demonstrativo de pagamento..."
              className="input-dark text-xs font-mono"
            />
            <button
              type="button"
              onClick={() => handleParseTextPayslip(payslipRawText, 'mercedes_bookmarklet')}
              className="btn-secondary w-full py-2 text-xs"
            >
              Interpretar Texto do Holerite
            </button>
          </div>

          {payslipStatus && (
            <div
              className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${
                payslipStatus.type === 'ok'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
              }`}
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{payslipStatus.msg}</span>
            </div>
          )}

          {payslipDraft && (
            <div className="space-y-3 rounded-xl border border-cyan-500/30 bg-[#070B14] p-4 text-xs">
              <div className="font-semibold text-cyan-300">
                Revisão Antes de Gravar no SQLite
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <div>
                  <label className="text-[11px] text-slate-400">Competência</label>
                  <input
                    type="text"
                    value={payslipDraft.payslip.competence}
                    onChange={(e) =>
                      setPayslipDraft({
                        ...payslipDraft,
                        payslip: { ...payslipDraft.payslip, competence: e.target.value },
                      })
                    }
                    className="input-dark py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Salário Bruto</label>
                  <input
                    type="number"
                    step="0.01"
                    value={payslipDraft.payslip.grossSalary}
                    onChange={(e) =>
                      setPayslipDraft({
                        ...payslipDraft,
                        payslip: {
                          ...payslipDraft.payslip,
                          grossSalary: Number(e.target.value),
                        },
                      })
                    }
                    className="input-dark py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Líquido a Receber</label>
                  <input
                    type="number"
                    step="0.01"
                    value={payslipDraft.payslip.netSalary}
                    onChange={(e) =>
                      setPayslipDraft({
                        ...payslipDraft,
                        payslip: {
                          ...payslipDraft.payslip,
                          netSalary: Number(e.target.value),
                        },
                      })
                    }
                    className="input-dark py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">INSS</label>
                  <input
                    type="number"
                    step="0.01"
                    value={payslipDraft.payslip.inssAmount}
                    onChange={(e) =>
                      setPayslipDraft({
                        ...payslipDraft,
                        payslip: {
                          ...payslipDraft.payslip,
                          inssAmount: Number(e.target.value),
                        },
                      })
                    }
                    className="input-dark py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">IRRF</label>
                  <input
                    type="number"
                    step="0.01"
                    value={payslipDraft.payslip.irrfAmount}
                    onChange={(e) =>
                      setPayslipDraft({
                        ...payslipDraft,
                        payslip: {
                          ...payslipDraft.payslip,
                          irrfAmount: Number(e.target.value),
                        },
                      })
                    }
                    className="input-dark py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">MBPrev / Previd.</label>
                  <input
                    type="number"
                    step="0.01"
                    value={payslipDraft.payslip.privatePensionAmount}
                    onChange={(e) =>
                      setPayslipDraft({
                        ...payslipDraft,
                        payslip: {
                          ...payslipDraft.payslip,
                          privatePensionAmount: Number(e.target.value),
                        },
                      })
                    }
                    className="input-dark py-1.5 text-xs"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={createSalaryTx}
                  onChange={(e) => setCreateSalaryTx(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-900 text-emerald-500"
                />
                <span>
                  Lançar automaticamente o crédito líquido no fluxo de caixa BB caso não esteja no extrato
                </span>
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayslipDraft(null)}
                  className="btn-secondary py-1.5 text-xs"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={handleSavePayslipDraft}
                  className="btn-primary py-1.5 text-xs"
                >
                  Salvar Holerite no SQLite
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lançamento Manual + Histórico de Holerites */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleSaveManualTx}
          className="glass-card p-6 space-y-4 lg:col-span-5"
        >
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Lançamento Manual Rápido</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Data</label>
              <input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="input-dark text-xs"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Tipo</label>
              <select
                value={manualType}
                onChange={(e) => {
                  const nextType = e.target.value as TransactionType;
                  setManualType(nextType);
                  setManualCat(
                    nextType === 'income'
                      ? INCOME_CATEGORIES[0]
                      : nextType === 'investment'
                        ? 'Investimentos'
                        : 'Alimentação',
                  );
                }}
                className="input-dark text-xs"
              >
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
                <option value="investment">Aporte Investimento</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Descrição</label>
            <input
              type="text"
              value={manualDesc}
              onChange={(e) => setManualDesc(e.target.value)}
              placeholder="Ex: Supermercado ou Aporte Tesouro Selic"
              className="input-dark text-xs"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Valor (R$)</label>
              <input
                type="text"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder="250.00"
                className="input-dark text-xs"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Categoria</label>
              <select
                value={manualCat}
                onChange={(e) => setManualCat(e.target.value)}
                className="input-dark text-xs"
              >
                {(manualType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(
                  (c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>
          <button type="submit" className="btn-primary w-full text-xs">
            Adicionar Transação
          </button>
          {manualStatus && <p className="text-xs text-emerald-400">{manualStatus}</p>}
        </form>

        <div className="glass-card p-6 lg:col-span-7">
          <h3 className="mb-3 text-base font-bold text-white">
            Holerites Mercedes-Benz Armazenados
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-2 pr-3">Competência</th>
                  <th className="pb-2 pr-3 text-right">Bruto</th>
                  <th className="pb-2 pr-3 text-right">INSS + IRRF</th>
                  <th className="pb-2 pr-3 text-right">MBPrev</th>
                  <th className="pb-2 pr-3 text-right">Líquido</th>
                  <th className="pb-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {payslips.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 pr-3 font-medium text-white">
                      {p.competence}
                      <span className="block text-[10px] text-slate-500">{p.employer}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono-num text-slate-300">
                      {formatBRL(p.grossSalary)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono-num text-rose-400">
                      -{formatBRL(p.inssAmount + p.irrfAmount)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono-num text-cyan-400">
                      {formatBRL(p.privatePensionAmount)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono-num font-bold text-emerald-400">
                      {formatBRL(p.netSalary)}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onDeletePayslip(p.id)}
                        className="rounded-lg p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
