import "./style.css";

type Puzzle = {
  title: string;
  html: string;
};

// These are the temporary passcodes in the supplied HTML.
// Replace each "00" with the real code printed on its campus chit.
const PASSCODES: readonly string[] = ["00", "00", "00"];

const puzzles: readonly Puzzle[] = [
  {
    title: "Find The Nummber",
    html: `
      <p>Out of the right corner of my <strong>EYE</strong>, i saw a number not too <strong>HIGH</strong></p>
      <p>When through my checque, i bought a single <strong>CHOCOPIE</strong>, there i saw it, painted in red, i won't <strong>LIE</strong></p>
    `,
  },
  {
    title: "Enter What You Found Upon Searching Through The Something Described Below",
    html: `
      <p>When it's the first school of the <strong>DAY</strong>, something right outside the world of wisdom points to something, they <strong>SAY</strong>; All i can say is let your <strong>WAY</strong> be guided by the <strong>SUNRAY</strong>.</p>
    `,
  },
  {
    title: "Enter What You Found Upon Searching Through The Something Described Below",
    html: `
      <p>After 22 years of <strong>GLOOM</strong>, its about to go <strong>BOOM</strong>, But the two similar things that used to be the cause of <strong>DOOM</strong>, now lay still near some bright stairs, after all the danger they once used to <strong>LOOM</strong>.</p>
    `,
  },
];

const STORAGE_KEY = "sanawar-treasure-hunt-progress";

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Required page element #${id} was not found.`);
  }

  return element as T;
}

const navButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-nav]"),
);
const codeForm = getElement<HTMLFormElement>("codeForm");
const codeInput = getElement<HTMLInputElement>("codeInput");
const feedback = getElement<HTMLParagraphElement>("feedback");
const puzzleSection = getElement<HTMLElement>("puzzleSection");
const completion = getElement<HTMLElement>("completion");
const puzzleNumber = getElement<HTMLParagraphElement>("puzzleNumber");
const puzzleTitle = getElement<HTMLHeadingElement>("puzzleTitle");
const riddleCopy = getElement<HTMLDivElement>("riddleCopy");
const submitButton = getElement<HTMLButtonElement>("submitButton");
const restartButton = getElement<HTMLButtonElement>("restartButton");

function readProgress(): number {
  try {
    const saved = Number(window.localStorage.getItem(STORAGE_KEY));

    if (Number.isInteger(saved) && saved >= 0 && saved < puzzles.length) {
      return saved;
    }
  } catch {
    // The game still works if browser storage is unavailable.
  }

  return 0;
}

let currentPuzzle = 0;
let unlockedThrough = readProgress();

function saveProgress(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(unlockedThrough));
  } catch {
    // Progress will remain available until the page is refreshed.
  }
}

function updateNavigation(): void {
  navButtons.forEach((button, index) => {
    const available = index <= unlockedThrough;
    const completed = index < unlockedThrough;

    button.disabled = !available;
    button.classList.toggle("available", available);
    button.classList.toggle("active", index === currentPuzzle);
    button.classList.toggle("completed", completed);
    button.textContent = `Puzzle ${index + 1}${completed ? " · Complete" : available ? "" : " · Locked"}`;

    if (index === currentPuzzle) {
      button.setAttribute("aria-current", "step");
    } else {
      button.removeAttribute("aria-current");
    }
  });
}

function showFeedback(message: string, isSuccess = false): void {
  feedback.textContent = message;
  feedback.classList.toggle("success", isSuccess);
}

function renderPuzzle(index: number): void {
  if (index < 0 || index >= puzzles.length || index > unlockedThrough) {
    return;
  }

  currentPuzzle = index;
  const puzzle = puzzles[index];

  puzzleNumber.textContent = `Puzzle ${index + 1} of ${puzzles.length}`;
  puzzleTitle.textContent = puzzle.title;
  riddleCopy.innerHTML = puzzle.html;
  codeInput.value = "";
  showFeedback("");
  submitButton.disabled = false;
  updateNavigation();
}

function showCompletion(): void {
  puzzleSection.hidden = true;
  completion.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const index = Number(button.dataset.nav);

    if (Number.isInteger(index) && index <= unlockedThrough) {
      renderPuzzle(index);
    }
  });
});

codeForm.addEventListener("submit", (event: SubmitEvent) => {
  event.preventDefault();

  const entered = codeInput.value.trim();

  if (!entered) {
    showFeedback("Please enter the passcode from the chit.");
    codeInput.focus();
    return;
  }

  if (entered.toUpperCase() !== PASSCODES[currentPuzzle].toUpperCase()) {
    showFeedback("Incorrect passcode. Please check the chit and try again.");
    codeInput.select();
    return;
  }

  if (currentPuzzle < puzzles.length - 1) {
    unlockedThrough = Math.max(unlockedThrough, currentPuzzle + 1);
    saveProgress();
    showFeedback("Correct passcode. The next puzzle is now unlocked.", true);
    updateNavigation();

    const nextPuzzle = currentPuzzle + 1;
    window.setTimeout(() => {
      renderPuzzle(nextPuzzle);
    }, 350);
    return;
  }

  showCompletion();
});

restartButton.addEventListener("click", () => {
  // "Review puzzles" returns to the first puzzle without relocking progress.
  completion.hidden = true;
  puzzleSection.hidden = false;
  renderPuzzle(0);
  window.scrollTo({ top: 0, behavior: "smooth" });
});

renderPuzzle(Math.min(unlockedThrough, puzzles.length - 1));
