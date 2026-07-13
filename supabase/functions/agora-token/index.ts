import "@supabase/functions-js/edge-runtime.d.ts";
import { RtcRole, RtcTokenBuilder } from "npm:agora-access-token";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { channelName } = await req.json();

    if (!channelName) {
      return Response.json(
        { error: "Falta channelName" },
        { status: 400, headers: corsHeaders }
      );
    }

    const appId = Deno.env.get("AGORA_APP_ID");
    const appCertificate = Deno.env.get("AGORA_APP_CERTIFICATE");

    if (!appId || !appCertificate) {
      return Response.json(
        { error: "Faltan secrets de Agora" },
        { status: 500, headers: corsHeaders }
      );
    }

    const uid = Math.floor(Math.random() * 2000000000) + 1;
    const role = RtcRole.PUBLISHER;

    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      role,
      privilegeExpiredTs
    );

    return Response.json(
      {
        appId,
        token,
        uid,
        channelName,
        expiresIn: expirationTimeInSeconds,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    return Response.json(
      { error: error?.message ?? "Error generando token" },
      { status: 500, headers: corsHeaders }
    );
  }
});