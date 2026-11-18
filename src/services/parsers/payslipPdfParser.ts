import { DataSource, Payslip, PayslipItem } from '../../types/finance';

export interface ParsedPayslipDraft {
  payslip: Omit<Payslip, 'id' | 'createdAt' | 'items'>;
  items: Omit<PayslipItem, 'id' | 'payslipId'>[];
  rawTextPreview: string;
}

function parseBrAmount(text: string): number {
  const normalized = text.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const num = Number(normalized);
  return Number.isFinite(num) ? Math.abs(num) : 0;
}

export async function extractTextFromPdfFile(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  // Configura o worker local copiado em public/ para funcionar no Vite e GitHub Pages
  if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs';
  }
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;

  const pagesText: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let currentY: number | null = null;
    let currentLine = '';

    for (const item of content.items) {
      if (!('str' in item)) continue;
      const textItem = item as { str: string; transform?: number[] };
      const y = textItem.transform ? Math.round(textItem.transform[5]) : 0;
      if (currentY !== null && Math.abs(y - currentY) > 4) {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = textItem.str;
      } else {
        currentLine += (currentLine ? ' ' : '') + textItem.str;
      }
      currentY = y;
    }
    if (currentLine.trim()) lines.push(currentLine.trim());
    pagesText.push(lines.join('\n'));
  }

  return pagesText.join('\n');
}

function extractCompetence(text: string): string {
  const monthNames: Record<string, string> = {
    janeiro: '01',
    fevereiro: '02',
    marco: '03',
    março: '03',
    abril: '04',
    maio: '05',
    junho: '06',
    julho: '07',
    agosto: '08',
    setembro: '09',
    outubro: '10',
    novembro: '11',
    dezembro: '12',
  };

  const mmYyyy = text.match(/\b(0[1-9]|1[0-2])\/(20\d{2})\b/);
  if (mmYyyy) {
    return `${mmYyyy[2]}-${mmYyyy[1]}`;
  }

  const monthWord = text.match(
    /\b(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*(?:de|\/)?\s*(20\d{2})\b/i,
  );
  if (monthWord) {
    const m = monthNames[monthWord[1].toLowerCase()] ?? '01';
    return `${monthWord[2]}-${m}`;
  }

  return new Date().toISOString().slice(0, 7);
}

function extractPaymentDate(text: string, competence: string): string {
  const dateMatch = text.match(
    /(?:data\s*(?:de\s*)?pagamento|cr[eé]dito\s*em|pagamento:?)\s*(\d{2})\/(\d{2})\/(20\d{2})/i,
  );
  if (dateMatch) {
    return `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
  }
  const anyFullDate = text.match(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/);
  if (anyFullDate) {
    return `${anyFullDate[3]}-${anyFullDate[2]}-${anyFullDate[1]}`;
  }
  return `${competence}-05`;
}

function extractLabeledAmount(text: string, regex: RegExp): number {
  const match = text.match(regex);
  if (!match) return 0;
  for (let i = 1; i < match.length; i++) {
    if (match[i]) {
      const val = parseBrAmount(match[i]);
      if (val > 0) return val;
    }
  }
  return 0;
}

export function parseMercedesPayslipText(
  rawText: string,
  source: DataSource = 'mercedes_holerite_pdf',
): ParsedPayslipDraft {
  const normalized = rawText.replace(/\r/g, '');
  const competence = extractCompetence(normalized);
  const paymentDate = extractPaymentDate(normalized, competence);

  const employer = /mercedes[- ]?benz/i.test(normalized)
    ? 'Mercedes-Benz do Brasil Ltda.'
    : 'Empregador Corporativo';

  const employeeMatch = normalized.match(/(?:nome|funcion[aá]rio|colaborador)\s*:?\s*([A-ZÀ-Ú][A-Za-zÀ-ú\s]{2,45})/i);
  const roleMatch = normalized.match(/(?:cargo|fun[cç][aã]o)\s*:?\s*([A-ZÀ-Ú][A-Za-zÀ-ú0-9\s/-]{2,45})/i);

  const items: Omit<PayslipItem, 'id' | 'payslipId'>[] = [];

  // Padrão de linhas com código + descrição + valor monetário brasileiro (ex: "0010 Salário Nominal 14.200,00")
  const lines = normalized.split('\n');
  for (const line of lines) {
    const clean = line.trim();
    if (!clean) continue;

    // Ignora linhas de totais gerais para não duplicar como rubrica individual
    if (/total\s+(?:de\s+)?(?:vencimentos|proventos|descontos)|l[ií]quido\s+a\s+receber|valor\s+l[ií]quido/i.test(clean)) {
      continue;
    }

    const rowMatch = clean.match(
      /^(?:(\d{3,5})\s+)?([A-Za-zÀ-ú0-9\s./+-]{4,60}?)\s+(?:(\d+[,.]?\d*\s*[h%d]?)\s+)?(\d{1,3}(?:\.\d{3})*,\d{2})$/i,
    );
    if (!rowMatch) continue;

    const code = rowMatch[1] ?? '';
    const desc = rowMatch[2].trim();
    const ref = rowMatch[3]?.trim();
    const amount = parseBrAmount(rowMatch[4]);
    if (amount <= 0) continue;

    const upperDesc = desc.toUpperCase();
    let kind: PayslipItem['kind'] = 'earning';
    if (/FGTS|BASE\s+(?:INSS|IRRF|FGTS)|MARGEM/i.test(upperDesc)) {
      kind = 'info';
    } else if (
      /INSS|IRRF|IMPOSTO DE RENDA|PREVID|MBPREV|SAUDE|MEDICA|ODONTO|CONTRIBUICAO|VALE|DESCONTO|PENSAO|SINDICAL|SEGURO|EMPRESTIMO|FALTAS/i.test(
        upperDesc,
      )
    ) {
      kind = 'deduction';
    }

    items.push({
      code: code || String(100 + items.length),
      description: desc,
      kind,
      reference: ref,
      amount,
    });
  }

  const totalGrossFromSummary = extractLabeledAmount(
    normalized,
    /(?:total\s+(?:de\s+)?(?:proventos|vencimentos)|sal[aá]rio\s+bruto)\s*:?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/i,
  );
  const totalDeductionsFromSummary = extractLabeledAmount(
    normalized,
    /(?:total\s+(?:de\s+)?descontos)\s*:?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/i,
  );
  const netFromSummary = extractLabeledAmount(
    normalized,
    /(?:l[ií]quido\s+a\s+receber|valor\s+l[ií]quido|sal[aá]rio\s+l[ií]quido)\s*:?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/i,
  );

  const earningsSum = items
    .filter((i) => i.kind === 'earning')
    .reduce((acc, i) => acc + i.amount, 0);
  const deductionsSum = items
    .filter((i) => i.kind === 'deduction')
    .reduce((acc, i) => acc + i.amount, 0);

  const grossSalary = totalGrossFromSummary > 0 ? totalGrossFromSummary : earningsSum;
  const totalDeductions =
    totalDeductionsFromSummary > 0 ? totalDeductionsFromSummary : deductionsSum;
  const netSalary =
    netFromSummary > 0 ? netFromSummary : Math.max(0, grossSalary - totalDeductions);

  const findRubric = (pattern: RegExp, fallbackRegex: RegExp): number => {
    const matchedItems = items.filter((i) => pattern.test(i.description));
    if (matchedItems.length > 0) {
      return matchedItems.reduce((acc, i) => acc + i.amount, 0);
    }
    return extractLabeledAmount(normalized, fallbackRegex);
  };

  const inssAmount = findRubric(
    /\bINSS\b/i,
    /INSS[^\d\n]{0,25}(\d{1,3}(?:\.\d{3})*,\d{2})/i,
  );
  const irrfAmount = findRubric(
    /\bIRRF\b|IMPOSTO\s+DE\s+RENDA/i,
    /(?:IRRF|IMPOSTO\s+DE\s+RENDA)[^\d\n]{0,25}(\d{1,3}(?:\.\d{3})*,\d{2})/i,
  );
  const privatePensionAmount = findRubric(
    /MBPREV|PREVID[EÊ]NCIA|PGBL/i,
    /(?:MBPREV|PREVID[EÊ]NCIA)[^\d\n]{0,30}(\d{1,3}(?:\.\d{3})*,\d{2})/i,
  );
  const healthPlanAmount = findRubric(
    /M[EÉ]DICA|SA[UÚ]DE|ODONTO|UNIMED|BRADESCO\s+SAUDE/i,
    /(?:ASSIST[EÊ]NCIA\s+M[EÉ]DICA|PLANO\s+DE\s+SA[UÚ]DE)[^\d\n]{0,30}(\d{1,3}(?:\.\d{3})*,\d{2})/i,
  );
  const fgtsAmount = findRubric(
    /\bFGTS\b/i,
    /FGTS(?:\s+DO\s+M[EÊ]S)?[^\d\n]{0,30}(\d{1,3}(?:\.\d{3})*,\d{2})/i,
  );

  // Caso não tenha extraído rubricas individuais mas tenha os totais
  if (items.length === 0 && grossSalary > 0) {
    items.push({
      code: '0010',
      description: 'Salário Bruto (Resumo)',
      kind: 'earning',
      amount: grossSalary,
    });
    if (inssAmount > 0) {
      items.push({ code: '0501', description: 'INSS', kind: 'deduction', amount: inssAmount });
    }
    if (irrfAmount > 0) {
      items.push({ code: '0502', description: 'IRRF', kind: 'deduction', amount: irrfAmount });
    }
    if (privatePensionAmount > 0) {
      items.push({
        code: '0610',
        description: 'Previdência Privada MBPrev',
        kind: 'deduction',
        amount: privatePensionAmount,
      });
    }
  }

  return {
    payslip: {
      competence,
      paymentDate,
      employer,
      employeeName: employeeMatch?.[1]?.trim(),
      role: roleMatch?.[1]?.trim(),
      grossSalary: Number(grossSalary.toFixed(2)),
      totalDeductions: Number(totalDeductions.toFixed(2)),
      netSalary: Number(netSalary.toFixed(2)),
      inssAmount: Number(inssAmount.toFixed(2)),
      irrfAmount: Number(irrfAmount.toFixed(2)),
      privatePensionAmount: Number(privatePensionAmount.toFixed(2)),
      healthPlanAmount: Number(healthPlanAmount.toFixed(2)),
      fgtsAmount: Number(fgtsAmount.toFixed(2)),
      source,
    },
    items,
    rawTextPreview: normalized.slice(0, 1500),
  };
}
