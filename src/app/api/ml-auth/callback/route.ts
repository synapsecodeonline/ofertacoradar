import { NextRequest, NextResponse } from "next/server";
import { siteUrl } from "@/lib/site";
import { saveMlTokens } from "@/lib/mercadolivre";

// Callback do OAuth do Mercado Livre: troca o code por tokens e grava
// no SyncState ("ml-token", phase = JSON — ver src/lib/mercadolivre.ts).
// state = "{ML_AUTH_SECRET}.{code_verifier}" (ver /start).
export async function GET(request: NextRequest) {
  const secret = process.env.ML_AUTH_SECRET;
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  const fail = (msg: string) =>
    new NextResponse(`Falha na autorizacao do Mercado Livre: ${msg}`, {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });

  if (!secret || !clientId || !clientSecret) {
    return fail("variaveis ML_* nao configuradas");
  }

  const url = request.nextUrl;
  const state = url.searchParams.get("state") ?? "";
  const [stateSecret, codeVerifier] = state.split(".");
  if (stateSecret !== secret) {
    return fail("state invalido");
  }
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  if (error || !code) {
    return fail(error ?? "code ausente");
  }

  const redirectUri = `${siteUrl()}/api/ml-auth/callback`;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  if (codeVerifier) body.set("code_verifier", codeVerifier);

  const res = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
    message?: string;
  };
  if (!res.ok || !json.access_token || !json.refresh_token) {
    const detail =
      json.error_description ?? json.message ?? json.error ?? "?";
    return fail(`troca de token falhou (${res.status}): ${detail}`);
  }

  await saveMlTokens(
    json.access_token,
    json.refresh_token,
    json.expires_in ?? 21600,
  );

  return new NextResponse(
    "Autorizado! Tokens do Mercado Livre salvos. Pode fechar esta aba.",
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
