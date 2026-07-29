import { timingSafeEqual } from "node:crypto";

export type ProxyAuthenticator = (
  authorizationHeader: string | undefined,
) => boolean | Promise<boolean>;

export function createServiceTokenAuthenticator(
  expectedToken = process.env.PROXY_INTERNAL_TOKEN,
): ProxyAuthenticator {
  return (authorizationHeader) => {
    if (!expectedToken || !authorizationHeader?.startsWith("Bearer ")) {
      return false;
    }
    const suppliedToken = authorizationHeader.slice("Bearer ".length);
    const expected = Buffer.from(expectedToken);
    const supplied = Buffer.from(suppliedToken);
    return (
      expected.length === supplied.length && timingSafeEqual(expected, supplied)
    );
  };
}
