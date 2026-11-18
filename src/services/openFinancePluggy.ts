import { Transaction } from '../types/finance';
import { categorizeBancoDoBrasilTransaction } from './parsers/ofxParser';

interface PluggyAuthResponse {
  apiKey: string;
}

interface PluggyAccount {
  id: string;
  name: string;
  type: string;
  number?: string;
  balance: number;
}

interface PluggyTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: 'DEBIT' | 'CREDIT';
  category?: string;
}

export interface PluggySyncResult {
  accounts: PluggyAccount[];
  transactions: Omit<Transaction, 'id' | 'createdAt'>[];
}

export async function syncBancoDoBrasilViaPluggy(params: {
  clientId: string;
  clientSecret: string;
  itemId: string;
  fromDate?: string;
}): Promise<PluggySyncResult> {
  const { clientId, clientSecret, itemId, fromDate } = params;

  if (!clientId.trim() || !clientSecret.trim() || !itemId.trim()) {
    throw new Error(
      'Informe Client ID, Client Secret e Item ID da Pluggy na aba Configurações para sincronizar via Open Finance.',
    );
  }

  const authRes = await fetch('https://api.pluggy.ai/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    }),
  });

  if (!authRes.ok) {
    const msg = await authRes.text();
    throw new Error(`Falha de autenticação Pluggy Open Finance (${authRes.status}): ${msg}`);
  }

  const { apiKey } = (await authRes.json()) as PluggyAuthResponse;

  const accRes = await fetch(`https://api.pluggy.ai/accounts?itemId=${encodeURIComponent(itemId.trim())}`, {
    headers: { 'X-API-KEY': apiKey },
  });

  if (!accRes.ok) {
    throw new Error(`Erro ao listar contas Pluggy (${accRes.status})`);
  }

  const accJson = (await accRes.json()) as { results?: PluggyAccount[] };
  const accounts = accJson.results ?? [];
  const transactions: Omit<Transaction, 'id' | 'createdAt'>[] = [];

  for (const acc of accounts) {
    const query = new URLSearchParams({
      accountId: acc.id,
      pageSize: '200',
    });
    if (fromDate) query.set('from', fromDate);

    const txRes = await fetch(`https://api.pluggy.ai/transactions?${query.toString()}`, {
      headers: { 'X-API-KEY': apiKey },
    });
    if (!txRes.ok) continue;

    const txJson = (await txRes.json()) as { results?: PluggyTransaction[] };
    for (const ptx of txJson.results ?? []) {
      const signed = ptx.type === 'DEBIT' ? -Math.abs(ptx.amount) : Math.abs(ptx.amount);
      const { category, type } = categorizeBancoDoBrasilTransaction(ptx.description, signed);
      transactions.push({
        date: ptx.date.slice(0, 10),
        description: ptx.description,
        amount: Math.abs(ptx.amount),
        type,
        category,
        account: `BB Open Finance (${acc.name})`,
        source: 'banco_do_brasil_open_finance',
        fitid: `PLUGGY-${ptx.id}`,
      });
    }
  }

  return { accounts, transactions };
}
