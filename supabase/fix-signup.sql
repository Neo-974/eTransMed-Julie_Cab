-- eTransMed — Correctif inscription (RLS)
-- À exécuter UNE FOIS dans le SQL Editor de Supabase si vous avez déjà lancé schema.sql
-- avant l'ajout de cette fonction. (Déjà inclus dans schema.sql pour les nouvelles bases.)
--
-- Crée le cabinet + le profil du titulaire en une transaction, en contournant
-- proprement la RLS au moment de l'inscription (le profil n'existe pas encore).

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
