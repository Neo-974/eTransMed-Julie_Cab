-- eTransMed — Schéma PostgreSQL pour Supabase
-- VERSION TEST — données fictives uniquement (Supabase n'est pas HDS).
-- À exécuter dans le SQL Editor de Supabase.

-- ============================================================
--  Extensions
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
--  Cabinets
-- ============================================================
create table if not exists public.cabinets (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  created_at  timestamptz not null default now()
);

-- ============================================================
--  Profils (1-1 avec auth.users) + rôle dans le cabinet
-- ============================================================
do $$ begin
  create type public.user_role as enum ('titulaire', 'collaborateur', 'remplacant');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  cabinet_id  uuid references public.cabinets(id) on delete set null,
  nom_complet text,
  role        public.user_role not null default 'titulaire',
  created_at  timestamptz not null default now()
);

-- Helper : cabinet de l'utilisateur courant (évite la récursion RLS)
create or replace function public.current_cabinet_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select cabinet_id from public.profiles where id = auth.uid() $$;

-- Inscription : crée le cabinet + le profil du titulaire en une transaction.
-- SECURITY DEFINER = contourne la RLS (le profil n'existe pas encore à cet instant).
create or replace function public.create_cabinet_and_join(cabinet_nom text, membre_nom text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  new_cabinet_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Utilisateur non authentifié';
  end if;

  insert into public.cabinets (nom) values (cabinet_nom)
  returning id into new_cabinet_id;

  insert into public.profiles (id, cabinet_id, nom_complet, role)
  values (auth.uid(), new_cabinet_id, membre_nom, 'titulaire')
  on conflict (id) do update
    set cabinet_id = excluded.cabinet_id,
        nom_complet = excluded.nom_complet,
        role = excluded.role;

  return new_cabinet_id;
end;
$$;

grant execute on function public.create_cabinet_and_join(text, text) to authenticated;

-- ============================================================
--  Patients (patientèle du cabinet)
-- ============================================================
create table if not exists public.patients (
  id             uuid primary key default gen_random_uuid(),
  cabinet_id     uuid not null references public.cabinets(id) on delete cascade,
  nom            text not null,
  prenom         text not null,
  date_naissance date,                       -- clé anti-homonymie
  ajout_a_la_volee boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists idx_patients_cabinet on public.patients(cabinet_id, nom, prenom);

-- ============================================================
--  Passages : une dictée = un audio -> texte, relu et validé
-- ============================================================
do $$ begin
  create type public.passage_status as enum ('brouillon', 'valide');
exception when duplicate_object then null; end $$;

create table if not exists public.passages (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          uuid not null references public.patients(id) on delete cascade,
  cabinet_id          uuid not null references public.cabinets(id) on delete cascade,
  auteur_id           uuid not null references public.profiles(id),
  recorded_at         timestamptz not null default now(),  -- horodatage du passage
  audio_path          text,                                -- chemin dans le bucket Storage
  transcript_raw      text,                                -- transcription automatique brute
  transcript_corrige  text,                                -- texte relu/corrigé par l'IDE
  statut              public.passage_status not null default 'brouillon',
  valide_at           timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists idx_passages_patient_day on public.passages(patient_id, recorded_at);

-- ============================================================
--  Transmissions : fusion chronologique des passages d'un jour
-- ============================================================
do $$ begin
  create type public.transmission_format as enum ('fluide', 'ciblee');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.transmission_status as enum ('brouillon', 'validee');
exception when duplicate_object then null; end $$;

create table if not exists public.transmissions (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients(id) on delete cascade,
  cabinet_id    uuid not null references public.cabinets(id) on delete cascade,
  date_soin     date not null,
  texte         text,
  format        public.transmission_format not null default 'fluide',
  statut        public.transmission_status not null default 'brouillon',
  validee_par   uuid references public.profiles(id),
  validee_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (patient_id, date_soin)             -- une transmission par patient et par jour
);

-- ============================================================
--  Journal d'audit (append-only)
-- ============================================================
create table if not exists public.audit_log (
  id          bigserial primary key,
  cabinet_id  uuid,
  acteur_id   uuid,
  action      text not null,       -- ex: 'passage.valide', 'transmission.validee'
  cible_type  text,
  cible_id    uuid,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

-- ============================================================
--  Row Level Security : cloisonnement par cabinet
-- ============================================================
alter table public.cabinets      enable row level security;
alter table public.profiles      enable row level security;
alter table public.patients      enable row level security;
alter table public.passages      enable row level security;
alter table public.transmissions enable row level security;
alter table public.audit_log     enable row level security;

-- Profils : chacun lit/écrit le sien
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select using (id = auth.uid() or cabinet_id = public.current_cabinet_id());
drop policy if exists "profiles_self_upsert" on public.profiles;
create policy "profiles_self_upsert" on public.profiles
  for insert with check (id = auth.uid());
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (id = auth.uid());

-- Cabinets : membres du cabinet
drop policy if exists "cabinets_member_select" on public.cabinets;
create policy "cabinets_member_select" on public.cabinets
  for select using (id = public.current_cabinet_id());
drop policy if exists "cabinets_insert" on public.cabinets;
create policy "cabinets_insert" on public.cabinets
  for insert with check (true);

-- Patients / passages / transmissions : visibilité au sein du cabinet
drop policy if exists "patients_cabinet_all" on public.patients;
create policy "patients_cabinet_all" on public.patients
  for all using (cabinet_id = public.current_cabinet_id())
  with check (cabinet_id = public.current_cabinet_id());

drop policy if exists "passages_cabinet_all" on public.passages;
create policy "passages_cabinet_all" on public.passages
  for all using (cabinet_id = public.current_cabinet_id())
  with check (cabinet_id = public.current_cabinet_id());

drop policy if exists "transmissions_cabinet_all" on public.transmissions;
create policy "transmissions_cabinet_all" on public.transmissions
  for all using (cabinet_id = public.current_cabinet_id())
  with check (cabinet_id = public.current_cabinet_id());

drop policy if exists "audit_cabinet_select" on public.audit_log;
create policy "audit_cabinet_select" on public.audit_log
  for select using (cabinet_id = public.current_cabinet_id());
drop policy if exists "audit_insert" on public.audit_log;
create policy "audit_insert" on public.audit_log
  for insert with check (cabinet_id = public.current_cabinet_id());

-- ============================================================
--  Storage : bucket privé pour les enregistrements audio
-- ============================================================
insert into storage.buckets (id, name, public)
values ('passages-audio', 'passages-audio', false)
on conflict (id) do nothing;

-- Accès aux fichiers audio réservé aux membres du même cabinet.
-- Convention de chemin : <cabinet_id>/<passage_id>.webm
drop policy if exists "audio_cabinet_read" on storage.objects;
create policy "audio_cabinet_read" on storage.objects
  for select using (
    bucket_id = 'passages-audio'
    and (storage.foldername(name))[1] = public.current_cabinet_id()::text
  );
drop policy if exists "audio_cabinet_write" on storage.objects;
create policy "audio_cabinet_write" on storage.objects
  for insert with check (
    bucket_id = 'passages-audio'
    and (storage.foldername(name))[1] = public.current_cabinet_id()::text
  );
