# DS Intelligence (pessoal)

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
