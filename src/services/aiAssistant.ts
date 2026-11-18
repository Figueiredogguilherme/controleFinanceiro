import {
  AppSettings,
  BudgetGoal,
  FinancialSummary,
  Investment,
  Payslip,
  Transaction,
} from '../types/finance';
import { analyzePayslipFiscalOpportunity, formatBRL, formatPercent } from './financialEngine';

export interface GlossaryEntry {
  term: string;
  shortTitle: string;
  category: 'Renda Fixa' | 'Renda Variável' | 'Tributação & Previdência' | 'Indicadores';
  simpleExplanation: string;
  practicalExample: string;
}

export const FINANCIAL_GLOSSARY: GlossaryEntry[] = [
  {
    term: 'CDI',
    shortTitle: 'Certificado de Depósito Interbancário',
    category: 'Indicadores',
    simpleExplanation:
      'É a taxa de juros que os bancos cobram para emprestar dinheiro entre si por um dia. Na prática, caminha colada na taxa Selic (~0,10% abaixo) e serve como o principal termômetro da Renda Fixa no Brasil.',
    practicalExample:
      'Se o CDI está em 11,65% a.a., um CDB que paga 110% do CDI rende aproximadamente 12,81% ao ano antes do Imposto de Renda.',
  },
  {
    term: 'IPCA+',
    shortTitle: 'Inflação Oficial + Taxa Real Fixa',
    category: 'Renda Fixa',
    simpleExplanation:
      'Títulos IPCA+ garantem que seu dinheiro nunca perca poder de compra para a inflação oficial (IPCA) e ainda entregam uma taxa de juros real fixa acima dela.',
    practicalExample:
      'No Tesouro IPCA+ 2035 pagando IPCA + 6,42%, mesmo que a inflação suba para 8%, você receberá 8% + 6,42% compostos no vencimento.',
  },
  {
    term: 'Marcação a Mercado',
    shortTitle: 'Oscilação Diária do Preço do Título Antes do Vencimento',
    category: 'Renda Fixa',
    simpleExplanation:
      'É a atualização diária do preço pelo qual você conseguiria vender um título público (como Tesouro IPCA+ ou Prefixado) hoje no mercado. Se os juros futuros sobem, o preço do seu título cai temporariamente; se caem, o preço sobe.',
    practicalExample:
      'No Tesouro IPCA+ 2035, se você levar até 2035, recebe exatamente a taxa contratada. Mas se resgatar antes, pode ter ganho extra ou perda pontual por causa da marcação a mercado.',
  },
  {
    term: 'P/L',
    shortTitle: 'Preço sobre Lucro (Ações)',
    category: 'Renda Variável',
    simpleExplanation:
      'Indica em quantos anos o lucro atual de uma empresa pagaria o preço que você está pagando pela ação na Bolsa. Ajuda a comparar se uma ação está barata ou cara em relação ao seu histórico e pares.',
    practicalExample:
      'Uma ação negociada a R$ 30 que lucra R$ 5 por ação tem P/L = 6x. Empresas estáveis como bancos costumam ter P/L menor do que empresas de alto crescimento como WEGE3.',
  },
  {
    term: 'P/VP',
    shortTitle: 'Preço sobre Valor Patrimonial (FIIs e Ações)',
    category: 'Renda Variável',
    simpleExplanation:
      'Compara o valor de mercado da cota na B3 com o valor contábil dos imóveis/ativos do fundo ou empresa. P/VP = 1,00 indica preço justo patrimonial; abaixo de 1 pode sinalizar desconto.',
    practicalExample:
      'Se um FII tem patrimônio de R$ 100/cota e negocia a R$ 95, seu P/VP é 0,95 (desconto de 5%).',
  },
  {
    term: 'Dividend Yield (DY)',
    shortTitle: 'Retorno em Proventos sobre o Preço',
    category: 'Renda Variável',
    simpleExplanation:
      'Percentual pago em dividendos ou rendimentos nos últimos 12 meses dividido pelo preço atual do ativo. Em FIIs, os rendimentos mensais costumam ser isentos de IR para Pessoa Física.',
    practicalExample:
      'Um FII de R$ 100 que pagou R$ 10,80 nos últimos 12 meses possui DY de 10,8% ao ano isento de IR.',
  },
  {
    term: 'Tabela Regressiva IR',
    shortTitle: 'Imposto Decrescente com o Prazo da Aplicação',
    category: 'Tributação & Previdência',
    simpleExplanation:
      'Na Renda Fixa tributável (CDB, Tesouro Direto, Fundos DI), quanto mais tempo o dinheiro fica aplicado, menor a alíquota de IR sobre o rendimento: 22,5% (até 180 dias), 20% (181-360d), 17,5% (361-720d) e 15% (acima de 720 dias).',
    practicalExample:
      'Deixar um CDB por mais de 2 anos reduz o imposto sobre o lucro de 22,5% para 15%.',
  },
  {
    term: 'IOF',
    shortTitle: 'Imposto sobre Operações Financeiras (< 30 dias)',
    category: 'Tributação & Previdência',
    simpleExplanation:
      'Incide apenas sobre os rendimentos de aplicações resgatadas antes de completar 30 dias corridos, começando em 96% no 1º dia e chegando a 0% no 30º dia.',
    practicalExample:
      'Para reserva de giro de curtíssimo prazo (< 30 dias), LCI/LCA após carência ou contas sem IOF evitam perda tributária.',
  },
  {
    term: 'PGBL vs VGBL',
    shortTitle: 'Previdência Privada Corporativa (MBPrev)',
    category: 'Tributação & Previdência',
    simpleExplanation:
      'O PGBL permite deduzir aportes até o limite de 12% da renda bruta tributável anual na Declaração Completa de IR (adiando o imposto para o resgate futuro). O VGBL é indicado para quem faz Declaração Simplificada ou já ultrapassou os 12%.',
    practicalExample:
      'Na previdência da Mercedes-Benz (MBPrev), além da contrapartida da empresa, usar o limite de 12% no PGBL restitui até 27,5% desse valor no ajuste anual de IR.',
  },
  {
    term: 'FGC',
    shortTitle: 'Fundo Garantidor de Créditos',
    category: 'Renda Fixa',
    simpleExplanation:
      'Mecanismo privado que protege depósitos em conta, poupança, CDB, LCI e LCA até R$ 250 mil por CPF e por instituição financeira (teto global de R$ 1 milhão a cada 4 anos) em caso de quebra do banco.',
    practicalExample:
      'Títulos do Tesouro Direto não usam FGC porque já são garantidos diretamente pelo Tesouro Nacional (risco soberano).',
  },
];

export function getAssetEducationalInsight(inv: Investment): string {
  if (inv.educationalSummary) {
    return inv.educationalSummary;
  }
  const upperName = `${inv.ticker} ${inv.name}`.toUpperCase();
  if (upperName.includes('IPCA')) {
    return 'Este título protege seu poder de compra da inflação (IPCA) e paga uma taxa fixa adicional. Atenção: se você vendê-lo antes do vencimento, o valor pode oscilar devido à marcação a mercado.';
  }
  if (upperName.includes('SELIC')) {
    return 'Título público pós-fixado atrelado à taxa Selic com liquidez diária e baixíssima marcação a mercado. Ideal para Reserva de Emergência.';
  }
  if (inv.assetClass === 'fiis') {
    return 'Fundo de Investimento Imobiliário negociado na B3. Gera renda passiva mensal (geralmente isenta de IR) e tem oscilação de cota conforme juros e vacância dos imóveis.';
  }
  if (inv.assetClass === 'acoes') {
    return 'Participação societária em empresa listada na B3. Avalie múltiplos como P/L, ROE e payout de dividendos pensando em horizonte de longo prazo.';
  }
  if (inv.assetClass === 'previdencia') {
    return 'Previdência corporativa com potencial benefício fiscal de até 12% da renda bruta no modelo PGBL e contrapartida patronal.';
  }
  if (inv.assetClass === 'cripto') {
    return 'Ativo digital de alta volatilidade e correlação global. Recomenda-se manter em percentual controlado dentro da carteira.';
  }
  return 'Ativo de renda fixa atrelado ao CDI/Prefixado. Verifique prazo de vencimento, alíquota regressiva de IR e cobertura do FGC.';
}

export interface ProactiveInsight {
  id: string;
  severity: 'good' | 'info' | 'warning';
  title: string;
  message: string;
  actionLabel?: string;
}

export function generateProactiveInsights(params: {
  summary: FinancialSummary;
  transactions: Transaction[];
  payslips: Payslip[];
  investments: Investment[];
  budgetGoals: BudgetGoal[];
}): ProactiveInsight[] {
  const { summary, transactions, payslips, investments, budgetGoals } = params;
  const insights: ProactiveInsight[] = [];

  if (summary.monthlyIncome > 0) {
    if (summary.savingsRate >= 25) {
      insights.push({
        id: 'ins-savings-strong',
        severity: 'good',
        title: `Taxa de poupança sólida: ${formatPercent(summary.savingsRate, 1)}`,
        message: `Você está retendo cerca de ${formatBRL(summary.monthlyIncome - summary.monthlyExpenses)} sobre sua receita mensal líquida (${summary.activeMonthLabel}). Esse ritmo acelera sua independência financeira.`,
      });
    } else if (summary.savingsRate < 15) {
      insights.push({
        id: 'ins-savings-low',
        severity: 'warning',
        title: `Margem de poupança em ${formatPercent(summary.savingsRate, 1)} (${summary.activeMonthLabel})`,
        message:
          'Suas despesas mensais no Banco do Brasil estão consumindo mais de 85% das entradas líquidas. Tente mirar em pelo menos 20% de aporte mensal recorrente.',
      });
    }
  }

  if (summary.emergencyFundMonths >= 6) {
    insights.push({
      id: 'ins-emergency-ok',
      severity: 'good',
      title: `Reserva de emergência robusta (${summary.emergencyFundMonths.toFixed(1).replace('.', ',')} meses)`,
      message: `Você possui ${formatBRL(summary.liquidReserves)} em caixa + ativos de liquidez diária (Tesouro Selic / CDB DI), cobrindo mais de 6 meses do seu padrão de gastos.`,
    });
  } else {
    insights.push({
      id: 'ins-emergency-warn',
      severity: 'warning',
      title: `Reserva de liquidez em ${summary.emergencyFundMonths.toFixed(1).replace('.', ',')} meses`,
      message: `Seus recursos de liquidez imediata somam ${formatBRL(summary.liquidReserves)}. Priorize completar 6 meses de despesas antes de aumentar risco em renda variável.`,
    });
  }

  const latestPayslip = payslips[0] ?? null;
  const fiscal = analyzePayslipFiscalOpportunity(latestPayslip);
  if (fiscal && latestPayslip) {
    if (fiscal.currentPgblPercentOfGross < 10) {
      insights.push({
        id: 'ins-mbprev-pgbl',
        severity: 'info',
        title: 'Oportunidade tributária no Holerite Mercedes-Benz (PGBL 12%)',
        message: `Seu holerite de ${latestPayslip.competence} mostra desconto de ${formatBRL(latestPayslip.privatePensionAmount)} (${formatPercent(fiscal.currentPgblPercentOfGross, 1)} do bruto) em previdência e ${formatBRL(latestPayslip.irrfAmount)} de IRRF. Caso declare IR no modelo completo, aportes adicionais de até ${formatBRL(fiscal.recommendedExtraMonthlyPgbl)}/mês em PGBL podem gerar economia fiscal estimada de ${formatBRL(fiscal.estimatedAnnualTaxSavings)}/ano.`,
      });
    }
  }

  const latestMonth = summary.activeMonthLabel;
  if (latestMonth) {
    const spentByCat = new Map<string, number>();
    transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(latestMonth))
      .forEach((t) => {
        spentByCat.set(t.category, (spentByCat.get(t.category) ?? 0) + t.amount);
      });

    for (const goal of budgetGoals) {
      const spent = spentByCat.get(goal.category) ?? 0;
      if (spent > goal.monthlyLimit) {
        insights.push({
          id: `ins-budget-${goal.category}`,
          severity: 'warning',
          title: `Orçamento excedido em ${goal.category} (${latestMonth})`,
          message: `Você gastou ${formatBRL(spent)} frente a uma meta mensal de ${formatBRL(goal.monthlyLimit)} (+${formatBRL(spent - goal.monthlyLimit)}).`,
        });
      }
    }
  }

  if (summary.totalPortfolioValue > 0) {
    const rfTotal = investments
      .filter((i) => i.assetClass.startsWith('renda_fixa'))
      .reduce((acc, i) => acc + i.currentValue, 0);
    const ipcaTotal = investments
      .filter((i) => i.assetClass === 'renda_fixa_ipca')
      .reduce((acc, i) => acc + i.currentValue, 0);
    const rvTotal = investments
      .filter((i) => i.assetClass === 'acoes' || i.assetClass === 'fiis')
      .reduce((acc, i) => acc + i.currentValue, 0);

    const rfPct = (rfTotal / summary.totalPortfolioValue) * 100;
    const rvPct = (rvTotal / summary.totalPortfolioValue) * 100;
    const ipcaPct = (ipcaTotal / summary.totalPortfolioValue) * 100;

    insights.push({
      id: 'ins-allocation-balance',
      severity: 'info',
      title: `Equilíbrio da Carteira: ${formatPercent(rfPct, 0)} Renda Fixa / ${formatPercent(rvPct, 0)} Renda Variável`,
      message: `Sua proteção inflacionária (IPCA+) representa ${formatPercent(ipcaPct, 1)} do patrimônio (${formatBRL(ipcaTotal)}). Lembre-se de que títulos IPCA+ longos sofrem marcação a mercado se vendidos antes do vencimento.`,
    });
  }

  return insights;
}

function buildContextPrompt(params: {
  summary: FinancialSummary;
  transactions: Transaction[];
  payslips: Payslip[];
  investments: Investment[];
  settings: AppSettings;
}): string {
  const { summary, transactions, payslips, investments, settings } = params;
  const latestPay = payslips[0];

  const catTotals = new Map<string, number>();
  transactions
    .filter((t) => t.type === 'expense')
    .slice(0, 80)
    .forEach((t) => {
      catTotals.set(t.category, (catTotals.get(t.category) ?? 0) + t.amount);
    });

  const topCategories = Array.from(catTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([cat, val]) => `${cat}: ${formatBRL(val)}`)
    .join(', ');

  const portfolioLines = investments
    .map(
      (i) =>
        `- ${i.ticker} (${i.name}, classe ${i.assetClass}, taxa ${i.rateDescription}): ${formatBRL(i.currentValue)}`,
    )
    .join('\n');

  return `Você é um Consultor Sênior de Finanças Pessoais e Investimentos brasileiro, técnico e didático.
Responda em Português do Brasil, com clareza, explicando conceitos econômicos (como CDI, IPCA+, marcação a mercado, P/L, IR regressivo, PGBL) sempre de forma simples, estruturada e objetiva.

CONTEXTO FINANCEIRO ATUAL DO USUÁRIO (${settings.userName}):
- Parâmetros Macro: Selic ${settings.benchmarkSelic}% a.a. | CDI ${settings.benchmarkCdi}% a.a. | IPCA ${settings.benchmarkIpca}% a.a.
- Saldo em Contas Correntes BB: ${formatBRL(summary.totalBankBalance)} | Fatura Cartões: ${formatBRL(summary.totalCreditCardDebt)} | Patrimônio Líquido Total: ${formatBRL(summary.netWorth)}.
- Último Holerite (${latestPay?.employer ?? 'Mercedes-Benz'} - ${latestPay?.competence ?? 'N/A'}): Bruto ${formatBRL(latestPay?.grossSalary ?? 0)}, INSS ${formatBRL(latestPay?.inssAmount ?? 0)}, IRRF ${formatBRL(latestPay?.irrfAmount ?? 0)}, Previdência Privada ${formatBRL(latestPay?.privatePensionAmount ?? 0)}, Líquido ${formatBRL(latestPay?.netSalary ?? 0)}.
- Fluxo de Caixa Mês Recente (${summary.activeMonthLabel}): Receita ${formatBRL(summary.monthlyIncome)} | Despesas ${formatBRL(summary.monthlyExpenses)} | Taxa de Poupança ${formatPercent(summary.savingsRate, 1)}.
- Maiores Categorias de Despesa Recentes: ${topCategories || 'Sem despesas'}.
- Reserva de Liquidez Diária: ${formatBRL(summary.liquidReserves)} (~${summary.emergencyFundMonths.toFixed(1)} meses de despesas).
- Patrimônio Investido Total: ${formatBRL(summary.totalPortfolioValue)} (Custo: ${formatBRL(summary.totalPortfolioInvested)}, Lucro: ${formatBRL(summary.portfolioGain)}).
- Carteira Detalhada:
${portfolioLines || 'Sem ativos cadastrados.'}
`;
}

function buildLocalFallbackAnswer(
  question: string,
  params: {
    summary: FinancialSummary;
    payslips: Payslip[];
    investments: Investment[];
  },
): string {
  const q = question.toLowerCase();
  const { summary, payslips, investments } = params;

  for (const entry of FINANCIAL_GLOSSARY) {
    if (q.includes(entry.term.toLowerCase()) || q.includes(entry.shortTitle.toLowerCase())) {
      return `**${entry.term} — ${entry.shortTitle}**\n\n${entry.simpleExplanation}\n\n💡 *Exemplo prático:* ${entry.practicalExample}`;
    }
  }

  if (q.includes('marca') || q.includes('2035') || q.includes('ipca')) {
    const ipcaAsset = investments.find((i) => i.assetClass === 'renda_fixa_ipca');
    return `**Sobre Títulos IPCA+ e Marcação a Mercado:**\n\n${
      ipcaAsset
        ? `Você possui **${formatBRL(ipcaAsset.currentValue)}** em **${ipcaAsset.name}** (${ipcaAsset.rateDescription}).\n\n`
        : ''
    }Este título protege seu poder de compra da inflação (IPCA) e paga uma taxa fixa adicional. Atenção: se você vendê-lo antes do vencimento, o valor pode oscilar devido à marcação a mercado. Levando até a data de vencimento, você recebe exatamente a rentabilidade contratada.`;
  }

  if (q.includes('holerite') || q.includes('mercedes') || q.includes('irrf') || q.includes('pgbl')) {
    const latest = payslips[0];
    if (!latest) {
      return 'Nenhum holerite da Mercedes-Benz foi importado ainda. Vá até a aba **Holerite MB & Extrato BB** para carregar o PDF ou gerar um demonstrativo de teste.';
    }
    const fiscal = analyzePayslipFiscalOpportunity(latest);
    return `**Análise do Holerite ${latest.employer} (${latest.competence}):**\n- **Salário Bruto:** ${formatBRL(latest.grossSalary)}\n- **Descontos:** ${formatBRL(latest.totalDeductions)} (INSS ${formatBRL(latest.inssAmount)} + IRRF ${formatBRL(latest.irrfAmount)} + Previdência ${formatBRL(latest.privatePensionAmount)})\n- **Salário Líquido:** ${formatBRL(latest.netSalary)}\n\n${
      fiscal
        ? `💡 *Dica Fiscal (PGBL):* Você destina hoje **${formatPercent(fiscal.currentPgblPercentOfGross, 1)}** do bruto para previdência. Na Declaração Completa do IR, aportes em PGBL de até 12% da renda bruta tributável permitem abater a base de cálculo, gerando economia estimada de até **${formatBRL(fiscal.estimatedAnnualTaxSavings)}/ano** com o aporte complementar sugerido de ${formatBRL(fiscal.recommendedExtraMonthlyPgbl)}/mês.`
        : ''
    }`;
  }

  return `**Resumo Analítico Local (Sem Chave Externa Ativa):**\n\nSeu patrimônio líquido consolidado é de **${formatBRL(summary.netWorth)}** (Carteira de Investimentos: **${formatBRL(summary.totalPortfolioValue)}**, Saldo Bancário: **${formatBRL(summary.totalBankBalance)}**), com reserva de liquidez cobrindo **${summary.emergencyFundMonths.toFixed(1)} meses** de despesas e taxa de poupança de **${formatPercent(summary.savingsRate, 1)}**.\n\nPara respostas conversacionais ilimitadas sobre sua carteira, ative sua chave gratuita do **Google Gemini** na aba **Conexões & Guias** (leva 30 segundos no Google AI Studio).`;
}

async function discoverAvailableGeminiModel(
  apiKey: string,
  preferredModel: string,
): Promise<string> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    );
    if (!res.ok) return preferredModel;
    const data = (await res.json()) as {
      models?: { name: string; supportedGenerationMethods?: string[] }[];
    };
    const available = (data.models ?? [])
      .filter((m) =>
        (m.supportedGenerationMethods ?? []).includes('generateContent'),
      )
      .map((m) => m.name.replace(/^models\//, ''));

    if (available.includes(preferredModel)) return preferredModel;

    const priorityOrder = [
      'gemini-3.8-flash',
      'gemini-3.5-flash-lite',
      'gemini-4-argon',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
    ];
    for (const candidate of priorityOrder) {
      const match = available.find((a) => a === candidate || a.startsWith(candidate));
      if (match) return match;
    }
    return available.find((a) => a.includes('gemini')) || preferredModel;
  } catch {
    return preferredModel;
  }
}

async function callGeminiGenerateContent(params: {
  apiKey: string;
  model: string;
  contents: { role: string; parts: { text: string }[] }[];
}): Promise<{ text: string; modelUsed: string }> {
  const { apiKey, model, contents } = params;

  const tryCall = async (targetModel: string) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      targetModel,
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
      }),
    });
  };

  let usedModel = model.trim() || 'gemini-3.8-flash';
  let res = await tryCall(usedModel);

  // Caso o modelo específico retorne 404 na conta do usuário, descobre automaticamente um modelo compatível
  if (res.status === 404 || res.status === 400) {
    const discovered = await discoverAvailableGeminiModel(apiKey, usedModel);
    if (discovered !== usedModel) {
      usedModel = discovered;
      res = await tryCall(usedModel);
    }
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro na API Gemini (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? '')
    .join('')
    .trim();

  if (!text) {
    throw new Error('A API Gemini retornou uma resposta vazia.');
  }
  return { text, modelUsed: usedModel };
}

export async function testAiProviderConnection(settings: AppSettings): Promise<{
  ok: boolean;
  providerUsed: string;
  sampleReply: string;
}> {
  if (settings.llmProvider === 'gemini') {
    if (!settings.geminiApiKey.trim()) {
      throw new Error('Informe sua Google Gemini API Key antes de testar.');
    }
    const { text, modelUsed } = await callGeminiGenerateContent({
      apiKey: settings.geminiApiKey.trim(),
      model: settings.geminiModel.trim() || 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'Responda em uma única frase curta em português confirmando que a conexão com o Consultor Financeiro está ativa.',
            },
          ],
        },
      ],
    });
    return {
      ok: true,
      providerUsed: `Google Gemini (${modelUsed})`,
      sampleReply: text,
    };
  }

  if (settings.llmProvider === 'openai') {
    if (!settings.openaiApiKey.trim()) {
      throw new Error('Informe sua OpenAI API Key antes de testar.');
    }
    const model = settings.openaiModel.trim() || 'gpt-4o-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.openaiApiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content:
              'Responda em uma única frase curta em português confirmando que a conexão com o Consultor Financeiro está ativa.',
          },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Erro na API OpenAI (${res.status}): ${errText}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return {
      ok: true,
      providerUsed: `OpenAI (${model})`,
      sampleReply: data.choices?.[0]?.message?.content ?? 'Conexão OpenAI verificada!',
    };
  }

  return {
    ok: true,
    providerUsed: 'Motor Analítico Local',
    sampleReply:
      'Modo Analítico Local ativo! Para usar IA generativa completa, selecione Google Gemini ou OpenAI e insira sua chave.',
  };
}

export async function askFinancialAssistant(params: {
  question: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  summary: FinancialSummary;
  transactions: Transaction[];
  payslips: Payslip[];
  investments: Investment[];
  settings: AppSettings;
}): Promise<{ answer: string; providerUsed: string }> {
  const { question, history, settings } = params;
  const systemContext = buildContextPrompt(params);

  // Se o usuário preencheu a chave Gemini mesmo esquecendo de mudar o seletor de local_only, usa Gemini automaticamente
  const effectiveProvider =
    settings.llmProvider === 'local_only' && settings.geminiApiKey.trim()
      ? 'gemini'
      : settings.llmProvider === 'local_only' && settings.openaiApiKey.trim()
        ? 'openai'
        : settings.llmProvider;

  if (effectiveProvider === 'gemini' && settings.geminiApiKey.trim()) {
    const contents = [
      ...history.slice(-6).map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
      {
        role: 'user',
        parts: [{ text: `${systemContext}\n\nPergunta do usuário: ${question}` }],
      },
    ];

    const { text, modelUsed } = await callGeminiGenerateContent({
      apiKey: settings.geminiApiKey.trim(),
      model: settings.geminiModel,
      contents,
    });

    return { answer: text, providerUsed: `Google Gemini (${modelUsed})` };
  }

  if (effectiveProvider === 'openai' && settings.openaiApiKey.trim()) {
    const model = settings.openaiModel.trim() || 'gpt-4o-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.openaiApiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemContext },
          ...history.slice(-6),
          { role: 'user', content: question },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Erro na API OpenAI (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('A API OpenAI retornou uma resposta vazia.');
    }
    return { answer: text, providerUsed: `OpenAI (${model})` };
  }

  return {
    answer: buildLocalFallbackAnswer(question, params),
    providerUsed: 'Motor Analítico Local (Sem API Externa)',
  };
}
