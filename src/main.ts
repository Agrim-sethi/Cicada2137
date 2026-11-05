import "./style.css";

type Puzzle = { id: number; title: string; riddle_html: string };
type Progress = {
  participant: { name: string; unlockedThrough: number };
  puzzles: Puzzle[];
  completions: Array<{ puzzleId: number; completedAt: string }>;
  completed: boolean;
};

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error("Missing page element: " + id);
  return node as T;
}
async function api<T>(action: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch("/api/index?action=" + action, { ...options, headers, credentials: "same-origin" });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
const welcome = el<HTMLElement>("welcomePanel");
const game = el<HTMLElement>("gameArea");
const nameForm = el<HTMLFormElement>("nameForm");
const nameInput = el<HTMLInputElement>("nameInput");
const startButton = el<HTMLButtonElement>("startButton");
const welcomeFeedback = el<HTMLElement>("welcomeFeedback");
const participantName = el<HTMLElement>("participantName");
const nav = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-nav]"));
const codeForm = el<HTMLFormElement>("codeForm");
const codeInput = el<HTMLInputElement>("codeInput");
const feedback = el<HTMLElement>("feedback");
const puzzleSection = el<HTMLElement>("puzzleSection");
const completion = el<HTMLElement>("completion");
const puzzleNumber = el<HTMLElement>("puzzleNumber");
const puzzleTitle = el<HTMLHeadingElement>("puzzleTitle");
const riddleCopy = el<HTMLDivElement>("riddleCopy");
const submitButton = el<HTMLButtonElement>("submitButton");
const reviewButton = el<HTMLButtonElement>("restartButton");
let progress: Progress | null = null;
let currentPuzzle = 1;

function say(node: HTMLElement, message: string, success = false): void {
  node.textContent = message;
  node.classList.toggle("success", success);
}
function showWelcome(message = ""): void {
  welcome.hidden = false;
  game.hidden = true;
  say(welcomeFeedback, message);
}
function updateNav(): void {
  if (!progress) return;
  const done = new Set(progress.completions.map((item) => item.puzzleId));
  nav.forEach((button) => {
    const id = Number(button.dataset.nav);
    const available = id <= progress!.participant.unlockedThrough;
    button.disabled = !available;
    button.classList.toggle("available", available);
    button.classList.toggle("active", id === currentPuzzle);
    button.classList.toggle("completed", done.has(id));
    button.textContent = "Puzzle " + id + (done.has(id) ? " · Complete" : available ? "" : " · Locked");
    if (id === currentPuzzle) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
}
function renderPuzzle(id: number): void {
  if (!progress) return;
  const puzzle = progress.puzzles.find((item) => item.id === id);
  if (!puzzle || id > progress.participant.unlockedThrough) return;
  currentPuzzle = id;
  puzzleNumber.textContent = "Puzzle " + id + " of 3";
  puzzleTitle.textContent = puzzle.title;
  riddleCopy.innerHTML = puzzle.riddle_html;
  codeInput.value = "";
  const alreadyCompleted = progress.completions.some((item) => item.puzzleId === id);
  codeForm.hidden = alreadyCompleted;
  say(feedback, alreadyCompleted ? "You have already completed this puzzle." : "", alreadyCompleted);
  submitButton.disabled = false;
  puzzleSection.hidden = false;
  completion.hidden = true;
  updateNav();
}
function renderProgress(data: Progress): void {
  progress = data;
  participantName.textContent = data.participant.name;
  welcome.hidden = true;
  game.hidden = false;
  if (data.completed) {
    puzzleSection.hidden = true;
    completion.hidden = false;
    currentPuzzle = 3;
    updateNav();
    return;
  }
  renderPuzzle(data.participant.unlockedThrough);
}
async function loadProgress(): Promise<void> {
  try {
    renderProgress(await api<Progress>("progress"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load progress.";
    if (message.includes("name to begin") || message.includes("session has expired")) showWelcome();
    else showWelcome(message);
  }
}
nameForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 50) return say(welcomeFeedback, "Please enter a name between 2 and 50 characters.");
  startButton.disabled = true;
  say(welcomeFeedback, "Starting your hunt…");
  try {
    await api("register", { method: "POST", body: JSON.stringify({ name }) });
    await loadProgress();
  } catch (error) {
    say(welcomeFeedback, error instanceof Error ? error.message : "Could not start the hunt.");
  } finally { startButton.disabled = false; }
});
nav.forEach((button) => button.addEventListener("click", () => renderPuzzle(Number(button.dataset.nav))));
codeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const passcode = codeInput.value.trim();
  if (!passcode) return say(feedback, "Enter the passcode written on your chit.");
  submitButton.disabled = true;
  say(feedback, "Checking passcode…");
  try {
    const result = await api<{ correct: boolean; message: string }>("verify", {
      method: "POST", body: JSON.stringify({ puzzleId: currentPuzzle, passcode }),
    });
    if (!result.correct) {
      say(feedback, result.message);
      codeInput.select();
      return;
    }
    say(feedback, result.message, true);
    const updated = await api<Progress>("progress");
    progress = updated;
    updateNav();
    if (updated.completed) window.setTimeout(() => renderProgress(updated), 450);
    else window.setTimeout(() => renderPuzzle(updated.participant.unlockedThrough), 450);
  } catch (error) {
    say(feedback, error instanceof Error ? error.message : "Could not verify that passcode.");
  } finally { submitButton.disabled = false; }
});
reviewButton.addEventListener("click", () => renderPuzzle(1));
void loadProgress();
