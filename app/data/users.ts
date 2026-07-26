import { randomUUID } from "node:crypto";
import { openKv, readLocal, writeLocal } from "./kv.ts";
import { createDefaultPortfolio, normalizePortfolio, type Portfolio } from "./portfolio.ts";

export type Passkey = {
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  label: string;
  createdAt: string;
};
export type User = { id: string; createdAt: string; passkeys: Passkey[]; portfolio: Portfolio };
export async function getUser(id: string): Promise<User | null> {
  const kv = await openKv();
  if (kv) {
    const user = (await kv.get<User>(["user", id])).value;
    return user ? { ...user, portfolio: normalizePortfolio(user.portfolio) } : null;
  }
  const user = ((await readLocal()).users[id] as User | undefined) ?? null;
  return user ? { ...user, portfolio: normalizePortfolio(user.portfolio) } : null;
}
export async function saveUser(user: User) {
  const kv = await openKv();
  if (kv) {
    await kv.set(["user", user.id], user);
    return;
  }
  const store = await readLocal();
  store.users[user.id] = user;
  await writeLocal(store);
}
export async function findUserId(credentialId: string): Promise<string | null> {
  const kv = await openKv();
  if (kv) return (await kv.get<string>(["cred", credentialId])).value;
  const store = await readLocal();
  return (
    (
      store.users &&
      (Object.values(store.users).find((u) =>
        (u as User).passkeys?.some((p) => p.credentialId === credentialId),
      ) as User | undefined)
    )?.id ?? null
  );
}
export async function createUser(passkey: Passkey, id?: string) {
  const user: User = {
    id: id ?? randomUUID(),
    createdAt: new Date().toISOString(),
    passkeys: [passkey],
    portfolio: createDefaultPortfolio(),
  };
  await saveUser(user);
  const kv = await openKv();
  if (kv) await kv.set(["cred", passkey.credentialId], user.id);
  return user;
}
export async function updateCounter(user: User, credentialId: string, counter: number) {
  await saveUser({
    ...user,
    passkeys: user.passkeys.map((p) => (p.credentialId === credentialId ? { ...p, counter } : p)),
  });
}

export async function ensureDevUser(): Promise<User> {
  const existing = await getUser("dev-user");
  if (existing) return existing;
  const user: User = {
    id: "dev-user",
    createdAt: new Date().toISOString(),
    passkeys: [],
    portfolio: createDefaultPortfolio(),
  };
  await saveUser(user);
  return user;
}
