import "./admin.css";

type Person = {
  id: string; name: string; unlockedThrough: number; createdAt: string;
  lastSeenAt: string; completedAt: string | null;
  completions: Array<{ puzzleId: number; completedAt: string }>;
};
type Puzzle = { id: number; title: string; passcodeConfigured: boolean };

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error("Missing element: " + id);
  return node as T;
}
async function api<T>(action: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch("/api/index?action=" + action, { ...options, headers, credentials: "same-origin" });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
function note(node: HTMLElement, message: string, good = false): void {
  node.textContent = message;
  node.classList.toggle("success", good);
}
function date(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

const loginPanel = el<HTMLElement>("loginPanel");
const dashboard = el<HTMLElement>("dashboard");
const loginForm = el<HTMLFormElement>("loginForm");
const password = el<HTMLInputElement>("adminPassword");
const loginButton = el<HTMLButtonElement>("loginButton");
const loginFeedback = el<HTMLElement>("loginFeedback");
const settings = el<HTMLDivElement>("puzzleSettings");
const puzzleFeedback = el<HTMLElement>("puzzleFeedback");
const peopleBody = el<HTMLTableSectionElement>("participantsBody");
const dashboardFeedback = el<HTMLElement>("dashboardFeedback");
const search = el<HTMLInputElement>("searchInput");
let people: Person[] = [];

function drawPeople(): void {
  const filtered = people.filter((p) => p.name.toLowerCase().includes(search.value.trim().toLowerCase()));
  peopleBody.replaceChildren();
  if (!filtered.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = people.length ? "No matching participants." : "No participants have started yet.";
    row.append(cell); peopleBody.append(row); return;
  }
  for (const p of filtered) {
    const row = document.createElement("tr");
    const values = [
      p.name,
      p.completions.length === 3 ? "Complete" : p.completions.length + "/3 complete",
      p.completions.length ? p.completions.map((c) => "P" + c.puzzleId + ": " + date(c.completedAt)).join(" · ") : "Not completed yet",
      date(p.createdAt),
      date(p.lastSeenAt),
    ];
    values.forEach((value, index) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      if (index === 0) cell.className = "person-name";
      if (index === 1 && p.completions.length === 3) cell.className = "complete";
      row.append(cell);
    });
    peopleBody.append(row);
  }
}
function drawPuzzles(puzzles: Puzzle[]): void {
  settings.replaceChildren();
  for (const p of puzzles) {
    const form = document.createElement("form");
    form.className = "puzzle-setting";
    const title = document.createElement("strong");
    title.textContent = "Puzzle " + p.id + ": " + p.title;
    const status = document.createElement("small");
    status.textContent = p.passcodeConfigured ? "Passcode set" : "Needs a passcode";
    status.className = p.passcodeConfigured ? "configured" : "missing";
    const input = document.createElement("input");
    input.type = "password"; input.name = "passcode"; input.maxLength = 32;
    input.required = true; input.autocomplete = "new-password";
    input.placeholder = p.passcodeConfigured ? "Enter new code to replace" : "Set passcode";
    const button = document.createElement("button");
    button.type = "submit"; button.className = "primary"; button.textContent = "Save code";
    form.append(title, status, input, button);
    form.addEventListener("submit", async (event) => {
      event.preventDefault(); button.disabled = true;
      try {
        await api("admin-puzzles", { method: "POST", body: JSON.stringify({ id: p.id, passcode: input.value.trim() }) });
        input.value = ""; note(puzzleFeedback, "Puzzle " + p.id + " passcode saved.", true);
        await load();
      } catch (error) {
        note(puzzleFeedback, error instanceof Error ? error.message : "Could not save code.");
      } finally { button.disabled = false; }
    });
    settings.append(form);
  }
}
async function load(): Promise<void> {
  note(dashboardFeedback, "Refreshing…");
  const [data, puzzleData] = await Promise.all([
    api<{ participants: Person[] }>("admin-participants"),
    api<{ puzzles: Puzzle[] }>("admin-puzzles"),
  ]);
  people = data.participants;
  const finished = people.filter((p) => p.completedAt || p.completions.length === 3).length;
  el("totalParticipants").textContent = String(people.length);
  el("completedParticipants").textContent = String(finished);
  el("activeParticipants").textContent = String(people.length - finished);
  drawPuzzles(puzzleData.puzzles); drawPeople();
  note(dashboardFeedback, "Updated " + new Date().toLocaleTimeString(), true);
}
async function show(): Promise<void> {
  try { await load(); loginPanel.hidden = true; dashboard.hidden = false; }
  catch (error) {
    const message = error instanceof Error ? error.message : "Could not load dashboard.";
    if (message.includes("Admin sign-in required")) { loginPanel.hidden = false; dashboard.hidden = true; }
    else note(loginFeedback, message);
  }
}
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault(); loginButton.disabled = true; note(loginFeedback, "Signing in…");
  try {
    await api("admin-login", { method: "POST", body: JSON.stringify({ password: password.value }) });
    password.value = ""; await show();
  } catch (error) { note(loginFeedback, error instanceof Error ? error.message : "Sign-in failed."); }
  finally { loginButton.disabled = false; }
});
el<HTMLButtonElement>("refreshButton").addEventListener("click", () => {
  void load().catch((error) => note(dashboardFeedback, error instanceof Error ? error.message : "Refresh failed."));
});
el<HTMLButtonElement>("logoutButton").addEventListener("click", async () => {
  await api("admin-logout", { method: "POST", body: "{}" });
  dashboard.hidden = true; loginPanel.hidden = false; note(loginFeedback, "Signed out.", true);
});
search.addEventListener("input", drawPeople);
void show();
