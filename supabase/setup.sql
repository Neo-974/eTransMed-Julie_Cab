-- eTransMed — SETUP COMPLET (NOUVEAU projet Supabase, SQL Editor)
-- Schéma de base + inscription + tournées + paramètres cabinet & invitations.
-- Données fictives / anonymisées uniquement (Supabase n'est pas HDS).

-- ====================================================================
-- PARTIE 1 — SCHÉMA DE BASE
-- ====================================================================

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
create type public.user_role as enum ('titulaire', 'collaborateur', 'remplacant');

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
create type public.passage_status as enum ('brouillon', 'valide');

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
create type public.transmission_format as enum ('fluide', 'ciblee');
create type public.transmission_status as enum ('brouillon', 'validee');

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
create policy "profiles_self_select" on public.profiles
  for select using (id = auth.uid() or cabinet_id = public.current_cabinet_id());
create policy "profiles_self_upsert" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles_self_update" on public.profiles
  for update using (id = auth.uid());

-- Cabinets : membres du cabinet
create policy "cabinets_member_select" on public.cabinets
  for select using (id = public.current_cabinet_id());
create policy "cabinets_insert" on public.cabinets
  for insert with check (true);

-- Patients / passages / transmissions : visibilité au sein du cabinet
create policy "patients_cabinet_all" on public.patients
  for all using (cabinet_id = public.current_cabinet_id())
  with check (cabinet_id = public.current_cabinet_id());

create policy "passages_cabinet_all" on public.passages
  for all using (cabinet_id = public.current_cabinet_id())
  with check (cabinet_id = public.current_cabinet_id());

create policy "transmissions_cabinet_all" on public.transmissions
  for all using (cabinet_id = public.current_cabinet_id())
  with check (cabinet_id = public.current_cabinet_id());

create policy "audit_cabinet_select" on public.audit_log
  for select using (cabinet_id = public.current_cabinet_id());
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
create policy "audio_cabinet_read" on storage.objects
  for select using (
    bucket_id = 'passages-audio'
    and (storage.foldername(name))[1] = public.current_cabinet_id()::text
  );
create policy "audio_cabinet_write" on storage.objects
  for insert with check (
    bucket_id = 'passages-audio'
    and (storage.foldername(name))[1] = public.current_cabinet_id()::text
  );

-- ====================================================================
-- PARTIE 2 — TOURNÉES
-- ====================================================================

-- eTransMed — Ajout des TOURNÉES
-- À exécuter UNE FOIS dans le SQL Editor de Supabase (après schema.sql).
-- Idempotent : peut être relancé sans risque.

-- Moment de la journée pour un patient dans une tournée
do $$ begin
  create type public.moment_jour as enum ('matin', 'apres_midi', 'soir');
exception when duplicate_object then null; end $$;

-- Une tournée appartient à un cabinet
create table if not exists public.tournees (
  id          uuid primary key default gen_random_uuid(),
  cabinet_id  uuid not null references public.cabinets(id) on delete cascade,
  nom         text not null,
  description text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_tournees_cabinet on public.tournees(cabinet_id);

-- Praticiens affectés à une tournée (many-to-many)
create table if not exists public.tournee_membres (
  tournee_id  uuid not null references public.tournees(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  cabinet_id  uuid not null references public.cabinets(id) on delete cascade,
  primary key (tournee_id, profile_id)
);

-- Patients rattachés à une tournée, avec le moment de la journée (many-to-many).
-- Un même patient peut être dans plusieurs tournées (ex. matin dans l'une,
-- après-midi dans une autre).
create table if not exists public.tournee_patients (
  tournee_id  uuid not null references public.tournees(id) on delete cascade,
  patient_id  uuid not null references public.patients(id) on delete cascade,
  cabinet_id  uuid not null references public.cabinets(id) on delete cascade,
  moment      public.moment_jour not null default 'matin',
  created_at  timestamptz not null default now(),
  primary key (tournee_id, patient_id)
);
create index if not exists idx_tp_patient on public.tournee_patients(patient_id);
create index if not exists idx_tp_tournee on public.tournee_patients(tournee_id);

-- RLS : tout est cloisonné par cabinet
alter table public.tournees         enable row level security;
alter table public.tournee_membres  enable row level security;
alter table public.tournee_patients enable row level security;

do $$ begin
  create policy "tournees_cabinet_all" on public.tournees
    for all using (cabinet_id = public.current_cabinet_id())
    with check (cabinet_id = public.current_cabinet_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "tournee_membres_cabinet_all" on public.tournee_membres
    for all using (cabinet_id = public.current_cabinet_id())
    with check (cabinet_id = public.current_cabinet_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "tournee_patients_cabinet_all" on public.tournee_patients
    for all using (cabinet_id = public.current_cabinet_id())
    with check (cabinet_id = public.current_cabinet_id());
exception when duplicate_object then null; end $$;

-- ====================================================================
-- PARTIE 3 — PARAMÈTRES CABINET & INVITATIONS
-- ====================================================================

-- eTransMed — Paramètres cabinet + Invitations (code cabinet)
-- À exécuter UNE FOIS dans le SQL Editor (après schema.sql). Idempotent.

-- Colonnes cabinet : description + code d'invitation
alter table public.cabinets add column if not exists description text;
alter table public.cabinets add column if not exists code_invitation text;
create unique index if not exists idx_cabinets_code on public.cabinets(code_invitation);

-- Backfill : donne un code aux cabinets existants qui n'en ont pas
update public.cabinets
set code_invitation = upper(substr(md5(random()::text || id::text), 1, 6))
where code_invitation is null;

-- Autoriser les membres à modifier leur cabinet (renommer, description)
do $$ begin
  create policy "cabinets_member_update" on public.cabinets
    for update using (id = public.current_cabinet_id())
    with check (id = public.current_cabinet_id());
exception when duplicate_object then null; end $$;

-- Création de cabinet : génère aussi un code d'invitation
create or replace function public.create_cabinet_and_join(cabinet_nom text, membre_nom text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  new_cabinet_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Utilisateur non authentifié';
  end if;

  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into public.cabinets (nom, code_invitation)
  values (cabinet_nom, v_code)
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

-- Rejoindre un cabinet existant avec son code d'invitation
create or replace function public.join_cabinet_with_code(p_code text, membre_nom text, p_role text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_cab uuid;
  v_role public.user_role;
begin
  if auth.uid() is null then
    raise exception 'Utilisateur non authentifié';
  end if;

  select id into v_cab from public.cabinets
  where code_invitation = upper(trim(p_code));
  if v_cab is null then
    raise exception 'Code cabinet invalide';
  end if;

  v_role := case when p_role in ('collaborateur', 'remplacant')
                 then p_role::public.user_role else 'collaborateur' end;

  insert into public.profiles (id, cabinet_id, nom_complet, role)
  values (auth.uid(), v_cab, membre_nom, v_role)
  on conflict (id) do update
    set cabinet_id = excluded.cabinet_id,
        nom_complet = excluded.nom_complet,
        role = excluded.role;

  return v_cab;
end;
$$;

grant execute on function public.create_cabinet_and_join(text, text) to authenticated;
grant execute on function public.join_cabinet_with_code(text, text, text) to authenticated;
