export interface BcbMacroRates {
  selic: number;
  cdi: number;
  ipca12m: number;
  fetchedAt: string;
}

async function fetchBcbSeriesLastValue(seriesCode: number): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesCode}/dados/ultimos/1?formato=json`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: string; valor?: string }[];
    if (!Array.isArray(data) || data.length === 0 || !data[0].valor) return null;
    const num = Number(String(data[0].valor).replace(',', '.'));
    return Number.isFinite(num) && num > 0 ? num : null;
  } catch {
    return null;
  }
}

/**
 * Busca as taxas oficiais vigentes diretamente da API de Dados Abertos do Banco Central do Brasil (SGS):
 * - 432: Taxa Selic Meta (% a.a.)
 * - 4389: Taxa CDI Anualizada (% a.a.)
 * - 13522: IPCA acumulado 12 meses (% a.a.)
 */
export async function fetchLiveBcbMacroRates(fallback: {
  selic: number;
  cdi: number;
  ipca: number;
}): Promise<BcbMacroRates> {
  const [selicLive, cdiLive, ipcaLive] = await Promise.all([
    fetchBcbSeriesLastValue(432),
    fetchBcbSeriesLastValue(4389),
    fetchBcbSeriesLastValue(13522),
  ]);

  const selic = selicLive ?? fallback.selic;
  const cdi = cdiLive ?? (selicLive ? Number((selicLive - 0.1).toFixed(2)) : fallback.cdi);
  const ipca12m = ipcaLive ?? fallback.ipca;

  return {
    selic: Number(selic.toFixed(2)),
    cdi: Number(cdi.toFixed(2)),
    ipca12m: Number(ipca12m.toFixed(2)),
    fetchedAt: new Date().toISOString(),
  };
}
