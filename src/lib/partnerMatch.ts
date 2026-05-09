import { supabase } from "./supabase";
import { isPlayerEligibleForCategory } from "./categoryEligibility";

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
  async function getAccessToken(): Promise<string | null> {
    const { data: sessionData } = await supabase.auth.getSession();
    const current = sessionData.session?.access_token ?? null;
    if (current) return current;

    const { data: refreshed } = await supabase.auth.refreshSession();
    return refreshed.session?.access_token ?? null;
  }

  async function doFetch(token: string) {
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
    return { resp, json };
  }

  const firstToken = await getAccessToken();
  if (!firstToken) throw new Error("Sessão inválida. Volta a entrar na conta.");

  let { resp, json } = await doFetch(firstToken);
  if (resp.status === 401 || resp.status === 403) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    const retryToken = refreshed.session?.access_token ?? null;
    if (!retryToken) throw new Error("Sessão inválida. Volta a entrar na conta.");
    ({ resp, json } = await doFetch(retryToken));
  }

  if (!resp.ok || json?.success === false) {
    throw new Error(json?.error || "Falha no pedido");
  }
  return json as T;
}

export async function requestPartnerMatch(params: {
  tournamentId: string;
  categoryId?: string | null;
  sidePreference: "right" | "left" | "both";
  targetMode: "any" | "following" | "direct";
  minLevel?: number;
  maxLevel?: number;
  inviteePhone?: string;
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
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!playerAccountId) return [];

  // Várias linhas em player_accounts podem ter o mesmo auth user_id (ou login por telefone vs convite a outro id).
  // Incluir todos os ids de conta deste utilizador para não "perder" convites.
  let inviteeAccountIds = [playerAccountId];
  if (userId) {
    const { data: accRows } = await supabase.from("player_accounts").select("id").eq("user_id", userId);
    const ids = (accRows ?? []).map((r: { id: string }) => r.id).filter(Boolean);
    inviteeAccountIds = [...new Set([...ids, playerAccountId])];
  }

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
      invitee_player_account_id,
      requester:player_accounts!partner_match_invites_requester_player_account_id_fkey(name),
      tournament:tournaments(name),
      category:tournament_categories(name, accepted_levels, min_level, max_level)
    `)
    .in("invitee_player_account_id", inviteeAccountIds)
    .eq("status", "pending")
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const inviteeIds = [...new Set((data as any[]).map((r) => r.invitee_player_account_id).filter(Boolean))];
  const { data: inviteeProfiles } = inviteeIds.length
    ? await supabase.from("player_accounts").select("id, player_category, level").in("id", inviteeIds)
    : { data: [] as { id: string; player_category: string | null; level: number | null }[] };
  const profileByAccountId = new Map((inviteeProfiles ?? []).map((p) => [p.id, p]));

  // Filter out invites for tournaments where invitee is already enrolled
  const tournamentIds = [...new Set((data as any[]).map((r) => r.tournament_id).filter(Boolean))];
  let enrolledTournamentIds = new Set<string>();
  if (tournamentIds.length > 0) {
    const { data: enrolledPlayers } = await supabase
      .from("players")
      .select("tournament_id")
      .in("player_account_id", inviteeAccountIds)
      .in("tournament_id", tournamentIds);
    const { data: enrolledTeams } = await supabase
      .from("teams")
      .select("tournament_id, player1_id, player2_id")
      .in("tournament_id", tournamentIds);

    if (enrolledPlayers) {
      for (const p of enrolledPlayers) enrolledTournamentIds.add(p.tournament_id);
    }
    if (enrolledTeams) {
      const { data: playerLinks } = await supabase
        .from("players")
        .select("id, player_account_id")
        .in("player_account_id", inviteeAccountIds);
      const myPlayerIds = new Set((playerLinks ?? []).map((p: any) => p.id));
      for (const tm of enrolledTeams as any[]) {
        if (myPlayerIds.has(tm.player1_id) || myPlayerIds.has(tm.player2_id)) {
          enrolledTournamentIds.add(tm.tournament_id);
        }
      }
    }
  }

  const eligibleRows = (data as any[]).filter((row) => {
    if (enrolledTournamentIds.has(row.tournament_id)) return false;
    const cat = row.category;
    if (!cat?.name) return true;
    const profile = profileByAccountId.get(row.invitee_player_account_id);
    return isPlayerEligibleForCategory(
      {
        name: cat.name,
        accepted_levels: cat.accepted_levels ?? null,
        min_level: cat.min_level ?? null,
        max_level: cat.max_level ?? null,
      },
      {
        player_category: profile?.player_category ?? null,
        level: profile?.level ?? null,
      },
    );
  });

  return eligibleRows.map((row: any) => ({
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

