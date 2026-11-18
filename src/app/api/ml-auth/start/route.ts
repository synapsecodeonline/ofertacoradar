import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { siteUrl } from "@/lib/site";

// Inicio do fluxo OAuth do Mercado Livre (uso unico/manual):
// GET /api/ml-auth/start?key=ML_AUTH_SECRET redireciona para a tela de
// autorizacao do ML. O Redirect URI cadastrado no app deve ser
// {siteUrl()}/api/ml-auth/callback.
// PKCE: o code_verifier vai embutido no state ("{secret}.{verifier}") e o
// callback o devolve na troca do code — apps ML com PKCE ativo exigem isso.
export function GET(request: NextRequest) {
  const secret = process.env.ML_AUTH_SECRET;
  const clientId = process.env.ML_CLIENT_ID;
  if (!secret || !clientId) {
    return NextResponse.json(
      { error: "ML_AUTH_SECRET e ML_CLIENT_ID nao configurados" },
      { status: 500 },
    );
  }
  if (request.nextUrl.searchParams.get("key") !== secret) {
    return NextResponse.json({ error: "key invalida" }, { status: 403 });
  }

  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = `${secret}.${verifier}`;

  const redirectUri = `${siteUrl()}/api/ml-auth/callback`;
  const authUrl =
    "https://auth.mercadolivre.com.br/authorization" +
    `?response_type=code&client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    `&code_challenge=${challenge}` +
    `&code_challenge_method=S256`;

  return NextResponse.redirect(authUrl);
}
