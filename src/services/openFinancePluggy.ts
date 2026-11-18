import {
  AssetClass,
  AssetIndexer,
  BankAccount,
  Investment,
  Transaction,
} from '../types/finance';
import { categorizeBancoDoBrasilTransaction } from './parsers/ofxParser';

interface PluggyAuthResponse {
  apiKey: string;
}

export interface PluggyItemStatus {
  id: string;
  connector?: {
    id?: number;
    name?: string;
    primaryColor?: string;
    institutionUrl?: string;
  };
  status: string;
  executionStatus?: string;
  lastUpdatedAt?: string;
  error?: {
    code?: string;
    message?: string;
  };
}

interface PluggyRawAccount {
  id: string;
  name: string;
  type: 'BANK' | 'CREDIT' | string;
  subtype?: string;
  number?: string;
  balance: number;
  currencyCode?: string;
  creditData?: {
    level?: string;
    brand?: string;
    balanceCloseDate?: string;
    balanceDueDate?: string;
    availableCreditLimit?: number;
    creditLimit?: number;
  };
}

interface PluggyRawTransaction {
  id: string;
  description: string;
  descriptionRaw?: string;
  amount: number;
  amountInAccountCurrency?: number;
  date: string;
  type: 'DEBIT' | 'CREDIT' | string;
  category?: string;
  status?: string;
}

interface PluggyRawInvestment {
  id: string;
  name: string;
  code?: string;
  isin?: string;
  number?: string;
  balance: number;
  amount?: number;
  amountOriginal?: number;
  amountProfit?: number;
  quantity?: number;
  value?: number;
  type:
    | 'FIXED_INCOME'
    | 'MUTUAL_FUND'
    | 'SECURITY'
    | 'EQUITY'
    | 'ETF'
    | 'COE'
    | 'OTHER'
    | string;
  subtype?: string;
  rate?: number;
  rateType?: 'CDI' | 'IPCA' | 'PRE' | 'SELIC' | string;
  fixedAnnualRate?: number;
  annualRate?: number;
  dueDate?: string;
  issuer?: string;
  institution?: {
    name?: string;
  };
}

export interface PluggySyncResult {
  items: PluggyItemStatus[];
  accounts: Omit<BankAccount, 'updatedAt'>[];
  transactions: Omit<Transaction, 'id' | 'createdAt'>[];
  investments: Omit<Investment, 'updatedAt'>[];
  logs: string[];
}

declare global {
  interface Window {
    PluggyConnect?: new (config: {
      connectToken: string;
      updateItem?: string;
      includeSandbox?: boolean;
      onSuccess: (data: { item: { id: string; connector?: { name?: string } } }) => void;
      onError: (err: { message?: string }) => void;
      onClose?: () => void;
    }) => { init: () => void };
  }
}

/**
 * Extrai todos os UUIDs válidos de uma string (permite que o usuário cole uma URL do dashboard,
 * múltiplos IDs separados por vírgula ou um único UUID com espaços).
 */
export function extractPluggyItemIds(rawInput: string): string[] {
  const uuidRegex =
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;
  const matches = rawInput.match(uuidRegex);
  if (matches && matches.length > 0) {
    return Array.from(new Set(matches.map((m) => m.toLowerCase())));
  }
  const trimmed = rawInput.trim();
  return trimmed ? [trimmed] : [];
}

export async function authenticatePluggy(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const cleanId = clientId.trim();
  const cleanSecret = clientSecret.trim();

  if (!cleanId || !cleanSecret) {
    throw new Error(
      'Preencha o Client ID e o Client Secret da Pluggy na Central de Conexões.',
    );
  }

  const authRes = await fetch('https://api.pluggy.ai/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: cleanId,
      clientSecret: cleanSecret,
    }),
  });

  if (!authRes.ok) {
    const msg = await authRes.text();
    throw new Error(
      `Falha ao autenticar na Pluggy (HTTP ${authRes.status}). Verifique se o Client ID e Client Secret estão corretos. Detalhe: ${msg}`,
    );
  }

  const data = (await authRes.json()) as PluggyAuthResponse;
  if (!data.apiKey) {
    throw new Error('A API da Pluggy não retornou um apiKey válido.');
  }
  return data.apiKey;
}

export async function createPluggyConnectToken(params: {
  clientId: string;
  clientSecret: string;
  itemIdToUpdate?: string;
}): Promise<string> {
  const apiKey = await authenticatePluggy(params.clientId, params.clientSecret);
  const bodyPayload: Record<string, string> = {};
  const ids = extractPluggyItemIds(params.itemIdToUpdate ?? '');
  if (ids.length > 0) {
    bodyPayload.itemId = ids[0];
  }

  const res = await fetch('https://api.pluggy.ai/connect_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro ao gerar Connect Token da Pluggy (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { accessToken?: string };
  if (!data.accessToken) {
    throw new Error('Pluggy não retornou accessToken no endpoint /connect_token.');
  }
  return data.accessToken;
}

export async function openPluggyConnectWidget(params: {
  clientId: string;
  clientSecret: string;
  existingItemId?: string;
  onItemConnected: (itemId: string, institutionName?: string) => void;
}): Promise<void> {
  if (!window.PluggyConnect) {
    throw new Error(
      'O script do Widget Pluggy Connect ainda não foi carregado pelo navegador. Verifique sua conexão ou recarregue a página.',
    );
  }

  const connectToken = await createPluggyConnectToken({
    clientId: params.clientId,
    clientSecret: params.clientSecret,
    itemIdToUpdate: params.existingItemId,
  });

  const ids = extractPluggyItemIds(params.existingItemId ?? '');

  return new Promise<void>((resolve, reject) => {
    const widget = new window.PluggyConnect!({
      connectToken,
      updateItem: ids[0],
      includeSandbox: true,
      onSuccess: (itemData) => {
        params.onItemConnected(itemData.item.id, itemData.item.connector?.name);
        resolve();
      },
      onError: (err) => {
        reject(new Error(err?.message || 'Erro durante a conexão no Widget Pluggy Connect.'));
      },
      onClose: () => {
        resolve();
      },
    });
    widget.init();
  });
}

export async function triggerPluggyItemRefresh(params: {
  clientId: string;
  clientSecret: string;
  itemId: string;
}): Promise<PluggyItemStatus> {
  const apiKey = await authenticatePluggy(params.clientId, params.clientSecret);
  const ids = extractPluggyItemIds(params.itemId);
  if (ids.length === 0) {
    throw new Error('Informe um Item ID válido para atualizar junto ao banco.');
  }

  const res = await fetch(`https://api.pluggy.ai/items/${encodeURIComponent(ids[0])}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Não foi possível solicitar atualização do Item (${res.status}): ${txt}`);
  }

  return (await res.json()) as PluggyItemStatus;
}

async function fetchAccountTransactionsAllPages(
  apiKey: string,
  accountId: string,
  fromDate?: string,
): Promise<PluggyRawTransaction[]> {
  const all: PluggyRawTransaction[] = [];

  // Tentativa 1: Endpoint paginado padrão /transactions (até 3 páginas de 500 = 1500 lançamentos)
  let page = 1;
  let totalPages = 1;

  while (page <= Math.min(totalPages, 3)) {
    const query = new URLSearchParams({
      accountId,
      pageSize: '500',
      page: String(page),
    });
    if (fromDate) query.set('from', fromDate);

    const res = await fetch(`https://api.pluggy.ai/transactions?${query.toString()}`, {
      headers: { 'X-API-KEY': apiKey },
    });

    if (!res.ok) {
      // Fallback para /v2/transactions caso /transactions retorne erro específico
      if (page === 1) {
        const v2Query = new URLSearchParams({ accountId });
        if (fromDate) v2Query.set('from', fromDate);
        const v2Res = await fetch(
          `https://api.pluggy.ai/v2/transactions?${v2Query.toString()}`,
          {
            headers: { 'X-API-KEY': apiKey },
          },
        );
        if (v2Res.ok) {
          const v2Json = (await v2Res.json()) as { results?: PluggyRawTransaction[] };
          return v2Json.results ?? [];
        }
        const errBody = await res.text();
        throw new Error(
          `Erro ao buscar transações da conta ${accountId} (${res.status}): ${errBody}`,
        );
      }
      break;
    }

    const json = (await res.json()) as {
      results?: PluggyRawTransaction[];
      totalPages?: number;
    };
    const batch = json.results ?? [];
    all.push(...batch);
    totalPages = json.totalPages ?? 1;
    if (batch.length === 0) break;
    page += 1;
  }

  return all;
}

function mapPluggyInvestmentToApp(
  raw: PluggyRawInvestment,
  institutionFallback: string,
): Omit<Investment, 'updatedAt'> {
  const upperName = `${raw.name} ${raw.code ?? ''} ${raw.subtype ?? ''}`.toUpperCase();
  const rateType = (raw.rateType ?? '').toUpperCase();

  let assetClass: AssetClass = 'renda_fixa_pos';
  let indexer: AssetIndexer = 'CDI';
  let liquidity = raw.dueDate
    ? `Vencimento ${raw.dueDate.slice(0, 10)}`
    : 'Liquidez conforme emissor (D+0/D+1)';
  let taxRule = 'Tabela Regressiva de IR (22,5% a 15%)';
  let educationalSummary =
    'Ativo sincronizado via Open Finance (Pluggy). Acompanhe a rentabilidade em relação ao CDI e o prazo de vencimento.';

  if (
    raw.type === 'EQUITY' ||
    upperName.includes('ACAO') ||
    upperName.includes('AÇÕES') ||
    upperName.includes('ON ') ||
    upperName.includes('PN ')
  ) {
    if (
      raw.subtype === 'REAL_ESTATE_FUND' ||
      upperName.includes('FII') ||
      upperName.includes('IMOB') ||
      /\b[A-Z]{4}11\b/.test(upperName)
    ) {
      assetClass = 'fiis';
      indexer = 'IFIX';
      liquidity = 'Bolsa B3 (D+2)';
      taxRule = 'Proventos mensais isentos de IR; 20% sobre ganho de capital na venda';
      educationalSummary =
        'Fundo Imobiliário sincronizado via Open Finance. Distribui rendimentos mensais isentos de Imposto de Renda para pessoa física.';
    } else {
      assetClass = 'acoes';
      indexer = 'IBOV';
      liquidity = 'Bolsa B3 (D+2)';
      taxRule = 'Isenção de IR em vendas até R$ 20 mil/mês; 15% acima disso';
      educationalSummary =
        'Ação listada na B3 sincronizada via Open Finance. Avalie fundamentos como P/L, ROE e Dividend Yield.';
    }
  } else if (
    raw.subtype === 'RETIREMENT' ||
    upperName.includes('PREVID') ||
    upperName.includes('PGBL') ||
    upperName.includes('VGBL')
  ) {
    assetClass = 'previdencia';
    indexer = 'CDI';
    liquidity = 'Longo Prazo / Aposentadoria';
    taxRule = 'Regime Progressivo ou Regressivo (até 10% após 10 anos)';
    educationalSummary =
      'Plano de Previdência sincronizado via Open Finance. No modelo PGBL permite deduzir até 12% da renda bruta tributável anual.';
  } else if (rateType.includes('IPCA') || upperName.includes('IPCA') || upperName.includes('NTN-B')) {
    assetClass = 'renda_fixa_ipca';
    indexer = 'IPCA';
    educationalSummary =
      'Este título protege seu poder de compra da inflação (IPCA) e paga uma taxa fixa adicional. Atenção: se você vendê-lo antes do vencimento, o valor pode oscilar devido à marcação a mercado.';
  } else if (upperName.includes('SELIC') || upperName.includes('LFT')) {
    assetClass = 'renda_fixa_pos';
    indexer = 'SELIC';
    liquidity = 'Liquidez Diária (D+1)';
    educationalSummary =
      'Título atrelado à taxa básica Selic com baixíssima oscilação. Ideal para compor sua Reserva de Emergência.';
  } else if (upperName.includes('LCI') || upperName.includes('LCA') || upperName.includes('CRI') || upperName.includes('CRA')) {
    assetClass = 'renda_fixa_pos';
    indexer = rateType.includes('IPCA') ? 'IPCA' : 'CDI';
    taxRule = 'Isento de Imposto de Renda para Pessoa Física';
    educationalSummary =
      'Título incentivado isento de IR para pessoa física. Sua taxa líquida supera CDBs de mesma taxa nominal.';
  } else if (rateType === 'PRE' || (raw.fixedAnnualRate && !raw.rate)) {
    assetClass = 'renda_fixa_pre';
    indexer = 'PREFIXADO';
  }

  let rateDescription = 'Taxa Pós-Fixada';
  if (raw.rate && raw.fixedAnnualRate) {
    rateDescription = `${raw.rate}% ${raw.rateType || 'CDI'} + ${raw.fixedAnnualRate}% a.a.`;
  } else if (raw.fixedAnnualRate && indexer === 'IPCA') {
    rateDescription = `IPCA + ${raw.fixedAnnualRate}% a.a.`;
  } else if (raw.rate) {
    rateDescription = `${raw.rate}% do ${raw.rateType || 'CDI'}`;
  } else if (raw.annualRate) {
    rateDescription = `${raw.annualRate.toFixed(2)}% a.a.`;
  }

  const currentValue = Math.max(0, Number(raw.balance ?? raw.amount ?? 0));
  const totalInvested = Math.max(
    0,
    Number(
      raw.amountOriginal ??
        (raw.amountProfit !== undefined ? currentValue - raw.amountProfit : currentValue),
    ),
  );
  const quantity = raw.quantity && raw.quantity > 0 ? Number(raw.quantity) : 1;
  const currentPrice =
    raw.value && raw.value > 0 ? Number(raw.value) : currentValue / Math.max(1, quantity);
  const averagePrice = totalInvested / Math.max(1, quantity);

  return {
    id: `inv-pluggy-${raw.id}`,
    ticker: (raw.code || raw.name.slice(0, 14)).toUpperCase().trim(),
    name: raw.name.trim(),
    assetClass,
    indexer,
    institution: raw.institution?.name || raw.issuer || institutionFallback,
    quantity: Number(quantity.toFixed(4)),
    averagePrice: Number(averagePrice.toFixed(2)),
    currentPrice: Number(currentPrice.toFixed(2)),
    totalInvested: Number(totalInvested.toFixed(2)),
    currentValue: Number(currentValue.toFixed(2)),
    rateDescription,
    liquidity,
    maturityDate: raw.dueDate ? raw.dueDate.slice(0, 10) : undefined,
    taxRule,
    educationalSummary,
  };
}

export async function syncBancoDoBrasilViaPluggy(params: {
  clientId: string;
  clientSecret: string;
  itemId: string;
  fromDate?: string;
}): Promise<PluggySyncResult> {
  const { clientId, clientSecret, itemId, fromDate } = params;
  const logs: string[] = [];

  const itemIds = extractPluggyItemIds(itemId);
  if (itemIds.length === 0) {
    throw new Error(
      'Nenhum Item ID da Pluggy configurado. Cole seu Item ID (UUID da conexão do Banco do Brasil) ou clique em "Abrir Widget Pluggy Connect" para conectar sua conta.',
    );
  }

  const apiKey = await authenticatePluggy(clientId, clientSecret);
  logs.push('✓ Autenticado na API da Pluggy com sucesso.');

  const itemsStatus: PluggyItemStatus[] = [];
  const mappedAccounts: Omit<BankAccount, 'updatedAt'>[] = [];
  const mappedTransactions: Omit<Transaction, 'id' | 'createdAt'>[] = [];
  const mappedInvestments: Omit<Investment, 'updatedAt'>[] = [];

  for (const currentItemId of itemIds) {
    // 1. Verifica metadados e status do Item
    let institutionName = 'Banco do Brasil';
    const itemRes = await fetch(
      `https://api.pluggy.ai/items/${encodeURIComponent(currentItemId)}`,
      {
        headers: { 'X-API-KEY': apiKey },
      },
    );

    if (itemRes.ok) {
      const itemMeta = (await itemRes.json()) as PluggyItemStatus;
      itemsStatus.push(itemMeta);
      if (itemMeta.connector?.name) {
        institutionName = itemMeta.connector.name;
      }
      logs.push(
        `✓ Conexão localizada: ${institutionName} (Status: ${itemMeta.status}${
          itemMeta.lastUpdatedAt
            ? `, atualizado em ${new Date(itemMeta.lastUpdatedAt).toLocaleString('pt-BR')}`
            : ''
        }).`,
      );
    } else if (itemRes.status === 404) {
      throw new Error(
        `O Item ID "${currentItemId}" não foi encontrado na sua conta Pluggy (HTTP 404). Verifique se o UUID pertence ao mesmo Client ID ou use o botão "Conectar Conta via Pluggy Connect".`,
      );
    }

    // 2. Busca todas as contas (Conta Corrente, Poupança e Cartão de Crédito)
    const accRes = await fetch(
      `https://api.pluggy.ai/accounts?itemId=${encodeURIComponent(currentItemId)}`,
      {
        headers: { 'X-API-KEY': apiKey },
      },
    );

    if (!accRes.ok) {
      const errTxt = await accRes.text();
      throw new Error(`Erro ao listar contas do Item ${currentItemId} (${accRes.status}): ${errTxt}`);
    }

    const accJson = (await accRes.json()) as { results?: PluggyRawAccount[] };
    const rawAccounts = accJson.results ?? [];
    logs.push(`✓ ${rawAccounts.length} conta(s)/cartão(ões) encontrados em ${institutionName}.`);

    for (const acc of rawAccounts) {
      const isCredit = acc.type === 'CREDIT';
      mappedAccounts.push({
        id: `acc-pluggy-${acc.id}`,
        name: acc.name || (isCredit ? 'Cartão Ourocard' : 'Conta Corrente BB'),
        institution: institutionName,
        type: isCredit ? 'CREDIT' : 'BANK',
        subtype: acc.subtype,
        number: acc.number,
        balance: Number(acc.balance ?? 0),
        creditLimit: acc.creditData?.creditLimit,
        availableCreditLimit: acc.creditData?.availableCreditLimit,
        currencyCode: acc.currencyCode || 'BRL',
        source: 'pluggy',
      });

      // 3. Busca transações da conta
      const rawTxs = await fetchAccountTransactionsAllPages(apiKey, acc.id, fromDate);
      logs.push(`  • Conta "${acc.name}": ${rawTxs.length} transação(ões) carregadas.`);

      for (const ptx of rawTxs) {
        const rawVal = Number(ptx.amountInAccountCurrency ?? ptx.amount ?? 0);
        if (!Number.isFinite(rawVal) || rawVal === 0) continue;

        // Em cartões de crédito na Pluggy, compras costumam vir positivas com type DEBIT;
        // em contas bancárias, saídas têm type DEBIT ou valor negativo.
        const isDebit = ptx.type === 'DEBIT' || (!ptx.type && rawVal < 0);
        const signed = isDebit ? -Math.abs(rawVal) : Math.abs(rawVal);
        const desc = (ptx.description || ptx.descriptionRaw || 'Movimentação BB').trim();
        const { category, type } = categorizeBancoDoBrasilTransaction(desc, signed);

        mappedTransactions.push({
          date: ptx.date.slice(0, 10),
          description: desc,
          amount: Math.abs(rawVal),
          type: isCredit && type === 'income' && isDebit ? 'expense' : type,
          category: ptx.category && category === 'Outros' ? ptx.category : category,
          account: `${institutionName} - ${acc.name}`,
          source: 'banco_do_brasil_open_finance',
          fitid: `PLUGGY-${ptx.id}`,
        });
      }
    }

    // 4. Busca Investimentos vinculados ao Item
    const invRes = await fetch(
      `https://api.pluggy.ai/investments?itemId=${encodeURIComponent(currentItemId)}`,
      {
        headers: { 'X-API-KEY': apiKey },
      },
    );

    if (invRes.ok) {
      const invJson = (await invRes.json()) as { results?: PluggyRawInvestment[] };
      const rawInvs = invJson.results ?? [];
      logs.push(`✓ ${rawInvs.length} ativo(s) de investimento sincronizados de ${institutionName}.`);
      for (const rInv of rawInvs) {
        if ((rInv.balance ?? rInv.amount ?? 0) <= 0) continue;
        mappedInvestments.push(mapPluggyInvestmentToApp(rInv, institutionName));
      }
    }
  }

  return {
    items: itemsStatus,
    accounts: mappedAccounts,
    transactions: mappedTransactions,
    investments: mappedInvestments,
    logs,
  };
}
