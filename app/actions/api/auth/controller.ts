import { createController } from "remix/router";
import { randomUUID } from "node:crypto";
import { routes } from "../../../routes.ts";
import { createUser, findUserId, getUser, updateCounter } from "../../../data/users.ts";
import { setChallenge, takeChallenge } from "../../../middleware/auth-session.ts";
import { json } from "../../../utils/json.ts";
import {
  authenticationOptions,
  findPasskey,
  passkeyFromRegistration,
  registrationOptions,
  resolveWebAuthnRequest,
  verifyAuthentication,
  verifyRegistration,
} from "../../../utils/passkeys.ts";
export default createController(routes.api.auth, {
  actions: {
    async registerOptions({ request, session }) {
      const w = resolveWebAuthnRequest(request);
      if (!w) return json({ error: "Origin not allowed" }, 400);
      const id = randomUUID();
      const options = await registrationOptions(id, w.rpID);
      setChallenge(session, { kind: "register", challenge: options.challenge, userId: id });
      return json(options);
    },
    async registerVerify({ request, session }) {
      const w = resolveWebAuthnRequest(request);
      const pending = takeChallenge(session);
      if (!w || !pending?.userId || pending.kind !== "register")
        return json({ error: "Missing registration challenge" }, 400);
      const body = (await request.json()) as { response?: unknown };
      if (!body.response) return json({ error: "Missing response" }, 400);
      const v = await verifyRegistration({
        response: body.response as never,
        expectedChallenge: pending.challenge,
        expectedOrigin: w.origin,
        expectedRPID: w.rpID,
      });
      const passkey = passkeyFromRegistration(v);
      if (!v.verified || !passkey) return json({ error: "Registration failed" }, 400);
      const user = await createUser(passkey, pending.userId);
      session.regenerateId();
      session.set("userId", user.id);
      return json({ ok: true });
    },
    async loginOptions({ request, session }) {
      const w = resolveWebAuthnRequest(request);
      if (!w) return json({ error: "Origin not allowed" }, 400);
      const options = await authenticationOptions(w.rpID);
      setChallenge(session, { kind: "login", challenge: options.challenge });
      return json(options);
    },
    async loginVerify({ request, session }) {
      const w = resolveWebAuthnRequest(request);
      const pending = takeChallenge(session);
      if (!w || !pending || pending.kind !== "login")
        return json({ error: "Missing login challenge" }, 400);
      const body = (await request.json()) as { response?: { id?: string } };
      const id = body.response?.id;
      if (!id || !body.response) return json({ error: "Missing response" }, 400);
      const uid = await findUserId(id);
      const user = uid ? await getUser(uid) : null;
      const passkey = user ? findPasskey(user, id) : null;
      if (!uid || !user || !passkey) return json({ error: "Unknown passkey" }, 401);
      const v = await verifyAuthentication({
        response: body.response as never,
        expectedChallenge: pending.challenge,
        expectedOrigin: w.origin,
        expectedRPID: w.rpID,
        passkey,
      });
      if (!v.verified) return json({ error: "Authentication failed" }, 401);
      await updateCounter(user, id, v.authenticationInfo.newCounter);
      session.regenerateId();
      session.set("userId", uid);
      return json({ ok: true });
    },
  },
});
