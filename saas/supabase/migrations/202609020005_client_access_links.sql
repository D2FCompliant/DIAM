alter table public.diam_missions
  add column if not exists client_access_token text,
  add column if not exists client_access_enabled boolean not null default true,
  add column if not exists client_access_expires_at timestamptz;

update public.diam_missions
set client_access_token = encode(gen_random_bytes(32), 'hex')
where client_access_token is null;

alter table public.diam_missions
  alter column client_access_token set not null;

create unique index if not exists idx_diam_missions_client_access_token
  on public.diam_missions(client_access_token);
