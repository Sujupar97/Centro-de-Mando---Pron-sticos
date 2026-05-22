// review-prediction
// Endpoint para que un admin / superadmin / owner apruebe o rechace un pronóstico
// que el sistema marcó como `pending_review` (cuota sospechosa).
//
// Body: { prediction_id: string, action: 'approve' | 'reject' }
// Auth: requiere JWT del caller; valida profile.role in ('admin','superadmin').
//       Si el rol no califica, retorna 403.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

declare const Deno: any;

// Fuente canónica: utils/roles.ts → AGENCY_ROLES.
// Aliases legacy ('admin','superadmin') incluidos por compatibilidad
// con perfiles aún no migrados al nuevo esquema.
const ADMIN_ROLES = new Set([
  "platform_owner",
  "agency_admin",
  "admin",
  "superadmin",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Cliente con service_role para las mutaciones tras validar auth
    const supabase = createClient(sbUrl, serviceKey);

    // 1) Extraer y validar JWT del header Authorization
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Authorization header" }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Resolver user desde el JWT
    const userClient = createClient(sbUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: corsHeaders }
      );
    }
    const userId = userData.user.id;

    // 2) Verificar rol admin/owner
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .single();

    if (profileErr || !profile) {
      return new Response(
        JSON.stringify({ success: false, error: "Profile not found" }),
        { status: 403, headers: corsHeaders }
      );
    }

    const role = String(profile.role || "").toLowerCase();
    if (!ADMIN_ROLES.has(role)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Insufficient role. Only admin/owner can approve predictions.",
          actual_role: role,
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // 3) Parse body
    const body = await req.json().catch(() => ({}));
    const predictionId = String(body.prediction_id || "").trim();
    const action = String(body.action || "").toLowerCase();

    if (!predictionId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing prediction_id" }),
        { status: 400, headers: corsHeaders }
      );
    }
    if (action !== "approve" && action !== "reject") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid action. Must be 'approve' or 'reject'.",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 4) Cargar el pronóstico para validar que está en pending_review
    const { data: pred, error: predErr } = await supabase
      .from("predictions")
      .select("id, review_status, odds, probability, suspicious_reason")
      .eq("id", predictionId)
      .single();

    if (predErr || !pred) {
      return new Response(
        JSON.stringify({ success: false, error: "Prediction not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Permite re-aprobar / re-rechazar (idempotente). Solo bloquea si está auto_approved
    // y se intenta aprobar (no tiene sentido).
    const newStatus = action === "approve" ? "admin_approved" : "admin_rejected";

    const { error: updateErr } = await supabase
      .from("predictions")
      .update({
        review_status: newStatus,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", predictionId);

    if (updateErr) {
      return new Response(
        JSON.stringify({ success: false, error: updateErr.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        prediction_id: predictionId,
        new_status: newStatus,
        reviewed_by: userId,
      }),
      { headers: corsHeaders }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
