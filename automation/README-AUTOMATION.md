# Scripts Auxiliares de Captura (Holerite Mercedes-Benz & Banco do Brasil)

Como o aplicativo roda 100% no navegador (GitHub Pages + SQLite WebAssembly + Google Drive), **nenhuma senha bancária ou corporativa precisa ser armazenada**.

## 1. Holerite Mercedes-Benz (`mercedes-rh-bookmarklet.js`)
- Acesse o portal de RH da Mercedes-Benz (SAP SuccessFactors / ADP / Portal Interno) e abra o demonstrativo de pagamento do mês.
- Clique no favorito **Bookmarklet RH** (também disponível com botão de cópia direta dentro da aba **Ingestão BB & RH** da aplicação).
- Cole o conteúdo capturado ou suba diretamente o **PDF** baixado do portal na área de drag-and-drop da aba **Ingestão BB & RH**.

## 2. Banco do Brasil (`bb-extrato-bookmarklet.js` / OFX / Pluggy)
- **Via recomendada (mais precisa):** No Internet Banking do Banco do Brasil, acesse **Conta Corrente → Extrato → Exportar → OFX (Money)** e arraste o arquivo `.ofx` para a aba **Ingestão BB & RH**.
- **Via Open Finance:** Configure uma conta gratuita para desenvolvedores na [Pluggy](https://www.pluggy.ai/), conecte sua conta BB pelo consentimento oficial do Banco Central e informe `Client ID`, `Client Secret` e `Item ID` na tela de **Configurações** do app (salvo apenas no seu SQLite no Google Drive).
