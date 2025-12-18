import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from '../_shared/cors.ts'

// FIX: Se declara la variable global Deno para que TypeScript la reconozca, ya que este código se ejecuta en un entorno Deno.
declare const Deno: any;

Deno.serve(async (req) => {
  // Manejar la solicitud pre-vuelo de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, role } = await req.json()

    // Crear un cliente de Supabase con el rol de servicio para operaciones de administración
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Crear un cliente de Supabase para verificar los permisos del usuario que realiza la llamada
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Obtener el usuario que realiza la solicitud
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      throw new Error("Usuario no autenticado.")
    }

    // Obtener el perfil del usuario para verificar su rol
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error("No se pudo verificar el rol del usuario.")
    }

    // Solo los superadministradores pueden invitar usuarios
    if (profile.role !== 'superadmin') {
      return new Response(JSON.stringify({ error: 'No tienes permiso para invitar usuarios.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // Invitar al nuevo usuario
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { role: role || 'usuario' } // Se puede especificar el rol en la invitación
    })

    if (error) {
      throw error
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})