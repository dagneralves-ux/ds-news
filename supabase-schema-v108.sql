-- ============================================================================
-- DS GESTÃO V108 — ESQUEMA COMPLETO E MIGRAÇÃO SEGURA (SUPABASE / POSTGRESQL)
-- Pode ser executado tanto em um projeto novo quanto em um banco já existente
-- (usa IF NOT EXISTS, remove duplicatas de entregas e preserva todos os dados).
-- ============================================================================

-- 1. Tabela clientes (inclui colunas visuais da v59)
CREATE TABLE IF NOT EXISTS clientes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa text NOT NULL,
  responsavel text NOT NULL,
  telefone text DEFAULT '',
  qtd_midias int DEFAULT 0,
  dias int[] DEFAULT '{}',
  observacoes text DEFAULT '',
  logo_url text DEFAULT '',
  status text DEFAULT 'ativo',
  instagram text DEFAULT '',
  valor_mensal numeric(10,2) DEFAULT 0,
  dia_cobranca int DEFAULT 0,
  cor text DEFAULT '',
  icone text DEFAULT '',
  capa_url text DEFAULT '',
  logo_escuro_url text DEFAULT '',
  criado_em timestamptz DEFAULT now()
);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cor text DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS icone text DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS capa_url text DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS logo_escuro_url text DEFAULT '';
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clientes' AND policyname='user_owns_clientes') THEN
    CREATE POLICY "user_owns_clientes" ON clientes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 2. Tabela entregas (com proteção contra duplicidade e índice de data)
CREATE TABLE IF NOT EXISTS entregas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE,
  data_entrega date NOT NULL,
  criado_em timestamptz DEFAULT now()
);
-- Limpa eventuais duplicatas históricas antes de criar o índice único
DELETE FROM entregas a USING entregas b
WHERE a.ctid > b.ctid
  AND a.user_id = b.user_id
  AND a.cliente_id = b.cliente_id
  AND a.data_entrega = b.data_entrega;

CREATE UNIQUE INDEX IF NOT EXISTS entregas_user_cliente_data_uidx
  ON entregas (user_id, cliente_id, data_entrega);
CREATE INDEX IF NOT EXISTS entregas_user_data_idx
  ON entregas (user_id, data_entrega DESC);

ALTER TABLE entregas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='entregas' AND policyname='user_owns_entregas') THEN
    CREATE POLICY "user_owns_entregas" ON entregas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 3. Tabela lembretes
CREATE TABLE IF NOT EXISTS lembretes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  data_lembrete date NOT NULL,
  texto text NOT NULL,
  criado_em timestamptz DEFAULT now()
);
ALTER TABLE lembretes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lembretes' AND policyname='user_owns_lembretes') THEN
    CREATE POLICY "user_owns_lembretes" ON lembretes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Tabela tarefas
CREATE TABLE IF NOT EXISTS tarefas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  data_tarefa date NOT NULL,
  texto text NOT NULL,
  cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,
  concluida boolean DEFAULT false,
  criado_em timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tarefas_user_concluida_data_idx
  ON tarefas (user_id, concluida, data_tarefa);

ALTER TABLE tarefas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tarefas' AND policyname='user_owns_tarefas') THEN
    CREATE POLICY "user_owns_tarefas" ON tarefas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 5. Tabela pagamentos
CREATE TABLE IF NOT EXISTS pagamentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE,
  mes_referencia text NOT NULL,
  valor_pago numeric(10,2) NOT NULL DEFAULT 0,
  data_pagamento timestamptz DEFAULT now(),
  forma_pagamento text DEFAULT 'pix',
  observacao text DEFAULT '',
  criado_em timestamptz DEFAULT now(),
  UNIQUE(user_id, cliente_id, mes_referencia)
);
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pagamentos' AND policyname='user_owns_pagamentos') THEN
    CREATE POLICY "user_owns_pagamentos" ON pagamentos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 6. Tabela demandas (Kanban — v61)
CREATE TABLE IF NOT EXISTS demandas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  status text DEFAULT 'briefing',
  data_entrega date,
  formato text DEFAULT '',
  legenda text DEFAULT '',
  criado_em timestamptz DEFAULT now()
);
ALTER TABLE demandas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='demandas' AND policyname='user_owns_demandas') THEN
    CREATE POLICY "user_owns_demandas" ON demandas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 7. Tabela briefings (v61)
CREATE TABLE IF NOT EXISTS briefings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE UNIQUE,
  dados jsonb DEFAULT '{}'::jsonb,
  atualizado_em timestamptz DEFAULT now()
);
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='briefings' AND policyname='user_owns_briefings') THEN
    CREATE POLICY "user_owns_briefings" ON briefings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 8. Tabela despesas (Financeiro — v62)
CREATE TABLE IF NOT EXISTS despesas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  valor numeric(10,2) NOT NULL DEFAULT 0,
  data date NOT NULL,
  categoria text DEFAULT 'Outros',
  recorrente boolean DEFAULT false,
  criado_em timestamptz DEFAULT now()
);
ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='despesas' AND policyname='user_owns_despesas') THEN
    CREATE POLICY "user_owns_despesas" ON despesas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 9. Tabela aprovacoes + RPCs públicas de aprovação de arte (v63)
CREATE TABLE IF NOT EXISTS aprovacoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  demanda_id text NOT NULL,
  token text NOT NULL UNIQUE,
  titulo text NOT NULL,
  empresa text DEFAULT '',
  legenda text DEFAULT '',
  imagens text[] DEFAULT '{}',
  status text DEFAULT 'pendente',
  comentario text DEFAULT '',
  respondido_em timestamptz,
  criado_em timestamptz DEFAULT now()
);
ALTER TABLE aprovacoes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='aprovacoes' AND policyname='user_owns_aprovacoes') THEN
    CREATE POLICY "user_owns_aprovacoes" ON aprovacoes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION aprovacao_get(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  res jsonb;
BEGIN
  SELECT jsonb_build_object(
    'titulo', titulo,
    'empresa', empresa,
    'legenda', legenda,
    'imagens', imagens,
    'status', status,
    'comentario', comentario,
    'respondido_em', respondido_em
  ) INTO res
  FROM aprovacoes
  WHERE token = p_token
  LIMIT 1;
  RETURN res;
END;
$$;

CREATE OR REPLACE FUNCTION aprovacao_responder(p_token text, p_status text, p_comentario text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('aprovado', 'ajustes') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;
  UPDATE aprovacoes
  SET status = p_status,
      comentario = left(coalesce(p_comentario, ''), 2000),
      respondido_em = now()
  WHERE token = p_token;
END;
$$;

GRANT EXECUTE ON FUNCTION aprovacao_get(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION aprovacao_responder(text, text, text) TO anon, authenticated;

-- 10. Tabela configuracoes (sincronização entre aparelhos — v69/v104)
CREATE TABLE IF NOT EXISTS configuracoes (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  chave text NOT NULL,
  valor text,
  atualizado_em timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, chave)
);
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='configuracoes' AND policyname='user_owns_configuracoes') THEN
    CREATE POLICY "user_owns_configuracoes" ON configuracoes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Buckets de Storage (crie como públicos no painel Storage caso seja um projeto novo):
--   "logos" -> logos dos clientes e imagens de aprovação
--   "brand" -> logo do estúdio
