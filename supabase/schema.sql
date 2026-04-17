create table if not exists public.game_state (
  id text primary key,
  snapshot jsonb,
  votes jsonb not null default '{}'::jsonb,
  guesses jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.game_state enable row level security;

insert into public.game_state (id)
values ('main')
on conflict (id) do nothing;
