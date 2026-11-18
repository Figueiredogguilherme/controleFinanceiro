import React, { useRef } from 'react';
import {
  Cloud,
  ExternalLink,
  Upload,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Database,
  Settings,
} from 'lucide-react';
import { AppSettings, DriveSyncState } from '../types/finance';
import { getDriveFolderUrl } from '../services/googleDrive';

interface DriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  driveState: DriveSyncState;
  settings: AppSettings;
  onConnectDrive: () => Promise<void>;
  onUploadNow: () => Promise<void>;
  onDownloadRemoteNow: () => Promise<void>;
  onExportLocalDb: () => void;
  onImportLocalDbFile: (file: File) => Promise<void>;
  onGoToSettings: () => void;
}

export const DriveSyncModal: React.FC<DriveSyncModalProps> = ({
  isOpen,
  onClose,
  driveState,
  settings,
  onConnectDrive,
  onUploadNow,
  onDownloadRemoteNow,
  onExportLocalDb,
  onImportLocalDbFile,
  onGoToSettings,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const folderUrl = getDriveFolderUrl(settings.driveFolderId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="glass-card w-full max-w-xl p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Sincronização SQLite no Google Drive</h2>
              <p className="text-xs text-slate-400">
                Persistência 100% serverless diretamente na sua pasta exclusiva
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-medium text-slate-400">Pasta Alvo no Google Drive</div>
                <div className="mt-0.5 font-mono text-xs text-emerald-300">
                  ID: {settings.driveFolderId}
                </div>
                <div className="mt-0.5 text-xs text-slate-400">
                  Arquivo do banco: <span className="font-semibold text-slate-200">{settings.driveFileName}</span>
                </div>
              </div>
              <a
                href={folderUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                <span>Abrir Pasta</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            {driveState.status === 'connected' && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  Conectado{driveState.userEmail ? ` como ${driveState.userEmail}` : ''}.
                  {driveState.lastSyncedAt && (
                    <span className="ml-1 text-emerald-300/80">
                      Última sincronização: {new Date(driveState.lastSyncedAt).toLocaleString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {driveState.errorMessage && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <span>{driveState.errorMessage}</span>
              </div>
            )}
          </div>

          {!settings.googleClientId.trim() ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
              <p className="font-semibold text-amber-300">Configuração OAuth2 Pendente</p>
              <p className="mt-1 leading-relaxed">
                Para autorizar o navegador a ler e gravar <code className="text-white">{settings.driveFileName}</code> na pasta{' '}
                <code className="text-white">{settings.driveFolderId}</code>, informe seu <strong>Google OAuth Client ID</strong>{' '}
                (gerado gratuitamente no Google Cloud Console) na tela de Configurações.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onGoToSettings();
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-slate-950 hover:bg-amber-400"
              >
                <Settings className="h-3.5 w-3.5" />
                Ir para Configurações
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={onConnectDrive}
                disabled={driveState.status === 'connecting' || driveState.status === 'syncing'}
                className="btn-primary w-full"
              >
                <RefreshCw
                  className={`h-4 w-4 ${driveState.status === 'connecting' ? 'animate-spin' : ''}`}
                />
                <span>{driveState.status === 'connected' ? 'Reconectar OAuth' : 'Conectar & Carregar'}</span>
              </button>

              <button
                type="button"
                onClick={onUploadNow}
                disabled={driveState.status !== 'connected'}
                className="btn-secondary w-full"
              >
                <Upload className="h-4 w-4 text-emerald-400" />
                <span>Salvar no Drive</span>
              </button>

              <button
                type="button"
                onClick={onDownloadRemoteNow}
                disabled={driveState.status !== 'connected'}
                className="btn-secondary w-full"
              >
                <Download className="h-4 w-4 text-sky-400" />
                <span>Baixar do Drive</span>
              </button>
            </div>
          )}

          <div className="border-t border-slate-800 pt-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Database className="h-3.5 w-3.5" />
              <span>Backup Manual / Arquivo SQLite (.db)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onExportLocalDb} className="btn-secondary text-xs">
                <Download className="h-3.5 w-3.5" />
                Exportar {settings.driveFileName}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary text-xs"
              >
                <Upload className="h-3.5 w-3.5" />
                Restaurar arquivo .db local
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".db,.sqlite,.sqlite3"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    await onImportLocalDbFile(f);
                    e.target.value = '';
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
