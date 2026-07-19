"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Member = { id: string; nom_complet: string | null; role: string };

const ROLES = [
  { key: "titulaire", label: "Titulaire" },
  { key: "collaborateur", label: "Collaborateur" },
  { key: "remplacant", label: "Remplaçant" },
];
const roleLabel = (k: string) => ROLES.find((r) => r.key === k)?.label ?? k;

export default function MembersManager({
  members,
  currentUserId,
  isTitulaire,
}: {
  members: Member[];
  currentUserId: string;
  isTitulaire: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [names, setNames] = useState<Record<string, string>>(
    Object.fromEntries(members.map((m) => [m.id, m.nom_complet ?? ""]))
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveName(id: string) {
    setBusy(id);
    setError(null);
    const { error } = await supabase
      .from("profiles")
      .update({ nom_complet: names[id] })
      .eq("id", id);
    setBusy(null);
    if (error) setError(error.message);
    else router.refresh();
  }

  async function changeRole(id: string, role: string) {
    setBusy(id);
    setError(null);
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    setBusy(null);
    if (error) setError(error.message);
    else router.refresh();
  }

  async function remove(id: string, nom: string) {
    if (!confirm(`Retirer ${nom || "ce praticien"} du cabinet ?`)) return;
    setBusy(id);
    setError(null);
    // Détache du cabinet (garde le compte + les transmissions déjà écrites)
    const { error } = await supabase.from("profiles").update({ cabinet_id: null }).eq("id", id);
    setBusy(null);
    if (error) setError(error.message);
    else router.refresh();
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y rounded-lg border">
        {members.map((m) => {
          const isSelf = m.id === currentUserId;
          const canManageOther = isTitulaire && !isSelf;
          const canRename = isSelf || isTitulaire;
          return (
            <li key={m.id} className="space-y-2 px-4 py-3 text-sm">
              <div className="flex items-center gap-2">
                {canRename ? (
                  <>
                    <input
                      value={names[m.id] ?? ""}
                      onChange={(e) => setNames({ ...names, [m.id]: e.target.value })}
                      className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1"
                    />
                    <button
                      onClick={() => saveName(m.id)}
                      disabled={busy === m.id}
                      className="rounded bg-brand px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                    >
                      ✓
                    </button>
                  </>
                ) : (
                  <span className="flex-1 font-medium">{m.nom_complet ?? "—"}</span>
                )}
                {isSelf && <span className="text-[11px] text-slate-400">(vous)</span>}
              </div>

              <div className="flex items-center gap-2">
                {canManageOther ? (
                  <select
                    value={m.role}
                    disabled={busy === m.id}
                    onChange={(e) => changeRole(m.id, e.target.value)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                  >
                    {ROLES.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                    {roleLabel(m.role)}
                  </span>
                )}
                {canManageOther && (
                  <button
                    onClick={() => remove(m.id, m.nom_complet ?? "")}
                    disabled={busy === m.id}
                    className="ml-auto rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Retirer
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {!isTitulaire && (
        <p className="text-xs text-slate-400">
          Seul le titulaire peut changer les rôles ou retirer un praticien.
        </p>
      )}
    </div>
  );
}
