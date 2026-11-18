# TabNews (pessoal)

Portal de notícias só para você: **Futebol, Política, Inteligência Artificial, Design Gráfico e Marketing**, apenas com fontes brasileiras. Funciona no PC e no celular (instala como app), com resumos por IA.

**Custo: R$ 0.** Tudo roda no GitHub (grátis). Não há servidor, senha de admin nem limite de CPU.

## Como funciona

1. A cada ~30 minutos o GitHub roda um robô (`scripts/atualizar.mjs`).
2. O robô lê os feeds de `fontes.json`, escolhe só o que é dos seus 5 assuntos e pede resumos ao Gemini (grátis).
3. Ele grava o resultado em `docs/data/news.json`.
4. O site (`docs/`) lê esse arquivo e mostra as notícias.

## Passo a passo (uma vez só, ~15 minutos)

### 1. Criar o repositório
1. Crie uma conta grátis em github.com (se ainda não tiver).
2. Clique em **New repository**. Nome: `ds-news`. Marque **Public** (o GitHub Pages grátis exige repositório público; nenhuma senha fica nos arquivos).
3. Clique em **uploading an existing file** e arraste **todo o conteúdo** desta pasta (pastas `docs`, `scripts`, `config`, `test`, `.github` e os arquivos soltos). Clique em **Commit changes**.
4. Se a pasta `.github` não subir (alguns sistemas escondem pastas com ponto): em **Add file > Create new file**, digite o nome `.github/workflows/atualizar.yml` e cole o conteúdo do arquivo `workflow-atualizar.yml` desta pasta.

### 2. Ligar o site
**Settings > Pages**: em *Build and deployment*, escolha **Deploy from a branch**, branch **main**, pasta **/docs**, e salve. Em 1 a 2 minutos o endereço aparece: `https://SEU-USUARIO.github.io/ds-news/`.

### 3. Chave da IA (opcional, recomendada)
Gere uma chave grátis em aistudio.google.com/apikey. No GitHub, vá em **Settings > Secrets and variables > Actions > New repository secret**, nome `GEMINI_API_KEY`, e cole a chave.

Sem a chave o site funciona normalmente, só sem os resumos por IA.

### 4. Primeira atualização
Aba **Actions > Atualizar notícias > Run workflow**. Em cerca de 1 minuto o arquivo de notícias é gerado e o site já mostra conteúdo. Depois disso é automático.

### 5. Instalar como app
- **PC (Brave/Chrome/Edge):** abra o endereço, clique no ícone de instalar na barra de endereço. No Brave, se algo não carregar, desative o Shields para o site.
- **Celular Android (Chrome):** menu, **Instalar app**.
- **iPhone (Safari):** compartilhar, **Adicionar à Tela de Início**.

## Mudando o que você quer ler
- **Fontes:** edite `fontes.json` (no próprio GitHub: abrir o arquivo, ícone de lápis). Campos: `category` (`futebol`, `politica`, `ia`, `design`, `marketing`, ou `geral` para o robô decidir), `filtro` (só deixa passar notícias desse assunto), `ativo: false` para desligar.
- **Palavras de cada assunto:** `scripts/lib/classify.js`.
- **Nomes e cores das editorias:** `config/categorias.json`.
- No menu do site aparece **quantas fontes responderam** e quais falharam. As marcadas `"verificada": false` em `fontes.json` eu não consegui testar; se falharem, é só desligar ou trocar.

## Limites e cuidados
- O GitHub pode atrasar a execução automática alguns minutos, então "a cada 30 minutos" é aproximado.
- Se o repositório ficar 60 dias sem nenhuma atividade, o GitHub pode pausar as execuções automáticas; basta reativar na aba Actions.
- Alguns sites bloqueiam leitores automáticos. Quando acontecer, a fonte aparece como falha no menu.
- O resumo por IA usa só o título e o trecho publicados pela fonte. Confira sempre a matéria original.
- Notícias ficam por 7 dias, no máximo 400.
- Se a ação falhar ao salvar ("permission denied"), vá em Settings > Actions > General > Workflow permissions e marque **Read and write permissions**.

## Testar no seu computador (opcional, precisa do Node 20+)
```
node test/pipeline.test.mjs      # testes do motor com feeds simulados
node scripts/atualizar.mjs       # busca notícias de verdade e grava docs/data/news.json
node test/servidor.mjs           # abre o site em http://localhost:8790
```

## O que mudou em relação à versão anterior (Cloudflare)
- Saiu o Worker/KV do Cloudflare (no plano grátis a atualização estourava o limite de CPU) e o painel admin com senha. As fontes agora se editam em `fontes.json`.
- Entrou o foco nos seus 5 assuntos e só fontes do Brasil.
- Resumos por IA em lote (uma chamada para até 6 notícias), bem dentro da cota grátis.
- Favoritos e histórico continuam, guardados no próprio navegador.


## Favoritos e lidas compartilhados (opcional)
Por padrão, favoritos e lidas ficam só no navegador de cada pessoa. Para valerem entre aparelhos e entre o grupo, crie um projeto grátis no Supabase, rode o arquivo `supabase-setup.sql` e preencha `SYNC` em `docs/assets/js/config.js` (`url`, `key` e um nome de `group`, igual para todos). Sem isso, o site continua funcionando normalmente.


## Interface TabNews 2.0 — Editorial Intelligence

A camada visual foi atualizada sem reconstruir o motor de notícias. A nova interface usa uma identidade editorial com azul-marinho, superfícies neutras, tipografia DM Sans + Newsreader, navegação lateral, destaque principal, tendências, cards de notícias, resumo por IA e tema claro/escuro refinado.

No celular, o menu lateral funciona como gaveta e há uma barra inferior com atalhos para Início, Editorias, Favoritos e Histórico. Os filtros, a busca, o modo lista/cards e os estados de carregamento foram mantidos.

**Frequências:** o robô do GitHub continua coletando notícias aproximadamente a cada 30 minutos. Enquanto a página inicial está aberta, o navegador revalida o arquivo publicado a cada 5 minutos; isso não executa uma nova coleta RSS.

O redesign altera principalmente `docs/index.html`, `docs/assets/css/main.css`, `docs/assets/js/app.js`, o manifesto e a versão do cache do service worker. O pipeline RSS, a classificação, a deduplicação, os resumos por IA, os favoritos e a sincronização não foram substituídos.

## Atualização 2.1 — identidade TN e saúde dos feeds

- Símbolo TN aplicado ao cabeçalho, menu, splash e ícones PWA.
- Paleta do ícone baseada na referência enviada (laranja/dourado e roxo).
- Painel de fontes diferencia feed acessível sem notícias válidas de falha HTTP/conexão.
- Diagnóstico registra entradas encontradas, itens filtrados e tempo de resposta.
- Fontes adicionais: G1 Política, Folha Poder, E-Commerce Brasil e BBC News Brasil.
- URLs do Tecmundo e Exame ajustadas; filtros de Mundo Conectado e Tecmundo ampliados.
- Nenhuma alteração no Supabase, tabelas ou políticas RLS.

As fontes adicionadas/ajustadas estão marcadas como não verificadas até a primeira execução do workflow. Confirme o resultado em `docs/data/status.json`.


## Atualização TN — correção de fontes e identidade visual
- Ícones PWA, favicon, tela inicial e marcas do cabeçalho usam o arquivo TN azul fornecido, sem redesenho ou alteração de cores.
- Parser RSS aceita tags com namespace e JSON Feed; fontes explicitamente marcadas podem usar fallback de captura de links em páginas HTML.
- E-Commerce Brasil aponta para o feed geral oficial; Neil Patel Brasil usa a listagem brasileira com fallback HTML.
- O painel diferencia captura por RSS e captura pela página do publisher.
- O Supabase e suas tabelas/políticas não foram alterados.

## Versão 3.0 — layout de portal (referência USA Today)
- Nova estrutura: barra superior (data, assunto em alta), cabeçalho com busca e botão Atualizar, menu de editorias fixo, faixa das 4 últimas, destaque em carrossel com "Painel do dia", "Não perca", "Principais notícias", um bloco por editoria, faixa "Fique por dentro" e rodapé escuro com status das fontes.
- Mantidos: busca (Ctrl K), favoritos, histórico, resumo por IA, tema claro/escuro, PWA e todo o motor de coleta.
- Arquivos alterados: `docs/index.html`, `docs/assets/css/main.css`, `docs/assets/js/app.js`, `docs/assets/js/api.js`, `docs/sw.js`, cores em `config/categorias.json`.

## Jogos de hoje (Brasileirão A/B, Copa do Brasil, Libertadores, Sul-Americana e Europa)
Mostra horários, jogos em andamento e resultado final no painel do destaque e na página **Jogos** (`#jogos`).

**Ativar (uma vez, ~5 minutos):**
1. Crie a conta grátis em dashboard.api-football.com e copie a chave em *Account > My Access*. O plano grátis tem 100 chamadas por dia; o robô usa 1 por execução (~48 por dia).
2. No GitHub: **Settings > Secrets and variables > Actions > New repository secret**, nome `API_FOOTBALL_KEY`, cole a chave.
3. Aba **Actions > Atualizar notícias > Run workflow**. O arquivo `docs/data/jogos.json` é gerado.

**Como funciona:** o robô faz uma única chamada com todos os jogos do dia e guarda só os campeonatos de `config/campeonatos.json` (para incluir ou tirar campeonatos, edite esse arquivo; o `id` é o da API-Football). Sem a chave, o robô ignora os jogos e o site mostra o painel de editorias, como antes. Se a API falhar, o arquivo anterior é mantido.

**Limite:** o placar é atualizado junto com as notícias (~30 min), então é "jogos de hoje e resultado final", não placar ao vivo. Teste: `node test/jogos.test.mjs`.
