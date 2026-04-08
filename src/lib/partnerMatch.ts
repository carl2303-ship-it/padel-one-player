import { supabase } from "./supabase";

const SUPABASE_URL = "https://rqiwnxcexsccguruiteq.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxaXdueGNleHNjY2d1cnVpdGVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3Njc5MzcsImV4cCI6MjA3NTM0MzkzN30.Dl05zPQDtPVpmvn_Y-JokT3wDq0Oh9uF3op5xcHZpkY";

export type PartnerInvite = {
  id: string;
  tournament_id: string;
  category_id: string | null;
  created_at: string;
  expires_at: string;
  requester_player_account_id: string;
  requester_name?: string;
  tournament_name?: string;
  category_name?: string;
};

/** Resumo dos convites que o utilizador enviou (pedido em aberto neste torneio). */
export type PartnerMatchRequesterSummary = {
  requestId: string;
  invitationsTotal: number;
  pending: number;
  accepted: number;
  declined: number;
  expired: number;
  cancelled: number;
};

async function callFn<T = any>(name: string, payload: any): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sessão inválida");

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json?.success === false) {
    throw new Error(json?.error || "Falha no pedido");
  }
  return json as T;
}

export async function requestPartnerMatch(params: {
  tournamentId: string;
  categoryId?: string | null;
  sidePreference: "right" | "left";
  targetMode: "any" | "following";
}) {
  return callFn("request-partner-match", params);
}

export async function acceptPartnerInvite(inviteId: string): Promise<{ checkoutUrl?: string | null }> {
  return callFn("accept-partner-invite", { inviteId });
}

export async function declinePartnerInvite(inviteId: string): Promise<void> {
  await callFn("decline-partner-invite", { inviteId });
}

export async function fetchPendingPartnerInvites(playerAccountId: string): Promise<PartnerInvite[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("partner_match_invites")
    .select(`
      id,
      tournament_id,
      category_id,
      created_at,
      expires_at,
      requester_player_account_id,
      requester:player_accounts!partner_match_invites_requester_player_account_id_fkey(name),
      tournament:tournaments(name),
      category:tournament_categories(name)
    `)
    .eq("invitee_user_id", userId)
    .eq("status", "pending")
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    tournament_id: row.tournament_id,
    category_id: row.category_id,
    created_at: row.created_at,
    expires_at: row.expires_at,
    requester_player_account_id: row.requester_player_account_id,
    requester_name: row.requester?.name,
    tournament_name: row.tournament?.name,
    category_name: row.category?.name,
  }));
}

export async function fetchPartnerMatchRequesterSummary(tournamentId: string): Promise<PartnerMatchRequesterSummary | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data: req, error: reqErr } = await supabase
    .from("partner_match_requests")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("requester_user_id", userId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reqErr || !req) return null;

  const { data: rows, error: invErr } = await supabase.from("partner_match_invites").select("status").eq("request_id", req.id);

  if (invErr || !rows?.length) {
    return {
      requestId: req.id,
      invitationsTotal: 0,
      pending: 0,
      accepted: 0,
      declined: 0,
      expired: 0,
      cancelled: 0,
    };
  }

  let pending = 0,
    accepted = 0,
    declined = 0,
    expired = 0,
    cancelled = 0;
  for (const row of rows) {
    switch ((row as { status: string }).status) {
      case "pending":
        pending++;
        break;
      case "accepted":
        accepted++;
        break;
      case "declined":
        declined++;
        break;
      case "expired":
        expired++;
        break;
      case "cancelled":
        cancelled++;
        break;
      default:
        break;
    }
  }

  return {
    requestId: req.id,
    invitationsTotal: rows.length,
    pending,
    accepted,
    declined,
    expired,
    cancelled,
  };
}

