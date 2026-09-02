alter table public.diam_missions
  add column if not exists client_language text not null default 'fr';

alter table public.diam_client_replies
  add column if not exists message_language text not null default 'fr',
  add column if not exists french_translation text,
  add column if not exists translation_validated boolean not null default false;
