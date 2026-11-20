/** What Supabase adds to an email link it sends back to the app (sign-up confirmation, password reset). */
export type AuthLink = {
  accessToken: string | null;
  refreshToken: string | null;
  /** Sign-ins that use the PKCE flow return a one-time code instead of tokens. */
  code: string | null;
  /** "signup", "recovery", "magiclink", "email_change", … */
  type: string | null;
  error: string | null;
};

function decode(text: string) {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    return text;
  }
}

/**
 * Reads both the query (`?…`) and the fragment (`#…`) of the link: Supabase's default (implicit)
 * flow puts the tokens after `#`, while errors and PKCE codes arrive in the query.
 */
export function parseAuthLink(url: string): AuthLink {
  const hashIndex = url.indexOf('#');
  const main = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const fragment = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const queryIndex = main.indexOf('?');
  const query = queryIndex >= 0 ? main.slice(queryIndex + 1) : '';

  const values = new Map<string, string>();
  for (const pair of `${query}&${fragment}`.split('&')) {
    if (!pair) continue;
    const equals = pair.indexOf('=');
    const key = decode(equals >= 0 ? pair.slice(0, equals) : pair);
    if (key) values.set(key, decode(equals >= 0 ? pair.slice(equals + 1) : ''));
  }
  const get = (key: string) => values.get(key) || null;

  return {
    accessToken: get('access_token'),
    refreshToken: get('refresh_token'),
    code: get('code'),
    type: get('type'),
    error: get('error_description') ?? get('error'),
  };
}
