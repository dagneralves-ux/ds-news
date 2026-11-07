-- TabNews: tabela dos favoritos e lidas compartilhados (rode uma vez no SQL Editor do Supabase)
create table if not exists public.tabnews_state (
  group_id   text        not null,
  kind       text        not null check (kind in ('fav', 'read')),
  item_id    text        not null,
  payload    jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (group_id, kind, item_id)
);

alter table public.tabnews_state enable row level security;

create policy "tabnews grupo le"      on public.tabnews_state for select using (true);
create policy "tabnews grupo insere"  on public.tabnews_state for insert with check (true);
create policy "tabnews grupo altera"  on public.tabnews_state for update using (true) with check (true);
create policy "tabnews grupo apaga"   on public.tabnews_state for delete using (true);
