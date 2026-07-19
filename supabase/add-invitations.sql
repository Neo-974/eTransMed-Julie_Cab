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
