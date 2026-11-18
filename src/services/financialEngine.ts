import { Payslip } from '../types/finance';

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatPercent(value: number, decimals: number = 2): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(decimals).replace('.', ',')}%`;
}

export function getRegressiveIrRate(days: number): number {
  if (days <= 180) return 0.225;
  if (days <= 360) return 0.2;
  if (days <= 720) return 0.175;
  return 0.15;
}

const IOF_TABLE_PERCENT = [
  96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50,
  46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3,
];

export function getIofRateForDays(days: number): number {
  if (days <= 0) return 0.96;
  if (days >= 30) return 0;
  return (IOF_TABLE_PERCENT[days - 1] ?? 0) / 100;
}

export function computeCdbEquivalentPercent(lciCdiPercent: number, horizonDays: number): number {
  const irRate = getRegressiveIrRate(horizonDays);
  return lciCdiPercent / (1 - irRate);
}

export interface SimulatorInput {
  initialAmount: number;
  monthlyContribution: number;
  years: number;
  cdiAnnual: number; // % a.a.
  ipcaAnnual: number; // % a.a.
  cdbPctCdi: number; // % do CDI (ex: 100 ou 110)
  lciPctCdi: number; // % do CDI isento (ex: 92)
  tesouroIpcaRealRate: number; // % real acima do IPCA (ex: 6.3)
  mixedFiisPct: number; // % da carteira mista em FIIs
  mixedSelicPct: number; // % da carteira mista em Tesouro Selic
  mixedEquitiesPct: number; // % da carteira mista em Ações
  fiisAnnualReturn: number; // % nominal a.a. (dividendos + cota)
  equitiesAnnualReturn: number; // % nominal a.a.
  applyIncomeTax: boolean;
  shortTermDaysForIofCheck?: number; // Se < 30 dias, exibe alerta de IOF
}

export interface SimulationYearlyPoint {
  year: number;
  label: string;
  totalInvested: number;
  cdbGross: number;
  cdbNetNominal: number;
  cdbNetReal: number;
  lciNetNominal: number;
  lciNetReal: number;
  ipcaNetNominal: number;
  ipcaNetReal: number;
  mixedNetNominal: number;
  mixedNetReal: number;
}

export interface ScenarioFinalSummary {
  id: 'cdb' | 'lci' | 'ipca' | 'mixed';
  name: string;
  subtitle: string;
  totalInvested: number;
  grossValue: number;
  taxPaid: number;
  netNominalValue: number;
  netRealValue: number;
  realGainValue: number;
  nominalReturnPct: number;
  realReturnPct: number;
  estimatedMonthlyRealIncome: number;
}

export interface SimulationOutput {
  points: SimulationYearlyPoint[];
  summaries: ScenarioFinalSummary[];
  irRateApplied: number;
  iofWarningRate: number;
  equivalentCdbForLciPct: number;
}

function compoundMonthly(
  initial: number,
  monthly: number,
  months: number,
  annualRateDecimal: number,
): number {
  const monthlyRate = Math.pow(1 + annualRateDecimal, 1 / 12) - 1;
  let balance = initial;
  for (let m = 0; m < months; m++) {
    balance = balance * (1 + monthlyRate) + monthly;
  }
  return balance;
}

export function simulateInvestmentScenarios(input: SimulatorInput): SimulationOutput {
  const years = Math.max(1, Math.min(40, Math.round(input.years)));
  const totalDays = years * 365;
  const irRate = input.applyIncomeTax ? getRegressiveIrRate(totalDays) : 0;
  const iofRate =
    input.shortTermDaysForIofCheck && input.shortTermDaysForIofCheck < 30
      ? getIofRateForDays(input.shortTermDaysForIofCheck)
      : 0;

  const cdiDec = input.cdiAnnual / 100;
  const ipcaDec = input.ipcaAnnual / 100;

  const cdbAnnualDec = cdiDec * (input.cdbPctCdi / 100);
  const lciAnnualDec = cdiDec * (input.lciPctCdi / 100);
  const ipcaAnnualDec = (1 + ipcaDec) * (1 + input.tesouroIpcaRealRate / 100) - 1;

  // Normaliza pesos da carteira mista caso não somem 100%
  const weightSum = Math.max(
    1,
    input.mixedFiisPct + input.mixedSelicPct + input.mixedEquitiesPct,
  );
  const wFiis = input.mixedFiisPct / weightSum;
  const wSelic = input.mixedSelicPct / weightSum;
  const wEq = input.mixedEquitiesPct / weightSum;

  const fiisDec = input.fiisAnnualReturn / 100;
  const selicDec = cdiDec; // Selic ~ CDI
  const eqDec = input.equitiesAnnualReturn / 100;

  const points: SimulationYearlyPoint[] = [];

  for (let y = 0; y <= years; y++) {
    const months = y * 12;
    const totalInvested = input.initialAmount + input.monthlyContribution * months;
    const inflationFactor = Math.pow(1 + ipcaDec, y);
    const yearIr = input.applyIncomeTax ? getRegressiveIrRate(Math.max(1, y * 365)) : 0;

    // 1. CDB
    const cdbGross = compoundMonthly(
      input.initialAmount,
      input.monthlyContribution,
      months,
      cdbAnnualDec,
    );
    const cdbGain = Math.max(0, cdbGross - totalInvested);
    const cdbNetNominal = totalInvested + cdbGain * (1 - yearIr);
    const cdbNetReal = cdbNetNominal / inflationFactor;

    // 2. LCI / LCA (Isento de IR)
    const lciGross = compoundMonthly(
      input.initialAmount,
      input.monthlyContribution,
      months,
      lciAnnualDec,
    );
    const lciNetNominal = lciGross;
    const lciNetReal = lciNetNominal / inflationFactor;

    // 3. Tesouro IPCA+
    const ipcaGross = compoundMonthly(
      input.initialAmount,
      input.monthlyContribution,
      months,
      ipcaAnnualDec,
    );
    const ipcaGain = Math.max(0, ipcaGross - totalInvested);
    const ipcaNetNominal = totalInvested + ipcaGain * (1 - yearIr);
    const ipcaNetReal = ipcaNetNominal / inflationFactor;

    // 4. Carteira Mista (FIIs: ~80% do retorno via dividendos isentos + 20% ganho cota 20%; Selic: IR regressivo; Ações: 15% sobre lucro se >20k/mês)
    const fiisGross = compoundMonthly(
      input.initialAmount * wFiis,
      input.monthlyContribution * wFiis,
      months,
      fiisDec,
    );
    const selicGross = compoundMonthly(
      input.initialAmount * wSelic,
      input.monthlyContribution * wSelic,
      months,
      selicDec,
    );
    const eqGross = compoundMonthly(
      input.initialAmount * wEq,
      input.monthlyContribution * wEq,
      months,
      eqDec,
    );

    const fiisInvested = totalInvested * wFiis;
    const selicInvested = totalInvested * wSelic;
    const eqInvested = totalInvested * wEq;

    const fiisTax = input.applyIncomeTax
      ? Math.max(0, fiisGross - fiisInvested) * 0.2 * 0.25 // Apenas parcela de valorização de cota paga 20%; proventos são isentos
      : 0;
    const selicTax = input.applyIncomeTax
      ? Math.max(0, selicGross - selicInvested) * yearIr
      : 0;
    const eqTax = input.applyIncomeTax
      ? Math.max(0, eqGross - eqInvested) * 0.15 * 0.65 // Considerando parte de dividendos isentos
      : 0;

    const mixedGross = fiisGross + selicGross + eqGross;
    const mixedNetNominal = mixedGross - (fiisTax + selicTax + eqTax);
    const mixedNetReal = mixedNetNominal / inflationFactor;

    points.push({
      year: y,
      label: y === 0 ? 'Hoje' : `Ano ${y}`,
      totalInvested: Number(totalInvested.toFixed(2)),
      cdbGross: Number(cdbGross.toFixed(2)),
      cdbNetNominal: Number(cdbNetNominal.toFixed(2)),
      cdbNetReal: Number(cdbNetReal.toFixed(2)),
      lciNetNominal: Number(lciNetNominal.toFixed(2)),
      lciNetReal: Number(lciNetReal.toFixed(2)),
      ipcaNetNominal: Number(ipcaNetNominal.toFixed(2)),
      ipcaNetReal: Number(ipcaNetReal.toFixed(2)),
      mixedNetNominal: Number(mixedNetNominal.toFixed(2)),
      mixedNetReal: Number(mixedNetReal.toFixed(2)),
    });
  }

  const last = points[points.length - 1];
  const finalInflationFactor = Math.pow(1 + ipcaDec, years);

  // Recalcula valores finais brutos exatos da Carteira Mista
  const months = years * 12;
  const mixedFinalGross =
    compoundMonthly(input.initialAmount * wFiis, input.monthlyContribution * wFiis, months, fiisDec) +
    compoundMonthly(input.initialAmount * wSelic, input.monthlyContribution * wSelic, months, selicDec) +
    compoundMonthly(input.initialAmount * wEq, input.monthlyContribution * wEq, months, eqDec);

  const ipcaFinalGross = compoundMonthly(
    input.initialAmount,
    input.monthlyContribution,
    months,
    ipcaAnnualDec,
  );

  // Renda mensal perpétua sustentável estimada a 0,5% real ao mês (regra conservadora ~6% real a.a.)
  const monthlySafeYield = 0.005;

  const makeSummary = (
    id: ScenarioFinalSummary['id'],
    name: string,
    subtitle: string,
    gross: number,
    netNominal: number,
    netReal: number,
  ): ScenarioFinalSummary => {
    const taxPaid = Math.max(0, gross - netNominal);
    const realGainValue = netReal - last.totalInvested / finalInflationFactor;
    return {
      id,
      name,
      subtitle,
      totalInvested: last.totalInvested,
      grossValue: Number(gross.toFixed(2)),
      taxPaid: Number(taxPaid.toFixed(2)),
      netNominalValue: Number(netNominal.toFixed(2)),
      netRealValue: Number(netReal.toFixed(2)),
      realGainValue: Number(realGainValue.toFixed(2)),
      nominalReturnPct:
        last.totalInvested > 0 ? ((netNominal - last.totalInvested) / last.totalInvested) * 100 : 0,
      realReturnPct:
        last.totalInvested > 0
          ? ((netReal * finalInflationFactor - last.totalInvested) / last.totalInvested) * 100
          : 0,
      estimatedMonthlyRealIncome: Number((netReal * monthlySafeYield).toFixed(2)),
    };
  };

  const summaries: ScenarioFinalSummary[] = [
    makeSummary(
      'cdb',
      `CDB ${input.cdbPctCdi}% CDI`,
      `Tributado (IR ${(irRate * 100).toFixed(1).replace('.', ',')}% s/ lucro)`,
      last.cdbGross,
      last.cdbNetNominal,
      last.cdbNetReal,
    ),
    makeSummary(
      'lci',
      `LCI / LCA ${input.lciPctCdi}% CDI`,
      'Isento de IR para Pessoa Física',
      last.lciNetNominal,
      last.lciNetNominal,
      last.lciNetReal,
    ),
    makeSummary(
      'ipca',
      `Tesouro IPCA+ ${input.tesouroIpcaRealRate.toFixed(1).replace('.', ',')}%`,
      `Protege da inflação (${input.ipcaAnnual.toFixed(1)}% a.a.) + juros reais`,
      ipcaFinalGross,
      last.ipcaNetNominal,
      last.ipcaNetReal,
    ),
    makeSummary(
      'mixed',
      'Carteira Mista (FIIs + Selic + Ações)',
      `${input.mixedFiisPct}% FIIs · ${input.mixedSelicPct}% Selic · ${input.mixedEquitiesPct}% Ações`,
      mixedFinalGross,
      last.mixedNetNominal,
      last.mixedNetReal,
    ),
  ];

  return {
    points,
    summaries,
    irRateApplied: irRate,
    iofWarningRate: iofRate,
    equivalentCdbForLciPct: computeCdbEquivalentPercent(input.lciPctCdi, totalDays),
  };
}

export interface PayslipFiscalAnalysis {
  effectiveDiscountRate: number;
  effectiveIrrfRate: number;
  currentPgblPercentOfGross: number;
  maxPgblDeductibleAnnual: number;
  recommendedExtraMonthlyPgbl: number;
  estimatedAnnualTaxSavings: number;
}

export function analyzePayslipFiscalOpportunity(payslip: Payslip | null): PayslipFiscalAnalysis | null {
  if (!payslip || payslip.grossSalary <= 0) return null;

  const effectiveDiscountRate = (payslip.totalDeductions / payslip.grossSalary) * 100;
  const effectiveIrrfRate = (payslip.irrfAmount / payslip.grossSalary) * 100;
  const currentPgblPercentOfGross = (payslip.privatePensionAmount / payslip.grossSalary) * 100;

  const annualGrossEstimate = payslip.grossSalary * 13.33; // 12 salários + 13º + férias
  const maxPgblDeductibleAnnual = annualGrossEstimate * 0.12;
  const currentAnnualPgbl = payslip.privatePensionAmount * 12;
  const remainingAnnualAllowance = Math.max(0, maxPgblDeductibleAnnual - currentAnnualPgbl);
  const recommendedExtraMonthlyPgbl = remainingAnnualAllowance / 12;

  // Alíquota marginal típica de IRRF 27,5% na faixa salarial corporativa
  const marginalIrRate = payslip.irrfAmount > 800 ? 0.275 : 0.15;
  const estimatedAnnualTaxSavings = remainingAnnualAllowance * marginalIrRate;

  return {
    effectiveDiscountRate,
    effectiveIrrfRate,
    currentPgblPercentOfGross,
    maxPgblDeductibleAnnual,
    recommendedExtraMonthlyPgbl,
    estimatedAnnualTaxSavings,
  };
}
