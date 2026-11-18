import { describe, expect, it } from 'vitest';
import {
  parseBancoDoBrasilCsv,
  parseBancoDoBrasilOfx,
} from '../parsers/ofxParser';
import { parseMercedesPayslipText } from '../parsers/payslipPdfParser';
import {
  generateSampleBbOfx,
  generateSampleMercedesPayslipText,
} from '../parsers/sampleGenerator';
import {
  computeCdbEquivalentPercent,
  getIofRateForDays,
  getRegressiveIrRate,
  simulateInvestmentScenarios,
} from '../financialEngine';
import {
  buildFolderSearchQuery,
  buildMultipartDrivePayload,
  DEFAULT_DB_FILENAME,
  DEFAULT_DRIVE_FOLDER_ID,
  getDriveFolderUrl,
} from '../googleDrive';

describe('Parser Banco do Brasil (OFX e CSV)', () => {
  it('interpreta corretamente o OFX de exemplo do Banco do Brasil com FITID e categorias', () => {
    const sampleOfx = generateSampleBbOfx();
    const txs = parseBancoDoBrasilOfx(sampleOfx);

    expect(txs).toHaveLength(4);
    expect(txs[0].fitid).toBe('BB20261117901');
    expect(txs[0].type).toBe('income');
    expect(txs[0].category).toBe('Salário Mercedes-Benz');
    expect(txs[0].account).toContain('3456-7');

    expect(txs[1].type).toBe('expense');
    expect(txs[1].category).toBe('Supermercado');
    expect(txs[1].amount).toBeCloseTo(412.6, 2);

    expect(txs[2].category).toBe('Alimentação');
    expect(txs[3].type).toBe('investment');
    expect(txs[3].category).toBe('Investimentos');
  });

  it('interpreta CSV brasileiro separado por ponto e vírgula ignorando linhas de saldo', () => {
    const csv = `Data;Histórico;Número do documento;Valor
05/11/2026;SALDO ANTERIOR;000;5.000,00 C
06/11/2026;TED CRED SALARIO MERCEDES-BENZ;101;10.614,85 C
08/11/2026;PAO DE ACUCAR SUPERMERCADO;102;-845,30 D`;

    const txs = parseBancoDoBrasilCsv(csv);
    expect(txs).toHaveLength(2);
    expect(txs[0].date).toBe('2026-11-06');
    expect(txs[0].type).toBe('income');
    expect(txs[0].amount).toBeCloseTo(10614.85, 2);

    expect(txs[1].date).toBe('2026-11-08');
    expect(txs[1].type).toBe('expense');
    expect(txs[1].category).toBe('Supermercado');
    expect(txs[1].amount).toBeCloseTo(845.3, 2);
  });
});

describe('Parser Holerite Mercedes-Benz', () => {
  it('extrai salário bruto, descontos (INSS, IRRF, MBPrev), FGTS e líquido corretamente', () => {
    const sampleText = generateSampleMercedesPayslipText();
    const draft = parseMercedesPayslipText(sampleText, 'mercedes_holerite_pdf');

    expect(draft.payslip.employer).toBe('Mercedes-Benz do Brasil Ltda.');
    expect(draft.payslip.competence).toBe('2026-11');
    expect(draft.payslip.paymentDate).toBe('2026-11-30');
    expect(draft.payslip.grossSalary).toBeCloseTo(15270.0, 2);
    expect(draft.payslip.totalDeductions).toBeCloseTo(4145.66, 2);
    expect(draft.payslip.netSalary).toBeCloseTo(11124.34, 2);
    expect(draft.payslip.inssAmount).toBeCloseTo(908.86, 2);
    expect(draft.payslip.irrfAmount).toBeCloseTo(2385.4, 2);
    expect(draft.payslip.privatePensionAmount).toBeCloseTo(586.0, 2);
    expect(draft.payslip.healthPlanAmount).toBeCloseTo(265.4, 2);
    expect(draft.payslip.fgtsAmount).toBeCloseTo(1221.6, 2);
    expect(draft.items.length).toBeGreaterThanOrEqual(6);
  });
});

describe('Motor Financeiro e Simulador de Investimentos', () => {
  it('aplica corretamente tabela regressiva de IR e IOF curto prazo', () => {
    expect(getRegressiveIrRate(100)).toBe(0.225);
    expect(getRegressiveIrRate(250)).toBe(0.2);
    expect(getRegressiveIrRate(500)).toBe(0.175);
    expect(getRegressiveIrRate(800)).toBe(0.15);

    expect(getIofRateForDays(1)).toBe(0.96);
    expect(getIofRateForDays(15)).toBe(0.5);
    expect(getIofRateForDays(30)).toBe(0);

    // LCI 93% CDI com IR de 15% (>720 dias) equivale a ~109.41% do CDI bruto
    expect(computeCdbEquivalentPercent(93, 1000)).toBeCloseTo(109.41, 1);
  });

  it('projeta cenários comparativos (R$ 1.500/mês por 5 anos) com IR e poder de compra real', () => {
    const out = simulateInvestmentScenarios({
      initialAmount: 0,
      monthlyContribution: 1500,
      years: 5,
      cdiAnnual: 11.65,
      ipcaAnnual: 4.5,
      cdbPctCdi: 100,
      lciPctCdi: 92,
      tesouroIpcaRealRate: 6.3,
      mixedFiisPct: 50,
      mixedSelicPct: 35,
      mixedEquitiesPct: 15,
      fiisAnnualReturn: 12,
      equitiesAnnualReturn: 14.5,
      applyIncomeTax: true,
    });

    expect(out.points).toHaveLength(6); // Hoje + Anos 1..5
    const last = out.points[5];
    expect(last.totalInvested).toBe(90000);
    expect(last.cdbNetNominal).toBeGreaterThan(last.totalInvested);
    expect(last.cdbNetReal).toBeLessThan(last.cdbNetNominal);
    expect(out.summaries).toHaveLength(4);

    const cdbSummary = out.summaries.find((s) => s.id === 'cdb')!;
    const lciSummary = out.summaries.find((s) => s.id === 'lci')!;
    expect(cdbSummary.taxPaid).toBeGreaterThan(0);
    expect(lciSummary.taxPaid).toBe(0);
  });
});

describe('Google Drive Folder Integration (1AL3UC1Jv5-cUbQv6et1vY0AoH712jMg4)', () => {
  it('constrói query e payload apontando exclusivamente para a pasta alvo no Google Drive', () => {
    expect(DEFAULT_DRIVE_FOLDER_ID).toBe('1AL3UC1Jv5-cUbQv6et1vY0AoH712jMg4');
    expect(getDriveFolderUrl()).toBe(
      'https://drive.google.com/drive/folders/1AL3UC1Jv5-cUbQv6et1vY0AoH712jMg4?usp=drive_link',
    );

    const q = buildFolderSearchQuery(DEFAULT_DRIVE_FOLDER_ID, DEFAULT_DB_FILENAME);
    expect(q).toBe(
      "'1AL3UC1Jv5-cUbQv6et1vY0AoH712jMg4' in parents and name = 'financas.db' and trashed = false",
    );

    const payload = buildMultipartDrivePayload(
      {
        name: DEFAULT_DB_FILENAME,
        mimeType: 'application/x-sqlite3',
        parents: [DEFAULT_DRIVE_FOLDER_ID],
      },
      new Uint8Array([1, 2, 3, 4]),
    );
    expect(payload.boundary).toContain('financas_sqlite_drive_boundary_');
    expect(payload.body.type).toContain('multipart/related');
  });
});
