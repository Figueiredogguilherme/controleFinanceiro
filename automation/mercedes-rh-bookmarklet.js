/**
 * Bookmarklet para Captura do Holerite Corporativo (Portal RH Mercedes-Benz)
 *
 * Como instalar como favorito no navegador:
 * 1. Crie um novo favorito na barra de favoritos do Chrome/Edge.
 * 2. No campo URL, cole todo o código minificado (prefixado com `javascript:`) abaixo:
 *
 * javascript:(function(){const txt=document.body.innerText||'';if(!txt.trim()){alert('Nenhum texto encontrado na pagina.');return;}navigator.clipboard.writeText(txt).then(function(){alert('Holerite copiado! Abra a aba "Ingestao BB & RH" do Assistente Financeiro e cole o texto.');}).catch(function(){prompt('Copie manualmente o texto do holerite abaixo:',txt.slice(0,3000));});})();
 */
(function captureMercedesPayslipText() {
  const selection = window.getSelection()?.toString()?.trim();
  const content = selection || document.body.innerText || '';
  if (!content.trim()) {
    alert('Nenhum conteúdo de holerite detectado nesta página.');
    return;
  }
  navigator.clipboard
    .writeText(content)
    .then(() => {
      alert(
        'Texto do holerite copiado para a área de transferência! Cole na aba "Ingestão BB & RH" do Assistente Financeiro.',
      );
    })
    .catch(() => {
      prompt('Copie o texto abaixo e cole na aba "Ingestão BB & RH":', content.slice(0, 3000));
    });
})();
