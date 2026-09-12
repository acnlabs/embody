// Same Auth0 tenant as ComicLaw / AgentPlanet. This public SPA client is
// ComicLaw Studio's; v0 reuses it so owner login is the same door.
// Override NEXT_PUBLIC_AUTH0_CLIENT_ID when Embody has its own SPA.
export const AUTH0_DOMAIN =
  process.env.NEXT_PUBLIC_AUTH0_DOMAIN ?? "dev-ypufda63738rkary.us.auth0.com";

export const AUTH0_CLIENT_ID =
  process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID ?? "QLV1xUDPecgw9mqYlViaw2OZ8DzeEGGI";

export const AUTH0_AUDIENCE =
  process.env.NEXT_PUBLIC_AUTH0_AUDIENCE ?? "https://api.agentplanet.org";
