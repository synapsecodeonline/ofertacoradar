// Detecta user-agents de bots/crawlers que nao sao visitantes reais.
// Pageviews e cliques deles nao devem entrar nas estatisticas do admin.
const BOT_UA =
  /headless|bot\b|crawler|spider|slurp|facebookexternalhit|whatsapp|telegrambot|discordbot|skypeuripreview|linkedinbot|pinterest|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|gptbot|claudebot|amazonbot|google-inspectiontool|lighthouse|pagespeed|pingdom|uptimerobot|statuscake|curl\/|wget\/|python-requests|httpclient|go-http-client|java\//i;

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return BOT_UA.test(userAgent);
}
