import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import {
  AppSettings,
  BudgetGoal,
  DataSource,
  FinancialSummary,
  Investment,
  Payslip,
  PayslipItem,
  Transaction,
} from '../types/finance';
import { DEFAULT_DB_FILENAME, DEFAULT_DRIVE_FOLDER_ID } from './googleDrive';

const IDB_NAME = 'controle_financeiro_sqlite_store';
const IDB_STORE = 'sqlite_blobs';
const IDB_KEY = 'financas_db_bytes';

let sqlModule: SqlJsStatic | null = null;
let dbInstance: Database | null = null;

export const DEFAULT_SETTINGS: AppSettings = {
  googleClientId: '',
  driveFolderId: DEFAULT_DRIVE_FOLDER_ID,
  driveFileName: DEFAULT_DB_FILENAME,
  autoSyncDrive: true,
  llmProvider: 'local_only',
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  pluggyClientId: '',
  pluggyClientSecret: '',
  pluggyItemId: '',
  benchmarkSelic: 11.75,
  benchmarkCdi: 11.65,
  benchmarkIpca: 4.5,
  userName: 'Guilherme',
};

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB não disponível neste ambiente.'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Erro ao abrir IndexedDB'));
  });
}

async function loadBytesFromIndexedDb(): Promise<Uint8Array | null> {
  try {
    const idb = await openIndexedDb();
    return await new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => {
        const res = req.result;
        if (res instanceof Uint8Array) {
          resolve(res);
        } else if (res instanceof ArrayBuffer) {
          resolve(new Uint8Array(res));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function saveBytesToIndexedDb(bytes: Uint8Array): Promise<void> {
  try {
    const idb = await openIndexedDb();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(bytes, IDB_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Ignora caso IndexedDB esteja bloqueado em navegação privada
  }
}

async function ensureSqlModule(): Promise<SqlJsStatic> {
  if (!sqlModule) {
    sqlModule = await initSqlJs({
      locateFile: (file: string) => `./${file}`,
    });
  }
  return sqlModule;
}

function createSchema(db: Database): void {
  db.run(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      account TEXT NOT NULL,
      source TEXT NOT NULL,
      fitid TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_fitid ON transactions(fitid);

    CREATE TABLE IF NOT EXISTS payslips (
      id TEXT PRIMARY KEY,
      competence TEXT NOT NULL,
      payment_date TEXT NOT NULL,
      employer TEXT NOT NULL,
      employee_name TEXT,
      role TEXT,
      gross_salary REAL NOT NULL,
      total_deductions REAL NOT NULL,
      net_salary REAL NOT NULL,
      inss_amount REAL NOT NULL DEFAULT 0,
      irrf_amount REAL NOT NULL DEFAULT 0,
      private_pension_amount REAL NOT NULL DEFAULT 0,
      health_plan_amount REAL NOT NULL DEFAULT 0,
      fgts_amount REAL NOT NULL DEFAULT 0,
      source TEXT NOT NULL,
      reconciled_transaction_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payslip_items (
      id TEXT PRIMARY KEY,
      payslip_id TEXT NOT NULL,
      code TEXT NOT NULL,
      description TEXT NOT NULL,
      kind TEXT NOT NULL,
      reference TEXT,
      amount REAL NOT NULL,
      FOREIGN KEY (payslip_id) REFERENCES payslips(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS investments (
      id TEXT PRIMARY KEY,
      ticker TEXT NOT NULL,
      name TEXT NOT NULL,
      asset_class TEXT NOT NULL,
      indexer TEXT NOT NULL,
      institution TEXT NOT NULL,
      quantity REAL NOT NULL,
      average_price REAL NOT NULL,
      current_price REAL NOT NULL,
      total_invested REAL NOT NULL,
      current_value REAL NOT NULL,
      rate_description TEXT NOT NULL,
      liquidity TEXT NOT NULL,
      maturity_date TEXT,
      tax_rule TEXT NOT NULL,
      educational_summary TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS budget_goals (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL UNIQUE,
      monthly_limit REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function seedInitialData(db: Database): void {
  const now = new Date().toISOString();

  // Settings
  const upsertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  (Object.entries(DEFAULT_SETTINGS) as [keyof AppSettings, string | number | boolean][]).forEach(
    ([k, v]) => {
      upsertSetting.run([k, String(v)]);
    },
  );
  upsertSetting.free();

  // Seed Payslips (Mercedes-Benz do Brasil - últimos 3 meses)
  const payslips: Omit<Payslip, 'items'>[] = [
    {
      id: 'pay-mb-2026-09',
      competence: '2026-09',
      paymentDate: '2026-09-30',
      employer: 'Mercedes-Benz do Brasil Ltda.',
      employeeName: 'Guilherme',
      role: 'Engenheiro / Analista Sênior',
      grossSalary: 14200,
      totalDeductions: 3892.4,
      netSalary: 10307.6,
      inssAmount: 908.86,
      irrfAmount: 2150.14,
      privatePensionAmount: 568.0,
      healthPlanAmount: 265.4,
      fgtsAmount: 1136.0,
      source: 'mercedes_holerite_pdf',
      reconciledTransactionId: 'tx-bb-sal-2026-09',
      createdAt: now,
    },
    {
      id: 'pay-mb-2026-10',
      competence: '2026-10',
      paymentDate: '2026-10-30',
      employer: 'Mercedes-Benz do Brasil Ltda.',
      employeeName: 'Guilherme',
      role: 'Engenheiro / Analista Sênior',
      grossSalary: 14650,
      totalDeductions: 4035.15,
      netSalary: 10614.85,
      inssAmount: 908.86,
      irrfAmount: 2274.89,
      privatePensionAmount: 586.0,
      healthPlanAmount: 265.4,
      fgtsAmount: 1172.0,
      source: 'mercedes_holerite_pdf',
      reconciledTransactionId: 'tx-bb-sal-2026-10',
      createdAt: now,
    },
    {
      id: 'pay-mb-2026-11',
      competence: '2026-11',
      paymentDate: '2026-11-05',
      employer: 'Mercedes-Benz do Brasil Ltda.',
      employeeName: 'Guilherme',
      role: 'Engenheiro / Analista Sênior',
      grossSalary: 14650,
      totalDeductions: 4035.15,
      netSalary: 10614.85,
      inssAmount: 908.86,
      irrfAmount: 2274.89,
      privatePensionAmount: 586.0,
      healthPlanAmount: 265.4,
      fgtsAmount: 1172.0,
      source: 'mercedes_holerite_pdf',
      reconciledTransactionId: 'tx-bb-sal-2026-11',
      createdAt: now,
    },
  ];

  const insertPayslip = db.prepare(`
    INSERT INTO payslips (
      id, competence, payment_date, employer, employee_name, role,
      gross_salary, total_deductions, net_salary, inss_amount, irrf_amount,
      private_pension_amount, health_plan_amount, fgts_amount, source,
      reconciled_transaction_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO payslip_items (id, payslip_id, code, description, kind, reference, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  payslips.forEach((p, idx) => {
    insertPayslip.run([
      p.id,
      p.competence,
      p.paymentDate,
      p.employer,
      p.employeeName ?? null,
      p.role ?? null,
      p.grossSalary,
      p.totalDeductions,
      p.netSalary,
      p.inssAmount,
      p.irrfAmount,
      p.privatePensionAmount,
      p.healthPlanAmount,
      p.fgtsAmount,
      p.source,
      p.reconciledTransactionId ?? null,
      p.createdAt,
    ]);

    const baseSal = idx === 0 ? 14200 : 14200;
    const extra = idx === 0 ? 0 : 450;

    const items: PayslipItem[] = [
      {
        id: `${p.id}-i1`,
        payslipId: p.id,
        code: '0010',
        description: 'Salário Nominal Mensal',
        kind: 'earning',
        reference: '220h',
        amount: baseSal,
      },
      ...(extra > 0
        ? [
            {
              id: `${p.id}-i1b`,
              payslipId: p.id,
              code: '0045',
              description: 'Adicional / Hora Extra / Produtividade',
              kind: 'earning' as const,
              reference: '6h',
              amount: extra,
            },
          ]
        : []),
      {
        id: `${p.id}-i2`,
        payslipId: p.id,
        code: '0501',
        description: 'INSS Sobre Salário',
        kind: 'deduction',
        reference: 'Teto',
        amount: p.inssAmount,
      },
      {
        id: `${p.id}-i3`,
        payslipId: p.id,
        code: '0502',
        description: 'IRRF - Imposto de Renda Retido',
        kind: 'deduction',
        reference: '27,5%',
        amount: p.irrfAmount,
      },
      {
        id: `${p.id}-i4`,
        payslipId: p.id,
        code: '0610',
        description: 'Previdência Privada MBPrev (4% c/ Contrapartida)',
        kind: 'deduction',
        reference: '4,0%',
        amount: p.privatePensionAmount,
      },
      {
        id: `${p.id}-i5`,
        payslipId: p.id,
        code: '0720',
        description: 'Assistência Médica / Odontológica Co-part.',
        kind: 'deduction',
        reference: 'Titular',
        amount: p.healthPlanAmount,
      },
      {
        id: `${p.id}-i6`,
        payslipId: p.id,
        code: '0990',
        description: 'FGTS Depositado no Mês (8%)',
        kind: 'info',
        reference: '8,0%',
        amount: p.fgtsAmount,
      },
    ];

    items.forEach((item) => {
      insertItem.run([
        item.id,
        item.payslipId,
        item.code,
        item.description,
        item.kind,
        item.reference ?? null,
        item.amount,
      ]);
    });
  });

  insertPayslip.free();
  insertItem.free();

  // Seed Transactions (Banco do Brasil Conta Corrente)
  const transactions: Transaction[] = [
    // Setembro 2026
    {
      id: 'tx-bb-sal-2026-09',
      date: '2026-09-30',
      description: 'TED CRED SALARIO MERCEDES-BENZ DO BRASIL',
      amount: 10307.6,
      type: 'income',
      category: 'Salário Mercedes-Benz',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20260930001',
      createdAt: now,
    },
    {
      id: 'tx-bb-2026-09-01',
      date: '2026-09-05',
      description: 'PAGTO BOLETO CONDOMINIO RESIDENCIAL',
      amount: 2650.0,
      type: 'expense',
      category: 'Moradia',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20260905002',
      createdAt: now,
    },
    {
      id: 'tx-bb-2026-09-02',
      date: '2026-09-12',
      description: 'COMPRA CARTAO PAO DE ACUCAR',
      amount: 1290.4,
      type: 'expense',
      category: 'Supermercado',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20260912003',
      createdAt: now,
    },
    {
      id: 'tx-bb-2026-09-03',
      date: '2026-09-18',
      description: 'APLICACAO TESOURO DIRETO / CDB BB',
      amount: 2500.0,
      type: 'investment',
      category: 'Investimentos',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20260918004',
      createdAt: now,
    },
    {
      id: 'tx-bb-2026-09-04',
      date: '2026-09-22',
      description: 'IFOOD *RESTAURANTES E DELIVERY',
      amount: 640.8,
      type: 'expense',
      category: 'Alimentação',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20260922005',
      createdAt: now,
    },
    {
      id: 'tx-bb-2026-09-05',
      date: '2026-09-25',
      description: 'POSTO SHELL COMBUSTIVEL + TAG SEM PARAR',
      amount: 580.0,
      type: 'expense',
      category: 'Transporte',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20260925006',
      createdAt: now,
    },
    // Outubro 2026
    {
      id: 'tx-bb-sal-2026-10',
      date: '2026-10-30',
      description: 'TED CRED SALARIO MERCEDES-BENZ DO BRASIL',
      amount: 10614.85,
      type: 'income',
      category: 'Salário Mercedes-Benz',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20261030001',
      createdAt: now,
    },
    {
      id: 'tx-bb-2026-10-01',
      date: '2026-10-05',
      description: 'ALUGUEL + CONDOMINIO APARTAMENTO',
      amount: 2680.0,
      type: 'expense',
      category: 'Moradia',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20261005002',
      createdAt: now,
    },
    {
      id: 'tx-bb-2026-10-02',
      date: '2026-10-10',
      description: 'ENERGIA ENEL + INTERNET VIVO FIBRA',
      amount: 395.5,
      type: 'expense',
      category: 'Moradia',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20261010003',
      createdAt: now,
    },
    {
      id: 'tx-bb-2026-10-03',
      date: '2026-10-14',
      description: 'CARREFOUR HIPERMERCADO',
      amount: 1410.2,
      type: 'expense',
      category: 'Supermercado',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20261014004',
      createdAt: now,
    },
    {
      id: 'tx-bb-2026-10-04',
      date: '2026-10-19',
      description: 'DROGASIL FARMACIA',
      amount: 245.9,
      type: 'expense',
      category: 'Saúde',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20261019005',
      createdAt: now,
    },
    {
      id: 'tx-bb-2026-10-05',
      date: '2026-10-21',
      description: 'SPOTIFY + NETFLIX + AMAZON PRIME + CLOUD',
      amount: 189.7,
      type: 'expense',
      category: 'Assinaturas',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20261021006',
      createdAt: now,
    },
    {
      id: 'tx-bb-2026-10-06',
      date: '2026-10-24',
      description: 'APORTE MENSAL CORRETORA / FIIs + TESOURO',
      amount: 3000.0,
      type: 'investment',
      category: 'Investimentos',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20261024007',
      createdAt: now,
    },
    // Novembro 2026 (mês corrente)
    {
      id: 'tx-bb-sal-2026-11',
      date: '2026-11-05',
      description: 'TED CRED SALARIO MERCEDES-BENZ DO BRASIL',
      amount: 10614.85,
      type: 'income',
      category: 'Salário Mercedes-Benz',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20261105001',
      createdAt: now,
    },
    {
      id: 'tx-bb-div-2026-11',
      date: '2026-11-14',
      description: 'RENDIMENTO PROVENTOS FII HGLG11 + MXRF11',
      amount: 342.6,
      type: 'income',
      category: 'Dividendos & Rendimentos',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20261114002',
      createdAt: now,
    },
    {
      id: 'tx-bb-2026-11-01',
      date: '2026-11-06',
      description: 'ALUGUEL + CONDOMINIO RESIDENCIAL',
      amount: 2680.0,
      type: 'expense',
      category: 'Moradia',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20261106003',
      createdAt: now,
    },
    {
      id: 'tx-bb-2026-11-02',
      date: '2026-11-08',
      description: 'SUPERMERCADO ZAFFARI / PAO DE ACUCAR',
      amount: 1185.3,
      type: 'expense',
      category: 'Supermercado',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20261108004',
      createdAt: now,
    },
    {
      id: 'tx-bb-2026-11-03',
      date: '2026-11-10',
      description: 'IFOOD *JANTAR + CAFETERIA',
      amount: 520.4,
      type: 'expense',
      category: 'Alimentação',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20261110005',
      createdAt: now,
    },
    {
      id: 'tx-bb-2026-11-04',
      date: '2026-11-11',
      description: 'POSTO IPIRANGA + UBER VIAGENS',
      amount: 495.0,
      type: 'expense',
      category: 'Transporte',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20261111006',
      createdAt: now,
    },
    {
      id: 'tx-bb-2026-11-05',
      date: '2026-11-12',
      description: 'CURSO POS-GRADUACAO / LIVROS TECNICOS',
      amount: 420.0,
      type: 'expense',
      category: 'Educação',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20261112007',
      createdAt: now,
    },
    {
      id: 'tx-bb-2026-11-06',
      date: '2026-11-15',
      description: 'CINEMA + SHOW FIM DE SEMANA',
      amount: 310.0,
      type: 'expense',
      category: 'Lazer',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20261115008',
      createdAt: now,
    },
    {
      id: 'tx-bb-2026-11-07',
      date: '2026-11-16',
      description: 'TED CORRETORA APORTE TESOURO IPCA+ 2035',
      amount: 3200.0,
      type: 'investment',
      category: 'Investimentos',
      account: 'Banco do Brasil CC',
      source: 'banco_do_brasil_ofx',
      fitid: 'BB20261116009',
      createdAt: now,
    },
  ];

  const insertTx = db.prepare(`
    INSERT INTO transactions (
      id, date, description, amount, type, category, account, source, fitid, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  transactions.forEach((t) => {
    insertTx.run([
      t.id,
      t.date,
      t.description,
      t.amount,
      t.type,
      t.category,
      t.account,
      t.source,
      t.fitid ?? null,
      t.notes ?? null,
      t.createdAt,
    ]);
  });
  insertTx.free();

  // Seed Investments
  const investments: Investment[] = [
    {
      id: 'inv-tesouro-selic',
      ticker: 'LFT 2029',
      name: 'Tesouro Selic 2029',
      assetClass: 'renda_fixa_pos',
      indexer: 'SELIC',
      institution: 'Tesouro Direto (BB)',
      quantity: 2.4,
      averagePrice: 14500.0,
      currentPrice: 15625.0,
      totalInvested: 34800.0,
      currentValue: 37500.0,
      rateDescription: 'Selic + 0,14% a.a.',
      liquidity: 'Liquidez Diária (D+1)',
      maturityDate: '2029-03-01',
      taxRule: 'IR Regressivo (22,5% a 15%) sobre o rendimento',
      educationalSummary:
        'Base da reserva de emergência. Acompanha a taxa básica de juros (Selic) com baixíssima volatilidade e liquidez diária.',
      updatedAt: now,
    },
    {
      id: 'inv-tesouro-ipca-2035',
      ticker: 'NTNB-P 2035',
      name: 'Tesouro IPCA+ 2035',
      assetClass: 'renda_fixa_ipca',
      indexer: 'IPCA',
      institution: 'Tesouro Direto (BB)',
      quantity: 11.5,
      averagePrice: 2210.0,
      currentPrice: 2420.0,
      totalInvested: 25415.0,
      currentValue: 27830.0,
      rateDescription: 'IPCA + 6,42% a.a.',
      liquidity: 'Vencimento 15/05/2035 (D+1 c/ Marcação)',
      maturityDate: '2035-05-15',
      taxRule: 'IR Regressivo (15% após 720 dias) sobre lucro nominal',
      educationalSummary:
        'Este título protege seu poder de compra da inflação (IPCA) e paga uma taxa fixa adicional. Atenção: se você vendê-lo antes do vencimento, o valor pode oscilar devido à marcação a mercado.',
      updatedAt: now,
    },
    {
      id: 'inv-cdb-bb-110',
      ticker: 'CDB-BB-110',
      name: 'CDB Banco do Brasil Liquidez',
      assetClass: 'renda_fixa_pos',
      indexer: 'CDI',
      institution: 'Banco do Brasil',
      quantity: 1,
      averagePrice: 18000.0,
      currentPrice: 20150.0,
      totalInvested: 18000.0,
      currentValue: 20150.0,
      rateDescription: '100% a 110% do CDI',
      liquidity: 'Diária (D+0)',
      maturityDate: '2028-08-01',
      taxRule: 'IR Regressivo + Cobertura FGC até R$ 250 mil',
      educationalSummary:
        'Certificado de Depósito Bancário indexado ao CDI. Excelente para caixa de curto/médio prazo com proteção do FGC.',
      updatedAt: now,
    },
    {
      id: 'inv-lci-bb',
      ticker: 'LCI-BB-93',
      name: 'LCI Banco do Brasil 93% CDI',
      assetClass: 'renda_fixa_pos',
      indexer: 'CDI',
      institution: 'Banco do Brasil',
      quantity: 1,
      averagePrice: 15000.0,
      currentPrice: 16480.0,
      totalInvested: 15000.0,
      currentValue: 16480.0,
      rateDescription: '93% do CDI (Isento IR)',
      liquidity: 'Carência 9 meses / Venc. 2027',
      maturityDate: '2027-11-20',
      taxRule: 'Isento de IR para Pessoa Física (equivalente a ~109,4% CDI bruto)',
      educationalSummary:
        'Letra de Crédito Imobiliário isenta de Imposto de Renda para pessoa física. Por não pagar IR, 93% do CDI líquido equivale a um CDB de ~109,4% do CDI em 2 anos.',
      updatedAt: now,
    },
    {
      id: 'inv-hglg11',
      ticker: 'HGLG11',
      name: 'Patria Logística FII',
      assetClass: 'fiis',
      indexer: 'IFIX',
      institution: 'B3 / Corretora',
      quantity: 110,
      averagePrice: 156.4,
      currentPrice: 161.2,
      totalInvested: 17204.0,
      currentValue: 17732.0,
      rateDescription: 'DY ~8,9% a.a. (Isento IR)',
      liquidity: 'Bolsa B3 (D+2)',
      taxRule: 'Dividendos mensais isentos de IR; ganho de capital 20%',
      educationalSummary:
        'Fundo Imobiliário de galpões logísticos. Gera renda mensal isenta de IR e possui contratos atrelados à inflação.',
      updatedAt: now,
    },
    {
      id: 'inv-mxrf11',
      ticker: 'MXRF11',
      name: 'Maxi Renda FII (Papel/CRI)',
      assetClass: 'fiis',
      indexer: 'IFIX',
      institution: 'B3 / Corretora',
      quantity: 1200,
      averagePrice: 9.85,
      currentPrice: 10.12,
      totalInvested: 11820.0,
      currentValue: 12144.0,
      rateDescription: 'DY ~11,4% a.a. (Isento IR)',
      liquidity: 'Bolsa B3 (D+2)',
      taxRule: 'Dividendos mensais isentos de IR; ganho de capital 20%',
      educationalSummary:
        'FII de recebíveis imobiliários (CRIs) indexados ao CDI e IPCA. Traz alto rendimento mensal em proventos.',
      updatedAt: now,
    },
    {
      id: 'inv-wege3',
      ticker: 'WEGE3',
      name: 'WEG S.A. ON',
      assetClass: 'acoes',
      indexer: 'IBOV',
      institution: 'B3 / Corretora',
      quantity: 250,
      averagePrice: 42.5,
      currentPrice: 53.8,
      totalInvested: 10625.0,
      currentValue: 13450.0,
      rateDescription: 'Crescimento + Dividendos/JCP',
      liquidity: 'Bolsa B3 (D+2)',
      taxRule: 'Isenção de IR em vendas até R$ 20 mil/mês; 15% acima',
      educationalSummary:
        'Empresa industrial exportadora com forte ROE e receita dolarizada. Analise indicadores como P/L e ROE antes de aportar.',
      updatedAt: now,
    },
    {
      id: 'inv-bbas3',
      ticker: 'BBAS3',
      name: 'Banco do Brasil S.A. ON',
      assetClass: 'acoes',
      indexer: 'IBOV',
      institution: 'B3 / Corretora',
      quantity: 400,
      averagePrice: 25.1,
      currentPrice: 27.6,
      totalInvested: 10040.0,
      currentValue: 11040.0,
      rateDescription: 'Dividendos + JCP (~9% DY)',
      liquidity: 'Bolsa B3 (D+2)',
      taxRule: 'Dividendos isentos; JCP tributado em 15% na fonte',
      educationalSummary:
        'Ação de banco consolidado com P/L historicamente descontado e foco em distribuição recorrente de proventos.',
      updatedAt: now,
    },
    {
      id: 'inv-mbprev',
      ticker: 'MBPREV',
      name: 'Previdência Privada Mercedes-Benz (PGBL)',
      assetClass: 'previdencia',
      indexer: 'CDI',
      institution: 'MBPrev / Entidade Fechada',
      quantity: 1,
      averagePrice: 22400.0,
      currentPrice: 26900.0,
      totalInvested: 22400.0,
      currentValue: 26900.0,
      rateDescription: 'CDI + Contrapartida 100% Empresa',
      liquidity: 'Aposentadoria / Desligamento',
      taxRule: 'Dedução de até 12% da renda bruta no IR completo (PGBL)',
      educationalSummary:
        'Plano patrocinado pela Mercedes-Benz. A contrapartida patronal equivale a retorno imediato de 100% sobre a parcela elegível, além do benefício fiscal no IR.',
      updatedAt: now,
    },
    {
      id: 'inv-btc',
      ticker: 'BTC',
      name: 'Bitcoin (Reserva Assimétrica)',
      assetClass: 'cripto',
      indexer: 'USD_BTC',
      institution: 'Exchange / Autocustódia',
      quantity: 0.025,
      averagePrice: 295000.0,
      currentPrice: 440000.0,
      totalInvested: 7375.0,
      currentValue: 11000.0,
      rateDescription: 'Ativo Digital Escasso (USD)',
      liquidity: '24/7 (D+0)',
      taxRule: '15% sobre ganho de capital (isenção até R$ 35 mil/mês em corretora BR)',
      educationalSummary:
        'Exposição cambial e descorrelacionada de longo prazo. Manter percentual controlado devido à alta volatilidade.',
      updatedAt: now,
    },
  ];

  const insertInv = db.prepare(`
    INSERT INTO investments (
      id, ticker, name, asset_class, indexer, institution, quantity, average_price,
      current_price, total_invested, current_value, rate_description, liquidity,
      maturity_date, tax_rule, educational_summary, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  investments.forEach((inv) => {
    insertInv.run([
      inv.id,
      inv.ticker,
      inv.name,
      inv.assetClass,
      inv.indexer,
      inv.institution,
      inv.quantity,
      inv.averagePrice,
      inv.currentPrice,
      inv.totalInvested,
      inv.currentValue,
      inv.rateDescription,
      inv.liquidity,
      inv.maturityDate ?? null,
      inv.taxRule,
      inv.educationalSummary ?? null,
      inv.updatedAt,
    ]);
  });
  insertInv.free();

  // Seed Budget Goals
  const goals: BudgetGoal[] = [
    { id: 'goal-moradia', category: 'Moradia', monthlyLimit: 3200 },
    { id: 'goal-supermercado', category: 'Supermercado', monthlyLimit: 1500 },
    { id: 'goal-alimentacao', category: 'Alimentação', monthlyLimit: 700 },
    { id: 'goal-transporte', category: 'Transporte', monthlyLimit: 650 },
    { id: 'goal-lazer', category: 'Lazer', monthlyLimit: 500 },
    { id: 'goal-assinaturas', category: 'Assinaturas', monthlyLimit: 250 },
    { id: 'goal-educacao', category: 'Educação', monthlyLimit: 500 },
  ];

  const insertGoal = db.prepare('INSERT INTO budget_goals (id, category, monthly_limit) VALUES (?, ?, ?)');
  goals.forEach((g) => insertGoal.run([g.id, g.category, g.monthlyLimit]));
  insertGoal.free();
}

export async function initDatabase(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }
  const SQL = await ensureSqlModule();
  const savedBytes = await loadBytesFromIndexedDb();

  if (savedBytes && savedBytes.byteLength > 0) {
    try {
      const candidate = new SQL.Database(savedBytes);
      createSchema(candidate);
      dbInstance = candidate;
      return dbInstance;
    } catch {
      // Fallback para novo banco caso bytes locais estejam corrompidos
    }
  }

  const freshDb = new SQL.Database();
  createSchema(freshDb);
  seedInitialData(freshDb);
  dbInstance = freshDb;
  await persistLocalSnapshot();
  return dbInstance;
}

export async function persistLocalSnapshot(): Promise<Uint8Array> {
  if (!dbInstance) {
    await initDatabase();
  }
  const bytes = dbInstance!.export();
  await saveBytesToIndexedDb(bytes);
  return bytes;
}

export function exportDatabaseBytes(): Uint8Array {
  if (!dbInstance) {
    throw new Error('Banco SQLite ainda não inicializado.');
  }
  return dbInstance.export();
}

export async function importDatabaseBytes(bytes: Uint8Array): Promise<void> {
  const SQL = await ensureSqlModule();
  const nextDb = new SQL.Database(bytes);
  createSchema(nextDb);
  if (dbInstance) {
    dbInstance.close();
  }
  dbInstance = nextDb;
  await saveBytesToIndexedDb(bytes);
}

export async function resetToSeedDatabase(): Promise<void> {
  const SQL = await ensureSqlModule();
  const freshDb = new SQL.Database();
  createSchema(freshDb);
  seedInitialData(freshDb);
  if (dbInstance) {
    dbInstance.close();
  }
  dbInstance = freshDb;
  await persistLocalSnapshot();
}

export async function clearAllFinancialData(): Promise<void> {
  if (!dbInstance) {
    await initDatabase();
  }
  dbInstance!.run(`
    DELETE FROM payslip_items;
    DELETE FROM payslips;
    DELETE FROM transactions;
    DELETE FROM investments;
  `);
  await persistLocalSnapshot();
}

function queryObjects<T>(sql: string, params: (string | number | null)[] = []): T[] {
  if (!dbInstance) {
    return [];
  }
  const stmt = dbInstance.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return rows;
}

export function getSettings(): AppSettings {
  const rows = queryObjects<{ key: string; value: string }>('SELECT key, value FROM settings');
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    googleClientId: map.get('googleClientId') ?? DEFAULT_SETTINGS.googleClientId,
    driveFolderId: map.get('driveFolderId') || DEFAULT_SETTINGS.driveFolderId,
    driveFileName: map.get('driveFileName') || DEFAULT_SETTINGS.driveFileName,
    autoSyncDrive: (map.get('autoSyncDrive') ?? 'true') === 'true',
    llmProvider:
      (map.get('llmProvider') as AppSettings['llmProvider']) ?? DEFAULT_SETTINGS.llmProvider,
    geminiApiKey: map.get('geminiApiKey') ?? '',
    geminiModel: map.get('geminiModel') || DEFAULT_SETTINGS.geminiModel,
    openaiApiKey: map.get('openaiApiKey') ?? '',
    openaiModel: map.get('openaiModel') || DEFAULT_SETTINGS.openaiModel,
    pluggyClientId: map.get('pluggyClientId') ?? '',
    pluggyClientSecret: map.get('pluggyClientSecret') ?? '',
    pluggyItemId: map.get('pluggyItemId') ?? '',
    benchmarkSelic: Number(map.get('benchmarkSelic') ?? DEFAULT_SETTINGS.benchmarkSelic),
    benchmarkCdi: Number(map.get('benchmarkCdi') ?? DEFAULT_SETTINGS.benchmarkCdi),
    benchmarkIpca: Number(map.get('benchmarkIpca') ?? DEFAULT_SETTINGS.benchmarkIpca),
    userName: map.get('userName') || DEFAULT_SETTINGS.userName,
  };
}

export async function saveSettings(next: Partial<AppSettings>): Promise<AppSettings> {
  if (!dbInstance) {
    await initDatabase();
  }
  const current = getSettings();
  const merged: AppSettings = { ...current, ...next };
  const stmt = dbInstance!.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  (Object.entries(merged) as [keyof AppSettings, string | number | boolean][]).forEach(([k, v]) => {
    stmt.run([k, String(v)]);
  });
  stmt.free();
  await persistLocalSnapshot();
  return merged;
}

export function getTransactions(): Transaction[] {
  const rows = queryObjects<{
    id: string;
    date: string;
    description: string;
    amount: number;
    type: Transaction['type'];
    category: string;
    account: string;
    source: DataSource;
    fitid: string | null;
    notes: string | null;
    created_at: string;
  }>('SELECT * FROM transactions ORDER BY date DESC, created_at DESC');

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    description: r.description,
    amount: Number(r.amount),
    type: r.type,
    category: r.category,
    account: r.account,
    source: r.source,
    fitid: r.fitid ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  }));
}

export async function addTransactions(newItems: Omit<Transaction, 'id' | 'createdAt'>[]): Promise<{
  inserted: number;
  skippedDuplicates: number;
}> {
  if (!dbInstance) {
    await initDatabase();
  }
  const existing = getTransactions();
  const existingFitids = new Set(existing.map((t) => t.fitid).filter(Boolean));
  const existingKeys = new Set(
    existing.map((t) => `${t.date}|${t.amount.toFixed(2)}|${t.description.trim().toUpperCase()}`),
  );

  const stmt = dbInstance!.prepare(`
    INSERT INTO transactions (
      id, date, description, amount, type, category, account, source, fitid, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  let skippedDuplicates = 0;
  const now = new Date().toISOString();

  for (const item of newItems) {
    const dedupKey = `${item.date}|${item.amount.toFixed(2)}|${item.description.trim().toUpperCase()}`;
    if ((item.fitid && existingFitids.has(item.fitid)) || existingKeys.has(dedupKey)) {
      skippedDuplicates += 1;
      continue;
    }

    const id = `tx-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
    stmt.run([
      id,
      item.date,
      item.description.trim(),
      Math.abs(item.amount),
      item.type,
      item.category,
      item.account,
      item.source,
      item.fitid ?? null,
      item.notes ?? null,
      now,
    ]);
    if (item.fitid) existingFitids.add(item.fitid);
    existingKeys.add(dedupKey);
    inserted += 1;
  }

  stmt.free();
  if (inserted > 0) {
    await persistLocalSnapshot();
  }
  return { inserted, skippedDuplicates };
}

export async function updateTransactionCategory(id: string, category: string): Promise<void> {
  if (!dbInstance) return;
  dbInstance.run('UPDATE transactions SET category = ? WHERE id = ?', [category, id]);
  await persistLocalSnapshot();
}

export async function deleteTransaction(id: string): Promise<void> {
  if (!dbInstance) return;
  dbInstance.run('DELETE FROM transactions WHERE id = ?', [id]);
  await persistLocalSnapshot();
}

export function getPayslips(): Payslip[] {
  const rows = queryObjects<{
    id: string;
    competence: string;
    payment_date: string;
    employer: string;
    employee_name: string | null;
    role: string | null;
    gross_salary: number;
    total_deductions: number;
    net_salary: number;
    inss_amount: number;
    irrf_amount: number;
    private_pension_amount: number;
    health_plan_amount: number;
    fgts_amount: number;
    source: DataSource;
    reconciled_transaction_id: string | null;
    created_at: string;
  }>('SELECT * FROM payslips ORDER BY competence DESC, payment_date DESC');

  const itemRows = queryObjects<{
    id: string;
    payslip_id: string;
    code: string;
    description: string;
    kind: PayslipItem['kind'];
    reference: string | null;
    amount: number;
  }>('SELECT * FROM payslip_items ORDER BY kind ASC, code ASC');

  const itemsByPayslip = new Map<string, PayslipItem[]>();
  itemRows.forEach((it) => {
    const list = itemsByPayslip.get(it.payslip_id) ?? [];
    list.push({
      id: it.id,
      payslipId: it.payslip_id,
      code: it.code,
      description: it.description,
      kind: it.kind,
      reference: it.reference ?? undefined,
      amount: Number(it.amount),
    });
    itemsByPayslip.set(it.payslip_id, list);
  });

  return rows.map((r) => ({
    id: r.id,
    competence: r.competence,
    paymentDate: r.payment_date,
    employer: r.employer,
    employeeName: r.employee_name ?? undefined,
    role: r.role ?? undefined,
    grossSalary: Number(r.gross_salary),
    totalDeductions: Number(r.total_deductions),
    netSalary: Number(r.net_salary),
    inssAmount: Number(r.inss_amount),
    irrfAmount: Number(r.irrf_amount),
    privatePensionAmount: Number(r.private_pension_amount),
    healthPlanAmount: Number(r.health_plan_amount),
    fgtsAmount: Number(r.fgts_amount),
    source: r.source,
    reconciledTransactionId: r.reconciled_transaction_id ?? undefined,
    items: itemsByPayslip.get(r.id) ?? [],
    createdAt: r.created_at,
  }));
}

export async function addPayslip(
  payslip: Omit<Payslip, 'id' | 'createdAt' | 'items'>,
  items: Omit<PayslipItem, 'id' | 'payslipId'>[],
  alsoCreateSalaryTransaction: boolean = true,
): Promise<Payslip> {
  if (!dbInstance) {
    await initDatabase();
  }
  const now = new Date().toISOString();
  const payslipId = `pay-${payslip.competence}-${Date.now().toString(36)}`;

  let reconciledTxId = payslip.reconciledTransactionId;
  if (!reconciledTxId) {
    const existingTxs = getTransactions();
    const match = existingTxs.find(
      (t) =>
        t.type === 'income' &&
        Math.abs(t.amount - payslip.netSalary) < 5 &&
        t.date.startsWith(payslip.competence),
    );
    if (match) {
      reconciledTxId = match.id;
    } else if (alsoCreateSalaryTransaction && payslip.netSalary > 0) {
      const txId = `tx-sal-${payslip.competence}-${Date.now().toString(36)}`;
      dbInstance!.run(
        `INSERT INTO transactions (
          id, date, description, amount, type, category, account, source, fitid, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txId,
          payslip.paymentDate,
          `SALARIO LIQUIDO ${payslip.employer.toUpperCase()} (${payslip.competence})`,
          payslip.netSalary,
          'income',
          'Salário Mercedes-Benz',
          'Banco do Brasil CC',
          payslip.source,
          `HOLERITE-${payslip.competence}`,
          `Gerado automaticamente na importação do holerite (${payslip.competence})`,
          now,
        ],
      );
      reconciledTxId = txId;
    }
  }

  dbInstance!.run(
    `INSERT INTO payslips (
      id, competence, payment_date, employer, employee_name, role,
      gross_salary, total_deductions, net_salary, inss_amount, irrf_amount,
      private_pension_amount, health_plan_amount, fgts_amount, source,
      reconciled_transaction_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payslipId,
      payslip.competence,
      payslip.paymentDate,
      payslip.employer,
      payslip.employeeName ?? null,
      payslip.role ?? null,
      payslip.grossSalary,
      payslip.totalDeductions,
      payslip.netSalary,
      payslip.inssAmount,
      payslip.irrfAmount,
      payslip.privatePensionAmount,
      payslip.healthPlanAmount,
      payslip.fgtsAmount,
      payslip.source,
      reconciledTxId ?? null,
      now,
    ],
  );

  const stmtItem = dbInstance!.prepare(`
    INSERT INTO payslip_items (id, payslip_id, code, description, kind, reference, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const createdItems: PayslipItem[] = items.map((it, idx) => {
    const itemId = `${payslipId}-it-${idx + 1}`;
    stmtItem.run([
      itemId,
      payslipId,
      it.code || String(100 + idx),
      it.description,
      it.kind,
      it.reference ?? null,
      it.amount,
    ]);
    return {
      ...it,
      id: itemId,
      payslipId,
    };
  });
  stmtItem.free();

  await persistLocalSnapshot();
  return {
    ...payslip,
    id: payslipId,
    reconciledTransactionId: reconciledTxId,
    items: createdItems,
    createdAt: now,
  };
}

export async function deletePayslip(id: string): Promise<void> {
  if (!dbInstance) return;
  dbInstance.run('DELETE FROM payslip_items WHERE payslip_id = ?', [id]);
  dbInstance.run('DELETE FROM payslips WHERE id = ?', [id]);
  await persistLocalSnapshot();
}

export function getInvestments(): Investment[] {
  const rows = queryObjects<{
    id: string;
    ticker: string;
    name: string;
    asset_class: Investment['assetClass'];
    indexer: Investment['indexer'];
    institution: string;
    quantity: number;
    average_price: number;
    current_price: number;
    total_invested: number;
    current_value: number;
    rate_description: string;
    liquidity: string;
    maturity_date: string | null;
    tax_rule: string;
    educational_summary: string | null;
    updated_at: string;
  }>('SELECT * FROM investments ORDER BY current_value DESC');

  return rows.map((r) => ({
    id: r.id,
    ticker: r.ticker,
    name: r.name,
    assetClass: r.asset_class,
    indexer: r.indexer,
    institution: r.institution,
    quantity: Number(r.quantity),
    averagePrice: Number(r.average_price),
    currentPrice: Number(r.current_price),
    totalInvested: Number(r.total_invested),
    currentValue: Number(r.current_value),
    rateDescription: r.rate_description,
    liquidity: r.liquidity,
    maturityDate: r.maturity_date ?? undefined,
    taxRule: r.tax_rule,
    educationalSummary: r.educational_summary ?? undefined,
    updatedAt: r.updated_at,
  }));
}

export async function upsertInvestment(
  inv: Omit<Investment, 'id' | 'updatedAt'> & { id?: string },
): Promise<void> {
  if (!dbInstance) {
    await initDatabase();
  }
  const id = inv.id || `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  dbInstance!.run(
    `INSERT OR REPLACE INTO investments (
      id, ticker, name, asset_class, indexer, institution, quantity, average_price,
      current_price, total_invested, current_value, rate_description, liquidity,
      maturity_date, tax_rule, educational_summary, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      inv.ticker.toUpperCase(),
      inv.name,
      inv.assetClass,
      inv.indexer,
      inv.institution,
      inv.quantity,
      inv.averagePrice,
      inv.currentPrice,
      inv.totalInvested,
      inv.currentValue,
      inv.rateDescription,
      inv.liquidity,
      inv.maturityDate ?? null,
      inv.taxRule,
      inv.educationalSummary ?? null,
      now,
    ],
  );
  await persistLocalSnapshot();
}

export async function deleteInvestment(id: string): Promise<void> {
  if (!dbInstance) return;
  dbInstance.run('DELETE FROM investments WHERE id = ?', [id]);
  await persistLocalSnapshot();
}

export function getBudgetGoals(): BudgetGoal[] {
  const rows = queryObjects<{ id: string; category: string; monthly_limit: number }>(
    'SELECT id, category, monthly_limit FROM budget_goals ORDER BY monthly_limit DESC',
  );
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    monthlyLimit: Number(r.monthly_limit),
  }));
}

export async function upsertBudgetGoal(category: string, monthlyLimit: number): Promise<void> {
  if (!dbInstance) return;
  const id = `goal-${category.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  dbInstance.run(
    'INSERT OR REPLACE INTO budget_goals (id, category, monthly_limit) VALUES (?, ?, ?)',
    [id, category, monthlyLimit],
  );
  await persistLocalSnapshot();
}

export function computeFinancialSummary(
  transactions: Transaction[],
  payslips: Payslip[],
  investments: Investment[],
): FinancialSummary {
  const months = Array.from(new Set(transactions.map((t) => t.date.slice(0, 7)))).sort();
  const latestMonth = months[months.length - 1] ?? new Date().toISOString().slice(0, 7);

  let totalIncome = 0;
  let totalExpenses = 0;
  let monthlyIncome = 0;
  let monthlyExpenses = 0;

  transactions.forEach((t) => {
    if (t.type === 'income') {
      totalIncome += t.amount;
      if (t.date.startsWith(latestMonth)) monthlyIncome += t.amount;
    } else if (t.type === 'expense') {
      totalExpenses += t.amount;
      if (t.date.startsWith(latestMonth)) monthlyExpenses += t.amount;
    }
  });

  const savingsRate =
    monthlyIncome > 0 ? Math.max(-100, ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100) : 0;

  const totalPortfolioValue = investments.reduce((acc, i) => acc + i.currentValue, 0);
  const totalPortfolioInvested = investments.reduce((acc, i) => acc + i.totalInvested, 0);
  const portfolioGain = totalPortfolioValue - totalPortfolioInvested;
  const portfolioGainPct =
    totalPortfolioInvested > 0 ? (portfolioGain / totalPortfolioInvested) * 100 : 0;

  const liquidReserves = investments
    .filter(
      (i) =>
        i.assetClass === 'renda_fixa_pos' &&
        (i.liquidity.toLowerCase().includes('diária') || i.liquidity.toLowerCase().includes('d+0') || i.liquidity.toLowerCase().includes('d+1')),
    )
    .reduce((acc, i) => acc + i.currentValue, 0);

  const avgMonthlyExpense =
    months.length > 0 ? totalExpenses / months.length : Math.max(monthlyExpenses, 1);

  const emergencyFundMonths = avgMonthlyExpense > 0 ? liquidReserves / avgMonthlyExpense : 0;

  return {
    totalIncome,
    totalExpenses,
    monthlyIncome,
    monthlyExpenses,
    savingsRate,
    totalPortfolioValue,
    totalPortfolioInvested,
    portfolioGain,
    portfolioGainPct,
    emergencyFundMonths,
    liquidReserves,
    latestPayslip: payslips[0] ?? null,
  };
}

export function exportDatabaseAsJsonString(): string {
  const payload = {
    exportedAt: new Date().toISOString(),
    transactions: getTransactions(),
    payslips: getPayslips(),
    investments: getInvestments(),
    budgetGoals: getBudgetGoals(),
    settings: {
      ...getSettings(),
      geminiApiKey: '***REDACTED_IN_JSON_EXPORT***',
      openaiApiKey: '***REDACTED_IN_JSON_EXPORT***',
      pluggyClientSecret: '***REDACTED_IN_JSON_EXPORT***',
    },
  };
  return JSON.stringify(payload, null, 2);
}
