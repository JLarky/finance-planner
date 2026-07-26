import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import type { Passkey, User } from "../data/users.ts";

export function resolveWebAuthnRequest(request: Request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin") || url.origin;
  const parsed = new URL(origin);
  if (
    parsed.hostname !== "localhost" &&
    parsed.hostname !== "127.0.0.1" &&
    !parsed.hostname.endsWith(".deno.net")
  )
    return null;
  return { origin, rpID: parsed.hostname };
}
export async function registrationOptions(userId: string, rpID: string) {
  return generateRegistrationOptions({
    rpName: process.env.WEBAUTHN_RP_NAME ?? "Finance Planner",
    rpID,
    userName: `investor-${userId.slice(0, 8)}`,
    userID: new TextEncoder().encode(userId) as never,
    attestationType: "none",
    supportedAlgorithmIDs: [-8, -7, -257],
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });
}
export async function authenticationOptions(rpID: string) {
  return generateAuthenticationOptions({ rpID, userVerification: "preferred" });
}
export function verifyRegistration(args: {
  response: RegistrationResponseJSON;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRPID: string;
}): Promise<VerifiedRegistrationResponse> {
  return verifyRegistrationResponse(args);
}
export function verifyAuthentication(args: {
  response: AuthenticationResponseJSON;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRPID: string;
  passkey: Passkey;
}): Promise<VerifiedAuthenticationResponse> {
  return verifyAuthenticationResponse({
    response: args.response,
    expectedChallenge: args.expectedChallenge,
    expectedOrigin: args.expectedOrigin,
    expectedRPID: args.expectedRPID,
    credential: {
      id: args.passkey.credentialId,
      publicKey: Buffer.from(args.passkey.publicKey, "base64url"),
      counter: args.passkey.counter,
      transports: args.passkey.transports as AuthenticatorTransportFuture[] | undefined,
    },
  });
}
export function passkeyFromRegistration(v: VerifiedRegistrationResponse): Passkey | null {
  if (!v.registrationInfo) return null;
  const { credential } = v.registrationInfo;
  return {
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: credential.transports,
    label: "Primary device",
    createdAt: new Date().toISOString(),
  };
}
export function findPasskey(user: User, id: string) {
  return user.passkeys.find((p) => p.credentialId === id) ?? null;
}
