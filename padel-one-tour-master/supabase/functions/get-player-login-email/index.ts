import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  authEmailForPhone,
  findPlayerAccountByPhone,
} from '../_shared/phoneUtils.ts';
import { findPlayerAccountUsingAuthUser, isProtectedAuthUser } from '../_shared/protectedAuthUsers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  phone_number: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { phone_number }: RequestBody = await req.json();

    if (!phone_number) {
      return new Response(
        JSON.stringify({ error: 'phone_number is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const normalizedPhone = phone_number;

    console.log('[DEBUG] Input phone:', phone_number);

    const playerAccount = await findPlayerAccountByPhone(supabaseAdmin, phone_number);

    if (!playerAccount) {
      return new Response(
        JSON.stringify({ 
          error: 'Player account not found', 
          debug: { phone_number } 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[DEBUG] Found player_account id:', playerAccount.id);
    console.log('[DEBUG] Found player_account user_id:', playerAccount.user_id);
    console.log('[DEBUG] Found player_account contact email:', playerAccount.email);

    const accountPhone = playerAccount.phone_number || normalizedPhone;
    // Login identity is ALWAYS phone-derived — never reuse a human/contact email for auth.
    const authEmail = authEmailForPhone(accountPhone);
    let playerEmail: string = authEmail;

    if (playerAccount.user_id) {
      console.log('[DEBUG] Player has user_id, getting email from auth system...');

      const protection = await isProtectedAuthUser(supabaseAdmin, playerAccount.user_id);
      if (protection.protected) {
        console.error('[DEBUG] Clearing mis-linked protected auth user:', protection.reason);
        await supabaseAdmin
          .from('player_accounts')
          .update({ user_id: null })
          .eq('id', playerAccount.id);
        playerAccount.user_id = null;
      } else {
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(
          playerAccount.user_id
        );

        if (authUser?.user?.email) {
          playerEmail = authUser.user.email;
          console.log('[DEBUG] Got email from auth.users:', playerEmail);
        } else {
          console.log('[DEBUG] Auth user not found or has no email:', authError?.message);
          playerEmail = authEmail;
        }
      }
    }
    
    console.log('[DEBUG] Final login email to return:', playerEmail);

    // If no user_id, create an auth user tied to this phone only
    if (!playerAccount.user_id) {
      console.log('[DEBUG] Player account has no user_id, creating auth user...');

      const last4Digits = accountPhone.replace(/[^\d]/g, '').slice(-4);
      const defaultPassword = `Player${last4Digits}!`;

      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === authEmail);

      const existingOwner = existingUser
        ? await findPlayerAccountUsingAuthUser(
          supabaseAdmin,
          existingUser.id,
          playerAccount.id,
        )
        : null;

      if (existingUser && !existingOwner) {
        console.log('[DEBUG] Linking existing phone-auth user:', existingUser.id);
        await supabaseAdmin
          .from('player_accounts')
          .update({ user_id: existingUser.id })
          .eq('id', playerAccount.id);
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password: defaultPassword });
        playerEmail = authEmail;
      } else {
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: authEmail,
          password: defaultPassword,
          email_confirm: true,
          user_metadata: {
            display_name: playerAccount.name || 'Player',
            phone_number: accountPhone,
          },
        });

        if (createError) {
          console.error('[DEBUG] Error creating auth user:', createError);
          return new Response(
            JSON.stringify({ error: 'Could not create auth user', details: createError.message }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        if (newUser?.user?.id) {
          await supabaseAdmin
            .from('player_accounts')
            .update({ user_id: newUser.user.id })
            .eq('id', playerAccount.id);

          await supabaseAdmin
            .from('user_logo_settings')
            .upsert({ user_id: newUser.user.id, role: 'player', logo_url: null }, { onConflict: 'user_id' });

          console.log('[DEBUG] Created auth user:', newUser.user.id);
          playerEmail = authEmail;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        email: playerEmail,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in get-player-login-email:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
