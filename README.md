# Assistente Pessoal de Finanças e Investimentos (Cloud & GitHub Hosted)

Aplicação web pessoal **100% online, gratuita, serverless e privada**, hospedável no **GitHub Pages** (ou Vercel/Netlify) e sincronizada diretamente com um banco **SQLite em WebAssembly (`sql.js`)** salvo na sua pasta exclusiva do **Google Drive**:

> 📁 **Pasta de Persistência no Google Drive:** [`1AL3UC1Jv5-cUbQv6et1vY0AoH712jMg4`](https://drive.google.com/drive/folders/1AL3UC1Jv5-cUbQv6et1vY0AoH712jMg4?usp=drive_link)

Centraliza automaticamente:
- **Receitas:** Holerite corporativo da **Mercedes-Benz** (Salário Nominal, Adicionais, INSS, IRRF, Previdência Privada MBPrev, Plano de Saúde, FGTS e Líquido).
- **Despesas & Fluxo de Caixa:** Extrato do **Banco do Brasil** (`.ofx`, `.csv` ou **Open Finance via Pluggy API**) com categorização automática e deduplicação por `FITID`.
- **Carteira de Investimentos & Educação Financeira:** Renda Fixa Pós/Pré/IPCA+, FIIs, Ações, Cripto e Previdência com explicações didáticas sobre cada ativo (ex.: *Tesouro IPCA+ 2035 e Marcação a Mercado*).
- **Assistente IA & Simulador:** Diagnóstico proativo, chat integrado (Google Gemini / OpenAI ou motor analítico local) e simulador comparativo com Imposto de Renda regressivo e poder de compra real (descontando IPCA).

---

## 1. Arquitetura Serverless & Privacidade

```text
[ Navegador do Usuário (GitHub Pages SPA - React + Vite + Tailwind) ]
   ├── Motor SQLite em WebAssembly (sql.js) + cache offline IndexedDB
   ├── Parsers Client-Side: OFX/CSV (BB) e PDF via pdfjs-dist (Holerite MB)
   ├── Simulador Financeiro + Diagnóstico Proativo + LLM (Gemini / OpenAI)
   └── Google Identity Services (OAuth2) + Google Drive API v3
           │
           ▼
[ Pasta Google Drive: 1AL3UC1Jv5-cUbQv6et1vY0AoH712jMg4 ]
   └── Arquivo único: financas.db (contendo transações, holerites, ativos e chaves de API do usuário)
```

### Segurança em Repositório Público ou Privado no GitHub
- **Zero segredos no código-fonte:** Chaves de API (Gemini, OpenAI, Pluggy) e o `Client ID` não ficam gravados no repositório. Você os insere na tela **Configurações** da própria interface web, e eles ficam armazenados exclusivamente dentro do seu arquivo `financas.db` na sua pasta do Google Drive.
- **`.gitignore` blindado:** Bloqueia `.env*`, `*.db`, `*.sqlite`, `*.ofx`, `*.pdf`, `*.csv` e arquivos de credenciais para evitar envio acidental de extratos ou holerites ao GitHub.

---

## 2. Como Publicar Gratuitamente no GitHub Pages

1. Crie um repositório no GitHub e envie este projeto para a branch `main`:
   ```bash
   git add .
   git commit -m "feat: assistente financeiro cloud com SQLite no Google Drive"
   git branch -M main
   git remote add origin https://github.com/<SEU_USUARIO>/<SEU_REPOSITORIO>.git
   git push -u origin main
   ```
2. No repositório no GitHub, acesse **Settings → Pages**.
3. Em **Build and deployment → Source**, selecione **GitHub Actions**.
4. O workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) já está pronto: a cada `push` na `main`, ele executa `npm ci`, roda os testes (`npm test`), compila o bundle estático (`npm run build` com `base: './'`) e publica o app automaticamente em `https://<SEU_USUARIO>.github.io/<SEU_REPOSITORIO>/`.

---

## 3. Como Configurar o Google Cloud OAuth2 para a Pasta `1AL3UC1Jv5-cUbQv6et1vY0AoH712jMg4`

Para que o app hospedado no GitHub Pages (ou rodando em `localhost`) leia e salve o arquivo `financas.db` na pasta [`1AL3UC1Jv5-cUbQv6et1vY0AoH712jMg4`](https://drive.google.com/drive/folders/1AL3UC1Jv5-cUbQv6et1vY0AoH712jMg4?usp=drive_link):

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e crie um projeto gratuito (ex: `assistente-financeiro-pessoal`).
2. No menu **APIs e Serviços → Biblioteca**, pesquise e ative a **Google Drive API**.
3. Em **APIs e Serviços → Tela de permissão OAuth (OAuth consent screen)**:
   - Escolha **Externo** (External).
   - Preencha nome do app e seu e-mail.
   - Em **Escopos**, adicione `https://www.googleapis.com/auth/drive`.
   - Em **Usuários de teste (Test users)**, adicione **seu próprio e-mail do Google** (dono da pasta `1AL3UC1Jv5-cUbQv6et1vY0AoH712jMg4`). Assim você não precisa publicar nem submeter o app a verificação da Google.
4. Em **APIs e Serviços → Credenciais → Criar Credenciais → ID do cliente OAuth**:
   - Tipo de aplicativo: **Aplicativo da Web**.
   - Em **Origens JavaScript autorizadas**, adicione:
     - `http://localhost:5173` (para desenvolvimento local)
     - `https://<SEU_USUARIO>.github.io` (origem raiz do seu GitHub Pages — sem barra no final).
5. Copie o **ID do cliente** gerado (`xxxxx.apps.googleusercontent.com`).
6. Abra o app web, vá em **Configurações → Persistência Google Drive**, cole o **Google OAuth 2.0 Client ID** (o ID da pasta `1AL3UC1Jv5-cUbQv6et1vY0AoH712jMg4` já vem preenchido por padrão), salve e clique em **Conectar Google Drive** no topo da tela.

> **O que acontece na primeira conexão?** O app verifica acesso à pasta `1AL3UC1Jv5-cUbQv6et1vY0AoH712jMg4`. Se já houver um arquivo `financas.db` lá, ele baixa e carrega no navegador. Se ainda não existir, ele cria `financas.db` dentro dessa pasta e passa a sincronizar automaticamente toda alteração.

---

## 4. Guia de Integração das Fontes de Dados

### A) Banco do Brasil (Extrato e Movimentações)
1. **Via Arquivo OFX / CSV (Mais Rápida e 100% Gratuita):**
   - No Internet Banking do Banco do Brasil: **Conta Corrente → Extrato → Exportar → Formato OFX (Money)** (ou CSV).
   - Na aba **Ingestão BB & RH**, arraste o arquivo `.ofx` ou `.csv`.
   - O sistema identifica automaticamente o número da conta, categoriza os gastos (Moradia, Supermercado, iFood, Posto, Investimentos, Salário MB) e ignora lançamentos duplicados usando o identificador `<FITID>`.
2. **Via Open Finance (Pluggy API):**
   - Crie uma conta gratuita de desenvolvedor na [Pluggy](https://www.pluggy.ai/), conecte sua conta do Banco do Brasil pelo consentimento regulado pelo Banco Central e copie seu `Client ID`, `Client Secret` e `Item ID`.
   - Informe esses dados na aba **Configurações** (eles ficam salvos no seu SQLite no Drive) e clique em **Sincronizar BB Agora** na aba **Ingestão BB & RH**.

### B) Holerite Corporativo da Mercedes-Benz
1. **Parser de PDF no Navegador (`pdfjs-dist`):**
   - Baixe o PDF do demonstrativo de pagamento no portal corporativo de RH da Mercedes-Benz.
   - Arraste o PDF na aba **Ingestão BB & RH**. Todo o processamento ocorre localmente no navegador — o PDF nunca sai do seu dispositivo.
   - O extrator identifica Competência, Data de Pagamento, Salário Bruto, INSS, IRRF, Previdência Privada (MBPrev), Plano Médico, FGTS e Líquido a Receber, conciliando automaticamente com o depósito recebido no extrato do Banco do Brasil.
2. **Bookmarklet para Portal RH:**
   - Caso prefira copiar direto da tela logada do RH sem baixar o PDF, copie o **Bookmarklet RH** na aba **Ingestão BB & RH** (ou em [`automation/mercedes-rh-bookmarklet.js`](automation/mercedes-rh-bookmarklet.js)) e cole o texto extraído na caixa de interpretação.

---

## 5. Desenvolvimento Local

```bash
# 1. Instalar dependências (copia automaticamente sql-wasm.wasm e pdf.worker.min.mjs para public/)
npm install

# 2. Rodar em modo desenvolvimento
npm run dev

# 3. Executar testes unitários (parsers, motor financeiro, Google Drive query builder)
npm test

# 4. Gerar build de produção estático em dist/
npm run build
```
