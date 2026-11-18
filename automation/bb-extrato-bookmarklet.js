/**
 * Bookmarklet Auxiliar para Internet Banking Banco do Brasil
 *
 * Ajuda a extrair tabelas visíveis de extrato bancário diretamente da tela logada
 * convertendo as linhas em formato CSV simples para colagem ou importação.
 *
 * Versão minificada para barra de favoritos (`javascript:...`):
 * javascript:(function(){const rows=Array.from(document.querySelectorAll('table tr')).map(tr=>Array.from(tr.querySelectorAll('td,th')).map(c=>c.innerText.replace(/\s+/g,' ').trim()).join(';')).filter(Boolean);if(!rows.length){alert('Nenhuma tabela de extrato encontrada nesta tela.');return;}const csv=rows.join('\n');navigator.clipboard.writeText(csv).then(()=>alert('Linhas do extrato copiadas em CSV ('+rows.length+' linhas)! Salve como .csv para importar.')).catch(()=>prompt('Copie o CSV abaixo:',csv.slice(0,3000)));})();
 */
(function captureBbStatementRows() {
  const rows = Array.from(document.querySelectorAll('table tr'))
    .map((tr) =>
      Array.from(tr.querySelectorAll('td,th'))
        .map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim() ?? '')
        .join(';'),
    )
    .filter((line) => line.length > 0);

  if (rows.length === 0) {
    alert('Nenhuma tabela de extrato encontrada na página atual.');
    return;
  }

  const csv = rows.join('\n');
  navigator.clipboard
    .writeText(csv)
    .then(() => {
      alert(`Extrato copiado (${rows.length} linhas em CSV).`);
    })
    .catch(() => {
      prompt('Copie o conteúdo CSV abaixo:', csv.slice(0, 3000));
    });
})();
