-- eTransMed — Données de démonstration (FICTIVES)
-- À exécuter dans le SQL Editor de Supabase APRÈS avoir créé votre compte
-- (inscription dans l'app) et exécuté schema.sql.
--
-- Ce script rattache les patients fictifs à VOTRE cabinet (le plus récent).
-- Aucune donnée réelle — usage démonstration uniquement.

with cab as (
  select id from public.cabinets order by created_at desc limit 1
)
insert into public.patients (cabinet_id, nom, prenom, date_naissance, ajout_a_la_volee)
select cab.id, v.nom, v.prenom, v.dob::date, false
from cab,
  (values
    ('BERNARD',  'Odette',  '1938-02-03'),
    ('FONTAINE', 'Marcel',  '1945-11-17'),
    ('GARNIER',  'Louise',  '1952-07-29'),
    ('MOREAU',   'Henri',   '1940-02-02')
  ) as v(nom, prenom, dob)
where not exists (
  select 1 from public.patients p
  where p.cabinet_id = cab.id and p.nom = v.nom and p.prenom = v.prenom
);

-- Un passage validé d'exemple pour BERNARD Odette (visite du matin)
with cab as (
  select id from public.cabinets order by created_at desc limit 1
),
pat as (
  select p.id, p.cabinet_id from public.patients p, cab
  where p.cabinet_id = cab.id and p.nom = 'BERNARD' and p.prenom = 'Odette'
  limit 1
),
auth_user as (
  select pr.id from public.profiles pr, cab where pr.cabinet_id = cab.id limit 1
)
insert into public.passages (patient_id, cabinet_id, auteur_id, recorded_at, transcript_raw, transcript_corrige, statut, valide_at)
select pat.id, pat.cabinet_id, auth_user.id,
  (current_date + time '08:05'),
  'Réfection du pansement de l''ulcère de jambe droite, plaie propre en voie de cicatrisation, exsudat modéré. TA 13/8, pouls 72. Glycémie capillaire à jeun 1,42 g/L, insuline 12 unités réalisée. Patiente algique, EVA à 4.',
  'Réfection du pansement de l''ulcère de jambe droite, plaie propre en voie de cicatrisation, exsudat modéré. TA 13/8, pouls 72. Glycémie capillaire à jeun 1,42 g/L, insuline 12 unités réalisée. Patiente algique, EVA à 4.',
  'valide', now()
from pat, auth_user
where not exists (
  select 1 from public.passages ps where ps.patient_id = pat.id
);
