import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { findPlayerAccountUsingAuthUser } from "../_shared/protectedAuthUsers.ts";
import {
  authEmailForPhone,
  findPlayerAccountByPhone,
  storagePhoneFormat,
} from "../_shared/phoneUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function isTempContactEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  return email.includes("@temp.player.com") || email.endsWith("@boostpadel.app");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();
    const {
      email,
      contact_email,
      password,
      phone_number,
      name,
      player_category,
      level,
      level_reliability_percent,
    } = body;

    if (!password || !phone_number || !name) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields (phone_number, name, password)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const storedPhone = storagePhoneFormat(phone_number);
    const contactEmailRaw = contact_email || email || null;
    const contactEmail = isTempContactEmail(contactEmailRaw) ? null : contactEmailRaw;

    const existingAccount = await findPlayerAccountByPhone(supabaseAdmin, phone_number);

    if (existingAccount) {
      if ((player_category && !existingAccount.player_category) || (level != null && (existingAccount as any).level == null)) {
        const { data: updatedAccount } = await supabaseAdmin
          .from("player_accounts")
          .update({
            player_category: (existingAccount as any).player_category ?? player_category ?? null,
            level: (existingAccount as any).level ?? level ?? null,
          })
          .eq("id", existingAccount.id)
          .select("*")
          .single();

        return new Response(
          JSON.stringify({
            success: true,
            account: updatedAccount || existingAccount,
            isNew: false,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          account: existingAccount,
          isNew: false,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Identity rule: 1 phone → 1 auth user. Auth email is ALWAYS phone-derived.
    const authEmail = authEmailForPhone(storedPhone);
    let userId: string | null = null;

    const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers();
    const authUserForPhone = existingAuthUsers?.users?.find((u) => u.email === authEmail);

    if (authUserForPhone) {
      const alreadyLinked = await findPlayerAccountUsingAuthUser(
        supabaseAdmin,
        authUserForPhone.id,
      );
      if (!alreadyLinked) {
        userId = authUserForPhone.id;
      }
    }

    if (!userId) {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: authEmail,
        password,
        phone: storedPhone,
        email_confirm: true,
        user_metadata: {
          display_name: name,
          phone_number: storedPhone,
        },
      });

      if (createError) {
        return new Response(
          JSON.stringify({ success: false, error: createError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      userId = newUser?.user?.id || null;
    } else {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        phone: storedPhone,
        password,
        user_metadata: {
          display_name: name,
          phone_number: storedPhone,
        },
      });
    }

    const { data: newAccount, error: accountError } = await supabaseAdmin
      .from("player_accounts")
      .insert({
        phone_number: storedPhone,
        user_id: userId,
        name,
        email: contactEmail,
        player_category: player_category ?? null,
        level: level ?? null,
        level_reliability_percent: level_reliability_percent ?? null,
      })
      .select()
      .single();

    if (accountError) {
      return new Response(
        JSON.stringify({ success: false, error: accountError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (userId) {
      const { data: existingRole } = await supabaseAdmin
        .from("user_logo_settings")
        .select("id, role")
        .eq("user_id", userId)
        .maybeSingle();

      if (!existingRole) {
        await supabaseAdmin
          .from("user_logo_settings")
          .insert({ user_id: userId, role: "player", logo_url: null });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        account: newAccount,
        isNew: true,
        userId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
