// Same Auth0 tenant as ComicLaw / AgentPlanet, with Embody's own SPA client
// so owner login is the same door but callbacks are ours.
// Env values pasted into dashboards can carry stray whitespace/newlines;
// Auth0 matches audience exactly, so trim defensively.
export const AUTH0_DOMAIN = (
  process.env.NEXT_PUBLIC_AUTH0_DOMAIN ?? "dev-ypufda63738rkary.us.auth0.com"
).trim();

export const AUTH0_CLIENT_ID = (
  process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID ?? "u5v4HwPl2mSHuEQKKppD7XbmEIi54p7q"
).trim();

export const AUTH0_AUDIENCE = (
  process.env.NEXT_PUBLIC_AUTH0_AUDIENCE ?? "https://api.agentplanet.org"
).trim();
