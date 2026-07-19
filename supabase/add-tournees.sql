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
