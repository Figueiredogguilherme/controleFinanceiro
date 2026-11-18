export type TransactionType = 'income' | 'expense' | 'investment' | 'transfer';

export type DataSource =
  | 'banco_do_brasil_ofx'
  | 'banco_do_brasil_csv'
  | 'banco_do_brasil_open_finance'
  | 'mercedes_holerite_pdf'
  | 'mercedes_bookmarklet'
  | 'manual';

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // Valor positivo; o tipo define entrada ou saída
  type: TransactionType;
  category: string;
  account: string;
  source: DataSource;
  fitid?: string; // Identificador único OFX para deduplicação
  notes?: string;
  createdAt: string;
}

export interface PayslipItem {
  id: string;
  payslipId: string;
  code: string;
  description: string;
  kind: 'earning' | 'deduction' | 'info'; // Provento, Desconto, Informativo (FGTS/Base)
  reference?: string;
  amount: number;
}

export interface Payslip {
  id: string;
  competence: string; // YYYY-MM
  paymentDate: string; // YYYY-MM-DD
  employer: string; // Ex: Mercedes-Benz do Brasil Ltda.
  employeeName?: string;
  role?: string;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  inssAmount: number;
  irrfAmount: number;
  privatePensionAmount: number; // MBPrev / Previdência Privada
  healthPlanAmount: number;
  fgtsAmount: number;
  source: DataSource;
  reconciledTransactionId?: string;
  items: PayslipItem[];
  createdAt: string;
}

export type AssetClass =
  | 'renda_fixa_pos'
  | 'renda_fixa_pre'
  | 'renda_fixa_ipca'
  | 'acoes'
  | 'fiis'
  | 'cripto'
  | 'previdencia';

export type AssetIndexer = 'CDI' | 'SELIC' | 'IPCA' | 'PREFIXADO' | 'IBOV' | 'IFIX' | 'USD_BTC';

export interface Investment {
  id: string;
  ticker: string;
  name: string;
  assetClass: AssetClass;
  indexer: AssetIndexer;
  institution: string; // Banco do Brasil, Tesouro Direto, MBPrev, etc.
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  totalInvested: number;
  currentValue: number;
  rateDescription: string; // Ex: "IPCA + 6,35% a.a.", "110% do CDI"
  liquidity: string; // Ex: "Diária (D+0)", "Vencimento 15/05/2035", "D+2"
  maturityDate?: string;
  taxRule: string;
  educationalSummary?: string;
  updatedAt: string;
}

export interface BudgetGoal {
  id: string;
  category: string;
  monthlyLimit: number;
}

export interface AppSettings {
  googleClientId: string;
  driveFolderId: string;
  driveFileName: string;
  autoSyncDrive: boolean;
  llmProvider: 'gemini' | 'openai' | 'local_only';
  geminiApiKey: string;
  geminiModel: string;
  openaiApiKey: string;
  openaiModel: string;
  pluggyClientId: string;
  pluggyClientSecret: string;
  pluggyItemId: string;
  benchmarkSelic: number; // % a.a.
  benchmarkCdi: number; // % a.a.
  benchmarkIpca: number; // % a.a.
  userName: string;
}

export type DriveConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'syncing'
  | 'error';

export interface DriveSyncState {
  status: DriveConnectionStatus;
  folderId: string;
  fileId: string | null;
  fileName: string;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  userEmail?: string;
  accessToken: string | null;
  tokenExpiresAt: number | null;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  totalPortfolioValue: number;
  totalPortfolioInvested: number;
  portfolioGain: number;
  portfolioGainPct: number;
  emergencyFundMonths: number;
  liquidReserves: number;
  latestPayslip: Payslip | null;
}
