create table if not exists public.contrato_aluguel (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  titulo text not null,
  contraparte text,
  papel text not null default 'locador',
  regime_locador text not null,
  aluguel_mensal numeric not null default 0,
  substituida_pct numeric not null default 0,
  mantida_pct numeric not null default 0,
  aproveitamento_credito_pct numeric not null default 100,
  aliquota_plena_pct numeric not null default 26.5,
  redutor_pct numeric not null default 70,
  ano_referencia integer not null default 2033,
  criterio text not null default 'liquido_locador',
  resultado_json jsonb not null default '{}'::jsonb,
  observacao text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.contrato_aluguel to authenticated;
grant all on public.contrato_aluguel to service_role;

alter table public.contrato_aluguel enable row level security;

drop policy if exists "contrato_aluguel_authenticated" on public.contrato_aluguel;
create policy "contrato_aluguel_authenticated" on public.contrato_aluguel
  for all to authenticated using (true) with check (true);

create index if not exists contrato_aluguel_case_idx on public.contrato_aluguel(case_id);

drop trigger if exists contrato_aluguel_updated_at on public.contrato_aluguel;
create trigger contrato_aluguel_updated_at before update on public.contrato_aluguel
  for each row execute function public.update_updated_at_column();