// Same Auth0 tenant as ComicLaw / AgentPlanet, with Embody's own SPA client
// so owner login is the same door but callbacks are ours.
export const AUTH0_DOMAIN =
  process.env.NEXT_PUBLIC_AUTH0_DOMAIN ?? "dev-ypufda63738rkary.us.auth0.com";

export const AUTH0_CLIENT_ID =
  process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID ?? "u5v4HwPl2mSHuEQKKppD7XbmEIi54p7q";

export const AUTH0_AUDIENCE =
  process.env.NEXT_PUBLIC_AUTH0_AUDIENCE ?? "https://api.agentplanet.org";
