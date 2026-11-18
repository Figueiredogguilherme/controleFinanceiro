import { Transaction, TransactionType } from '../../types/finance';

export const EXPENSE_CATEGORIES = [
  'Moradia',
  'Supermercado',
  'Alimentação',
  'Transporte',
  'Saúde',
  'Assinaturas',
  'Educação',
  'Lazer',
  'Investimentos',
  'Transferências / Pix',
  'Impostos & Tarifas',
  'Outros',
];

export const INCOME_CATEGORIES = [
  'Salário Mercedes-Benz',
  'PLR / Bônus Mercedes-Benz',
  'Dividendos & Rendimentos',
  'Reembolso / Outras Receitas',
];

export function categorizeBancoDoBrasilTransaction(
  description: string,
  rawAmount: number,
): { category: string; type: TransactionType } {
  const upper = description.toUpperCase();

  // Investimentos / Aplicações
  if (
    /TESOURO|CDB|LCI|LCA|CORRETORA|XP |BTG|RICO|NUINVEST|INVEST|POUPANCA|FUNDO DI|RENDA FIXA|APLICACAO/.test(
      upper,
    )
  ) {
    if (rawAmount < 0) {
      return { category: 'Investimentos', type: 'investment' };
    }
    return { category: 'Dividendos & Rendimentos', type: 'income' };
  }

  // Receitas
  if (rawAmount > 0) {
    if (/MERCEDES|DAIMLER|MB DO BRASIL|SALARIO|PGTO FOLHA|CRED SAL/.test(upper)) {
      if (/PLR|PARTICIPACAO|BONUS|13O/.test(upper)) {
        return { category: 'PLR / Bônus Mercedes-Benz', type: 'income' };
      }
      return { category: 'Salário Mercedes-Benz', type: 'income' };
    }
    if (/DIVIDEND|RENDIMENT|JCP|PROVENTO|FII|JUROS SOBRE/.test(upper)) {
      return { category: 'Dividendos & Rendimentos', type: 'income' };
    }
    return { category: 'Reembolso / Outras Receitas', type: 'income' };
  }

  // Despesas
  if (/ALUGUEL|CONDOMINIO|IPTU|ENEL|CPFL|SABESP|COMGAS|VIVO|CLARO|TIM |FIBRA|LUZ|AGUA/.test(upper)) {
    return { category: 'Moradia', type: 'expense' };
  }
  if (/MERCADO|PAO DE ACUCAR|CARREFOUR|ASSAI|ATACADAO|ZAFFARI|EXTRA|SONDA|COOP|HORTIFRUTI/.test(upper)) {
    return { category: 'Supermercado', type: 'expense' };
  }
  if (/IFOOD|RAPPI|RESTAURANTE|PADARIA|CAFE|CAFETERIA|BURGER|PIZZA|MC DONALD|OUTBACK|LANCHE/.test(upper)) {
    return { category: 'Alimentação', type: 'expense' };
  }
  if (/POSTO|SHELL|IPIRANGA|PETROBRAS|COMBUSTIVEL|UBER|99APP|SEM PARAR|VELOE|PEDAGIO|ESTACIONAMENTO/.test(upper)) {
    return { category: 'Transporte', type: 'expense' };
  }
  if (/FARMACIA|DROGASIL|DROGA RAIA|PANVEL|HOSPITAL|CLINICA|EXAME|MEDICO|DENTISTA|ACADEMIA|SMART FIT/.test(upper)) {
    return { category: 'Saúde', type: 'expense' };
  }
  if (/NETFLIX|SPOTIFY|AMAZON PRIME|DISNEY|APPLE|GOOGLE ONE|YOUTUBE|CHATGPT|OPENAI|ICLOUD|ASSINATURA/.test(upper)) {
    return { category: 'Assinaturas', type: 'expense' };
  }
  if (/FACULDADE|POS-GRADUACAO|CURSO|UDEMY|ALURA|LIVRO|LIVRARIA|ESCOLA/.test(upper)) {
    return { category: 'Educação', type: 'expense' };
  }
  if (/CINEMA|INGRESSO|TEATRO|SHOW|BAR |HOTEL|AIRBNB|VIAGEM|AZUL|LATAM|GOL/.test(upper)) {
    return { category: 'Lazer', type: 'expense' };
  }
  if (/IOF|TARIFA|ANUIDADE|DARF|IMPOSTO|MULTA/.test(upper)) {
    return { category: 'Impostos & Tarifas', type: 'expense' };
  }
  if (/PIX|TED|DOC|TRANSF/.test(upper)) {
    return { category: 'Transferências / Pix', type: 'expense' };
  }

  return { category: 'Outros', type: 'expense' };
}

function parseOfxDate(rawDate: string): string {
  const digits = rawDate.replace(/\D/g, '');
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function extractOfxTag(block: string, tagName: string): string {
  const xmlRegex = new RegExp(`<${tagName}>([^<\\r\\n]+)</${tagName}>`, 'i');
  const xmlMatch = block.match(xmlRegex);
  if (xmlMatch) {
    return xmlMatch[1].trim();
  }
  const sgmlRegex = new RegExp(`<${tagName}>([^<\\r\\n]+)`, 'i');
  const sgmlMatch = block.match(sgmlRegex);
  return sgmlMatch ? sgmlMatch[1].trim() : '';
}

export function parseBancoDoBrasilOfx(
  ofxContent: string,
  accountLabel: string = 'Banco do Brasil CC',
): Omit<Transaction, 'id' | 'createdAt'>[] {
  const acctId = extractOfxTag(ofxContent, 'ACCTID');
  const resolvedAccount = acctId ? `BB Conta ${acctId.slice(-6)}` : accountLabel;

  const blocks = ofxContent.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi) ?? [];

  const parsed: Omit<Transaction, 'id' | 'createdAt'>[] = [];

  for (const block of blocks) {
    const dtPosted = extractOfxTag(block, 'DTPOSTED');
    const trnAmtRaw = extractOfxTag(block, 'TRNAMT');
    const fitid = extractOfxTag(block, 'FITID');
    const memo = extractOfxTag(block, 'MEMO') || extractOfxTag(block, 'NAME') || 'Lançamento BB';

    const cleanNum = trnAmtRaw.replace(/\s/g, '').replace(',', '.');
    const signedAmount = Number(cleanNum);
    if (!Number.isFinite(signedAmount) || signedAmount === 0) {
      continue;
    }

    const { category, type } = categorizeBancoDoBrasilTransaction(memo, signedAmount);

    parsed.push({
      date: parseOfxDate(dtPosted),
      description: memo.replace(/\s+/g, ' ').trim(),
      amount: Math.abs(signedAmount),
      type,
      category,
      account: resolvedAccount,
      source: 'banco_do_brasil_ofx',
      fitid: fitid || undefined,
    });
  }

  return parsed;
}

function parseBrazilianNumber(raw: string): number {
  let clean = raw.replace(/["']/g, '').trim();
  let isNegative = false;

  if (clean.endsWith('D') || clean.endsWith('-')) {
    isNegative = true;
    clean = clean.slice(0, -1).trim();
  } else if (clean.startsWith('-')) {
    isNegative = true;
    clean = clean.slice(1).trim();
  } else if (clean.endsWith('C') || clean.endsWith('+')) {
    clean = clean.slice(0, -1).trim();
  }

  clean = clean.replace(/R\$\s?/gi, '');

  // Se contém vírgula como separador decimal (ex: 1.250,40)
  if (clean.includes(',') && (!clean.includes('.') || clean.lastIndexOf(',') > clean.lastIndexOf('.'))) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else {
    clean = clean.replace(/,/g, '');
  }

  const val = Number(clean);
  if (!Number.isFinite(val)) return 0;
  return isNegative ? -Math.abs(val) : val;
}

function parseBrazilianDate(raw: string): string {
  const clean = raw.replace(/["']/g, '').trim();
  const brMatch = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }
  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return clean;
  }
  return new Date().toISOString().slice(0, 10);
}

export function parseBancoDoBrasilCsv(
  csvContent: string,
  accountLabel: string = 'Banco do Brasil CC',
): Omit<Transaction, 'id' | 'createdAt'>[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const splitLine = (line: string) =>
    line
      .split(delimiter)
      .map((cell) => cell.replace(/^"|"$/g, '').trim());

  const header = splitLine(lines[0]).map((h) => h.toLowerCase());
  let dateIdx = header.findIndex((h) => h.includes('data'));
  let descIdx = header.findIndex((h) => h.includes('hist') || h.includes('descr') || h.includes('lanc'));
  let valIdx = header.findIndex((h) => h.includes('valor'));
  let docIdx = header.findIndex((h) => h.includes('doc') || h.includes('numero'));

  const hasHeader = dateIdx !== -1 && valIdx !== -1;
  if (!hasHeader) {
    dateIdx = 0;
    descIdx = 1;
    valIdx = 2;
    docIdx = -1;
  }

  const startIndex = hasHeader ? 1 : 0;
  const results: Omit<Transaction, 'id' | 'createdAt'>[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.length < 3) continue;

    const rawDate = cols[dateIdx] ?? '';
    const desc = (cols[descIdx >= 0 ? descIdx : 1] ?? '').trim();
    const rawVal = cols[valIdx] ?? '';

    if (!desc || /SALDO ANTERIOR|SALDO DO DIA|S A L D O/i.test(desc)) {
      continue;
    }

    const signedAmount = parseBrazilianNumber(rawVal);
    if (signedAmount === 0) continue;

    const { category, type } = categorizeBancoDoBrasilTransaction(desc, signedAmount);
    const isoDate = parseBrazilianDate(rawDate);
    const docNum = docIdx >= 0 ? cols[docIdx] : undefined;

    results.push({
      date: isoDate,
      description: desc,
      amount: Math.abs(signedAmount),
      type,
      category,
      account: accountLabel,
      source: 'banco_do_brasil_csv',
      fitid: docNum ? `BBCSV-${isoDate}-${docNum}` : undefined,
    });
  }

  return results;
}
