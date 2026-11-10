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

**Segurança:** como o repositório é público, a chave `key` (anon) e o nome do `group` ficam visíveis a qualquer pessoa. As políticas do Supabase não têm login, então o nome do grupo é a única proteção: use um nome longo e imprevisível (20+ caracteres, por exemplo gerado por um gerenciador de senhas). Com nome curto, o site mostra um aviso no menu lateral.


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

## Atualização 2.3 — correções de interface
- Botões sem a borda cinza padrão do navegador (reset em `button`).
- A revalidação automática da página inicial só redesenha quando há notícia nova; sem novidade, apenas atualiza os "há X min" (a rolagem das faixas e os resumos abertos são preservados).
- Service worker: pré-cache sem `?v=`, alinhado ao que o `index.html` pede; busca offline ignora a versão.
- Nenhum texto menor que 11 px; cinza secundário (`--muted`) escurecido para contraste mínimo de 4,5:1.
- Data no cabeçalho em português correto ("Terça-feira, 10 de novembro de 2026").

## Atualização 2.4 — conteúdo primeiro, motor mais preciso
**Interface**
- Topo compacto: a primeira notícia aparece cerca de 130 px mais cedo; no celular some o cartão "Edição de hoje" e a faixa de assuntos em alta.
- Terceiro indicador agora é **Não lidas** (usa o histórico de leitura), no lugar de "5 temas ativos".
- Cartões sem foto: estrela e compartilhar ficaram visíveis (estavam brancos sobre branco) e sumiu a faixa vazia no topo.
- Destaque do dia: as notícias laterais mostram um resumo curto.
- Início no computador: cada editoria mostra 6 notícias em grade (sem rolagem horizontal escondida). No celular continua a faixa deslizante.
- Painel de leitura: botões e teclas **J** (próxima) e **K** (anterior).
- "Assuntos em alta" mostra só o número e ignora verbos de manchete ("vence", "lança", "aprova"...).

**Motor**
- Classificação: termos ambíguos (`var`, `robô`, `ads`, `design`, `partida`, `técnico`, `consumidor`...) valem meia pontuação; é preciso um termo forte ou dois fracos. Menos notícias fora de assunto.
- Workflow: o robô passa a reaproveitar o próprio commit (`--amend`) em vez de criar um novo a cada 30 minutos; o histórico do repositório deixa de crescer. Exige `fetch-depth: 0` (já configurado) e que a branch `main` não tenha proteção que bloqueie force-push.
- Supabase: aviso no menu quando o nome do grupo tem menos de 20 caracteres, e orientação de segurança no LEIA-ME.

## Atualização 2.5 — fontes hospedadas no próprio site
- DM Sans e Newsreader (normal e itálico) agora ficam em `docs/assets/fonts/` (formato WOFF, subconjunto latino, licença OFL incluída). O site não faz mais nenhum pedido ao Google Fonts.
- A política de segurança (CSP) passou a aceitar fontes só do próprio site (`font-src 'self'`), e o service worker guarda as fontes para uso offline.
- Para trocar ou atualizar as fontes, substitua os arquivos em `docs/assets/fonts/` mantendo os mesmos nomes.

## Importante ao atualizar os arquivos do site
- **Não envie a pasta `docs/data`** do ZIP por cima do repositório: ela guarda as notícias e o estado das fontes gerados pelo robô. Se o arquivo `news.json` for sobrescrito por uma versão vazia, o site mostra "0 notícias" até a próxima coleta (até ~30 minutos). Para forçar na hora: **Actions > Atualizar notícias > Run workflow**.
- A partir da versão 2.5.1 o ZIP já não inclui `docs/data/news.json`.


## 2.5.2
- Corrigido: entidades HTML como `&rsaquo;` viravam a palavra "Rsaquo" em títulos e em "Assuntos em alta". Mais entidades decodificadas e o robô limpa títulos/resumos já gravados.
- "artigo", "opinião", "vídeo" etc. não entram mais como assunto em alta.


## 2.6 — Visual "Aurora"
- Ícones de linha por editoria (menu, barras, capas) no lugar dos emojis.
- Capa tipográfica (grade + brilho + ícone grande) para destaques e painéis sem foto, inclusive quando a foto falha ao carregar.
- Novo "Resumo do dia": notícias das últimas 24h, editoria líder e barras por editoria; mostra "N novas desde sua última visita".
- Camada visual futurista: gradiente de acento, vidro, brilho ao passar o mouse, grade sutil no topo. Claro, escuro e celular.


## 2.7 — Tema único e nova paleta
- Removido o modo claro/escuro (botão, script e regras). Agora há um tema só.
- Paleta: Gargoyle Gas `#FFE14F`, Space Cadet `#192853`, Alice Blue `#ECF4F7`. Fundo Alice Blue, textos e menu lateral Space Cadet, destaques e botões em amarelo.

## 2.8 — Menu lateral em vidro Alice Blue
- Barra lateral translúcida (vidro fosco) em Alice Blue, com texto Space Cadet e brilho amarelo; item ativo em cartão branco com filete amarelo.
