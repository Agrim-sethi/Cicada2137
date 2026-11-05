/* Cicada2137 server API. This file runs only on Vercel's server. */
const env = (globalThis as any).process?.env ?? {};
const participantCookie = "cicada_participant";
const adminCookie = "cicada_admin";

function required(name: string): string {
  const value = env[name];
  if (!value) throw new Error("Missing environment variable: " + name);
  return value;
}
function send(res: any, status: number, data: unknown): void {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(data);
}
function getCookie(req: any, name: string): string | null {
  const header = req.headers.cookie;
  if (typeof header !== "string") return null;
  for (const part of header.split(";")) {
    const bits = part.trim().split("=");
    if (bits.shift() === name) return bits.join("=");
  }
  return null;
}
function encode64(value: string): string {
  return btoa(value).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function decode64(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return atob(padded);
}
async function sign(value: string, secret: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
}
async function hashPasscode(value: string): Promise<string> {
  const bytes = new Uint8Array(await sign(value, required("PASSCODE_PEPPER")));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
async function setSession(res: any, name: string, payload: Record<string, unknown>, maxAge: number): Promise<void> {
  const data = encode64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + maxAge }));
  const signature = encode64(String.fromCharCode(...new Uint8Array(await sign(data, required("SESSION_SECRET")))));
  const secure = env.VERCEL === "1" || env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", name + "=" + data + "." + signature + "; HttpOnly; Path=/; SameSite=Lax; Max-Age=" + maxAge + secure);
}
async function readSession(req: any, name: string, role: string): Promise<any | null> {
  const token = getCookie(req, name);
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(required("SESSION_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const signature = Uint8Array.from(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/") + "===".slice((parts[1].length + 3) % 4)), (c) => c.charCodeAt(0));
    if (!(await crypto.subtle.verify("HMAC", key, signature, new TextEncoder().encode(parts[0])))) return null;
    const data = JSON.parse(decode64(parts[0]));
    if (data.role !== role || data.exp <= Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch { return null; }
}
async function db(path: string, method = "GET", body?: unknown, prefer?: string): Promise<any> {
  const secret = required("SUPABASE_SECRET_KEY");
  const response = await fetch(required("SUPABASE_URL").replace(/\/$/, "") + "/rest/v1/" + path, {
    method,
    headers: {
      apikey: secret,
      Authorization: "Bearer " + secret,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error("Supabase returned " + response.status + ": " + (await response.text()).slice(0, 300));
  if (response.status === 204) return null;
  return response.json();
}
async function getParticipant(req: any): Promise<any | null> {
  const session = await readSession(req, participantCookie, "participant");
  if (!session?.participantId) return null;
  const rows = await db("cicada_participants?select=id,name,unlocked_through,created_at,last_seen_at,completed_at&id=eq." + encodeURIComponent(session.participantId) + "&limit=1");
  return rows[0] ?? null;
}
async function isAdmin(req: any): Promise<boolean> {
  return Boolean(await readSession(req, adminCookie, "admin"));
}

export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  const action = new URL(req.url ?? "/api/index", "https://cicada.invalid").searchParams.get("action") ?? "";
  const method = req.method ?? "GET";
  const body = req.body && typeof req.body === "object" ? req.body : {};

  try {
    if (action === "register" && method === "POST") {
      const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
      if (name.length < 2 || name.length > 50) return send(res, 400, { error: "Please enter a name between 2 and 50 characters." });
      const rows = await db("cicada_participants", "POST", { name }, "return=representation");
      const person = rows[0];
      const age = 60 * 60 * 24 * 60;
      await setSession(res, participantCookie, { role: "participant", participantId: person.id }, age);
      return send(res, 201, { participant: { name: person.name, unlockedThrough: person.unlocked_through } });
    }

    if (action === "progress" && method === "GET") {
      const person = await getParticipant(req);
      if (!person) return send(res, 401, { error: "Please enter your name to begin." });
      const [puzzles, completions] = await Promise.all([
        db("cicada_puzzles?select=id,title,riddle_html&order=id.asc"),
        db("cicada_completions?select=puzzle_id,completed_at&participant_id=eq." + encodeURIComponent(person.id) + "&order=puzzle_id.asc"),
      ]);
      await db("cicada_participants?id=eq." + encodeURIComponent(person.id), "PATCH", { last_seen_at: new Date().toISOString() }, "return=minimal");
      return send(res, 200, {
        participant: { name: person.name, unlockedThrough: person.unlocked_through },
        puzzles: puzzles.filter((p: any) => p.id <= person.unlocked_through),
        completions: completions.map((c: any) => ({ puzzleId: c.puzzle_id, completedAt: c.completed_at })),
        completed: person.unlocked_through === 4,
      });
    }

    if (action === "verify" && method === "POST") {
      const person = await getParticipant(req);
      if (!person) return send(res, 401, { error: "Your session has expired. Please enter your name again." });
      const id = Number(body.puzzleId);
      const code = typeof body.passcode === "string" ? body.passcode.trim() : "";
      if (!Number.isInteger(id) || id < 1 || id > 3 || code.length < 1 || code.length > 32) return send(res, 400, { error: "Enter a valid passcode." });
      if (id !== person.unlocked_through || person.unlocked_through > 3) return send(res, 409, { error: "Complete the currently unlocked puzzle first." });
      const puzzle = (await db("cicada_puzzles?select=passcode_hash&id=eq." + id + "&limit=1"))[0];
      if (!puzzle?.passcode_hash) return send(res, 503, { error: "This puzzle's passcode has not been configured yet. Please ask the organiser." });
      if (!safeEqual(await hashPasscode(code), puzzle.passcode_hash)) return send(res, 200, { correct: false, message: "Incorrect passcode. Please check the chit and try again." });
      await db("cicada_completions?on_conflict=participant_id%2Cpuzzle_id", "POST", { participant_id: person.id, puzzle_id: id }, "resolution=merge-duplicates,return=minimal");
      const next = id + 1;
      const update: Record<string, unknown> = { unlocked_through: next, last_seen_at: new Date().toISOString() };
      if (id === 3) update.completed_at = new Date().toISOString();
      await db("cicada_participants?id=eq." + encodeURIComponent(person.id), "PATCH", update, "return=minimal");
      return send(res, 200, { correct: true, unlockedThrough: next, completed: id === 3, message: id === 3 ? "Correct. You have completed the treasure hunt!" : "Correct passcode. The next puzzle is now unlocked." });
    }

    if (action === "participant-logout" && method === "POST") {
      const secure = env.VERCEL === "1" || env.NODE_ENV === "production" ? "; Secure" : "";
      res.setHeader("Set-Cookie", participantCookie + "=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0" + secure);
      return send(res, 200, { ok: true });
    }

    if (action === "admin-login" && method === "POST") {
      const password = typeof body.password === "string" ? body.password : "";
      if (!safeEqual(password, required("ADMIN_PASSWORD"))) return send(res, 401, { error: "That admin password is not correct." });
      await setSession(res, adminCookie, { role: "admin" }, 60 * 60 * 8);
      return send(res, 200, { ok: true });
    }

    if (action === "admin-logout" && method === "POST") {
      const secure = env.VERCEL === "1" || env.NODE_ENV === "production" ? "; Secure" : "";
      res.setHeader("Set-Cookie", adminCookie + "=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0" + secure);
      return send(res, 200, { ok: true });
    }

    if (action === "admin-participants" && method === "GET") {
      if (!(await isAdmin(req))) return send(res, 401, { error: "Admin sign-in required." });
      const [people, completions] = await Promise.all([
        db("cicada_participants?select=id,name,unlocked_through,created_at,last_seen_at,completed_at&order=created_at.desc"),
        db("cicada_completions?select=participant_id,puzzle_id,completed_at&order=puzzle_id.asc"),
      ]);
      const map = new Map<string, any[]>();
      for (const item of completions) map.set(item.participant_id, [...(map.get(item.participant_id) ?? []), { puzzleId: item.puzzle_id, completedAt: item.completed_at }]);
      return send(res, 200, { participants: people.map((p: any) => ({
        id: p.id, name: p.name, unlockedThrough: p.unlocked_through, createdAt: p.created_at,
        lastSeenAt: p.last_seen_at, completedAt: p.completed_at, completions: map.get(p.id) ?? [],
      })) });
    }

    if (action === "admin-puzzles" && (method === "GET" || method === "POST")) {
      if (!(await isAdmin(req))) return send(res, 401, { error: "Admin sign-in required." });
      if (method === "GET") {
        const puzzles = await db("cicada_puzzles?select=id,title,passcode_hash&order=id.asc");
        return send(res, 200, { puzzles: puzzles.map((p: any) => ({ id: p.id, title: p.title, passcodeConfigured: Boolean(p.passcode_hash) })) });
      }
      const id = Number(body.id);
      const code = typeof body.passcode === "string" ? body.passcode.trim() : "";
      if (!Number.isInteger(id) || id < 1 || id > 3 || code.length < 1 || code.length > 32) return send(res, 400, { error: "Choose a puzzle and enter a passcode of 1 to 32 characters." });
      await db("cicada_puzzles?id=eq." + id, "PATCH", {
        passcode_hash: await hashPasscode(code),
        updated_at: new Date().toISOString(),
      }, "return=minimal");
      return send(res, 200, { ok: true, message: "Puzzle " + id + " passcode saved." });
    }

    return send(res, 404, { error: "Unknown API action." });
  } catch (error) {
    console.error("Cicada2137 API error:", error instanceof Error ? error.message : error);
    return send(res, 500, { error: "The server could not complete that request. Check Vercel environment variables and try again." });
  }
}
