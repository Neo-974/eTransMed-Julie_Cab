-- eTransMed — Gestion des membres par le titulaire
-- (renommer, changer de rôle, retirer du cabinet). À exécuter une fois. Idempotent.

-- L'utilisateur courant est-il titulaire ? (SECURITY DEFINER : pas de récursion RLS)
create or replace function public.is_titulaire()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role = 'titulaire' from public.profiles where id = auth.uid()), false)
$$;

-- Le titulaire peut modifier les profils de son cabinet (nom, rôle) et détacher
-- un membre (cabinet_id -> NULL = « retirer du cabinet »).
do $$ begin
  create policy "profiles_titulaire_update" on public.profiles
    for update
    using (cabinet_id = public.current_cabinet_id() and public.is_titulaire())
    with check (cabinet_id = public.current_cabinet_id() or cabinet_id is null);
exception when duplicate_object then null; end $$;
