import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "./lib/api";

type Mode = "verify" | "research" | "situation" | "decision";
type View = "home" | "history" | "about";
type JsonObject = Record<string, unknown>;

type HistoryItem = {
  id: string;
  mode: Mode;
  input: string;
  createdAt: string;
  preview: string;
};

const MODES: Array<{ id: Mode; label: string; title: string; hint: string; icon: string }> = [
  { id: "verify", label: "Verify", title: "Check a claim", hint: "Get a source-backed assessment, not a guess.", icon: "✓" },
  { id: "research", label: "Research", title: "Research a topic", hint: "Explore evidence, sources, and context.", icon: "⌕" },
  { id: "situation", label: "Situation", title: "Understand a situation", hint: "Turn a complex situation into a clear picture.", icon: "◌" },
  { id: "decision", label: "Decision", title: "Think through a decision", hint: "Compare options with evidence and trade-offs.", icon: "↗" },
];

const PROGRESS_STEPS = [
  "Understanding your question",
  "Searching for evidence",
  "Evaluating sources",
  "Cross-checking information",
  "Preparing your answer",
];

const HISTORY_KEY = "paradox-v2-history";

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readPath(value: unknown, paths: string[]): unknown {
  for (const path of paths) {
    let current: unknown = value;
    for (const part of path.split(".")) {
      if (!isObject(current)) {
        current = undefined;
        break;
      }
      current = current[part];
    }
    if (current !== undefined && current !== null && current !== "") return current;
  }
  return undefined;
}

function percent(value: unknown): string | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.max(0, Math.min(100, normalized)).toFixed(0)}%`;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getVerdict(result: unknown) {
  return (
    asText(readPath(result, [
      "finalAssessment.classification",
      "finalAssessment.verdict",
      "classification",
      "verdict",
      "finalVerdict",
    ])) ?? "Assessment complete"
  );
}

function getConfidence(result: unknown) {
  return percent(
    readPath(result, [
      "finalAssessment.confidence",
      "finalAssessment.finalSystemConfidence",
      "confidence.finalSystemConfidence",
      "confidenceRecord.finalSystemConfidence",
      "finalSystemConfidence",
    ]),
  );
}

function getExplanation(result: unknown) {
  const explanation = readPath(result, ["explanation", "finalAssessment.explanation"]);
  return isObject(explanation) ? explanation : null;
}

function getEvidence(result: unknown): JsonObject[] {
  const candidates = [
    readPath(result, ["evidence"]),
    readPath(result, ["finalAssessment.evidence"]),
    readPath(result, ["results.evidence"]),
  ];
  const match = candidates.find((candidate) => Array.isArray(candidate));
  return Array.isArray(match) ? match.filter(isObject) : [];
}

function getClaims(result: unknown): JsonObject[] {
  const claims = readPath(result, ["claims", "finalAssessment.claims"]);
  return Array.isArray(claims) ? claims.filter(isObject) : [];
}

function getExecutionId(result: unknown) {
  return asText(readPath(result, ["executionId", "id", "finalAssessment.executionId"]));
}

function getEvidenceText(item: JsonObject) {
  return (
    asText(item.content) ??
    asText(item.extractedText) ??
    asText(item.snippet) ??
    "Evidence details are available in the source record."
  );
}

function getSourceTitle(item: JsonObject) {
  return (
    asText(item.title) ??
    asText(item.sourceTitle) ??
    asText(item.url) ??
    "Evidence source"
  );
}

function getSourceUrl(item: JsonObject) {
  const url = asText(item.url);
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return url;
}

function getRelationship(item: JsonObject) {
  return (
    asText(item.evidenceStatus) ??
    asText(item.relationship) ??
    asText(item.status) ??
    "Evidence"
  );
}

function getSourceType(item: JsonObject) {
  return asText(item.sourceType) ?? asText(item.provenance) ?? "Source";
}

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isObject) as unknown as HistoryItem[] : [];
  } catch {
    return [];
  }
}

function storeHistory(items: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 20)));
}

function AppIcon({ name }: { name: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "search") {
    return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;
  }
  if (name === "history") {
    return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l3 2" /></svg>;
  }
  if (name === "info") {
    return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 10v6" /><path d="M12 7h.01" /></svg>;
  }
  if (name === "sun") {
    return <svg {...common}><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
  }
  if (name === "arrow") {
    return <svg {...common}><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>;
  }
  if (name === "external") {
    return <svg {...common}><path d="M14 5h5v5" /><path d="M10 14 19 5" /><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg>;
  }
  if (name === "menu") {
    return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
  }
  return null;
}

function LogoMark() {
  return (
    <div className="logo-mark" aria-hidden="true">
      <span className="logo-dot logo-dot-a" />
      <span className="logo-dot logo-dot-b" />
      <span className="logo-dot logo-dot-c" />
      <span className="logo-ring" />
    </div>
  );
}

function NavButton({
  active,
  children,
  onClick,
  icon,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
  icon: string;
}) {
  return (
    <button className={`nav-button ${active ? "nav-button-active" : ""}`} onClick={onClick} type="button">
      <AppIcon name={icon} />
      <span>{children}</span>
    </button>
  );
}

function ModeButton({
  mode,
  active,
  onClick,
}: {
  mode: (typeof MODES)[number];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`mode-card ${active ? "mode-card-active" : ""}`} onClick={onClick} type="button">
      <span className="mode-icon">{mode.icon}</span>
      <span className="mode-copy">
        <strong>{mode.label}</strong>
        <small>{mode.hint}</small>
      </span>
    </button>
  );
}

function ProgressPanel({ progress }: { progress: number }) {
  return (
    <section className="result-shell">
      <div className="progress-header">
        <div>
          <span className="eyebrow">PARADOX is working</span>
          <h2>Building an evidence-backed answer</h2>
        </div>
        <div className="progress-number">{Math.round(progress)}%</div>
      </div>
      <div className="progress-bar"><span style={{ width: `${progress}%` }} /></div>
      <div className="progress-list">
        {PROGRESS_STEPS.map((step, index) => {
          const done = progress >= ((index + 1) / PROGRESS_STEPS.length) * 100;
          const current = !done && progress >= (index / PROGRESS_STEPS.length) * 100;
          return (
            <div className={`progress-row ${done ? "done" : ""} ${current ? "current" : ""}`} key={step}>
              <span className="progress-bullet">{done ? "✓" : current ? "•" : ""}</span>
              <span>{step}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function VerdictCard({ result }: { result: unknown }) {
  const verdict = getVerdict(result);
  const confidence = getConfidence(result);
  const evidence = getEvidence(result);
  const claims = getClaims(result);
  const explanation = getExplanation(result);
  const executionId = getExecutionId(result);

  return (
    <section className="result-shell result-stack">
      <div className="result-topline">
        <div>
          <span className="eyebrow">PARADOX result</span>
          <h2>{verdict}</h2>
        </div>
        <span className="result-status">Evidence reviewed</span>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Assessment confidence</span>
          <strong>{confidence ?? "Not available"}</strong>
          <small>Confidence is not the same as truth probability.</small>
        </div>
        <div className="metric-card">
          <span>Evidence</span>
          <strong>{evidence.length || "—"}</strong>
          <small>Evidence objects returned by the engine.</small>
        </div>
        <div className="metric-card">
          <span>Claims</span>
          <strong>{claims.length || "—"}</strong>
          <small>Claims represented in the result.</small>
        </div>
      </div>

      {explanation && (
        <div className="explanation-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Why this result</span>
              <h3>What PARADOX considered</h3>
            </div>
          </div>
          <div className="explanation-grid">
            {Object.entries(explanation)
              .filter(([, value]) => typeof value === "string" && value.trim())
              .slice(0, 6)
              .map(([key, value]) => (
                <div className="explanation-item" key={key}>
                  <span>{key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}</span>
                  <p>{String(value)}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="section-heading evidence-heading">
        <div>
          <span className="eyebrow">Source trail</span>
          <h3>Evidence used</h3>
        </div>
        <span className="subtle-label">{evidence.length} source record{evidence.length === 1 ? "" : "s"}</span>
      </div>

      {evidence.length ? (
        <div className="evidence-list">
          {evidence.slice(0, 8).map((item, index) => {
            const sourceUrl = getSourceUrl(item);
            return (
              <article className="evidence-item" key={String(item.id ?? index)}>
                <div className="evidence-marker">{index + 1}</div>
                <div className="evidence-main">
                  <div className="evidence-meta">
                    <span className="pill">{getRelationship(item)}</span>
                    <span className="subtle-label">{getSourceType(item)}</span>
                  </div>
                  <h4>{getSourceTitle(item)}</h4>
                  <p>{getEvidenceText(item)}</p>
                  {sourceUrl && (
                    <a href={sourceUrl} target="_blank" rel="noreferrer" className="source-link">
                      Open source <AppIcon name="external" />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-evidence">
          <strong>No evidence records were returned in this response.</strong>
          <span>The system may have insufficient or unavailable evidence for this request.</span>
        </div>
      )}

      <div className="result-footnote">
        {executionId ? `Execution: ${executionId}` : "Result returned by PARADOX"} · Review the evidence before relying on the assessment.
      </div>
    </section>
  );
}

export function App() {
  const [mode, setMode] = useState<Mode>("verify");
  const [view, setView] = useState<View>("home");
  const [text, setText] = useState("");
  const [decisionOptionA, setDecisionOptionA] = useState("");
  const [decisionOptionB, setDecisionOptionB] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("paradox-theme") === "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    localStorage.setItem("paradox-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const selectedMode = useMemo(
    () => MODES.find((item) => item.id === mode) ?? MODES[0],
    [mode],
  );

  function selectMode(next: Mode) {
    setMode(next);
    setView("home");
    setResult(null);
    setError("");
    setMobileNavOpen(false);
  }

  function goHome() {
    setView("home");
    setMobileNavOpen(false);
  }

  async function runInvestigation(event?: FormEvent) {
    event?.preventDefault();
    const cleanText = text.trim();

    if (!cleanText) {
      setError("Tell PARADOX what you want to investigate.");
      return;
    }

    if (mode === "decision" && (!decisionOptionA.trim() || !decisionOptionB.trim())) {
      setError("For a decision, add both options you want to compare.");
      return;
    }

    setBusy(true);
    setResult(null);
    setError("");
    setProgress(4);

    let timer: ReturnType<typeof setInterval> | undefined;

    try {
      timer = setInterval(() => {
        setProgress((current) => Math.min(88, current + (current < 30 ? 9 : current < 60 ? 12 : 7)));
      }, 800);

      let response: unknown;

      if (mode === "verify") {
        response = await api("/api/v1/verify", {
          method: "POST",
          body: JSON.stringify({ text: cleanText, modality: "TEXT" }),
        });
      } else if (mode === "research") {
        response = await api("/api/v1/research", {
          method: "POST",
          body: JSON.stringify({ question: cleanText }),
        });
      } else if (mode === "situation") {
        response = await api("/api/v1/situation", {
          method: "POST",
          body: JSON.stringify({ description: cleanText }),
        });
      } else {
        response = await api("/api/v1/decision", {
          method: "POST",
          body: JSON.stringify({
            objective: cleanText,
            options: [decisionOptionA.trim(), decisionOptionB.trim()],
            constraints: [],
          }),
        });
      }

      if (timer) clearInterval(timer);
      setProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 250));
      setResult(response);

      const item: HistoryItem = {
        id: crypto.randomUUID(),
        mode,
        input: cleanText,
        createdAt: new Date().toISOString(),
        preview: getVerdict(response),
      };

      const nextHistory = [item, ...history].slice(0, 20);
      setHistory(nextHistory);
      storeHistory(nextHistory);
    } catch (err) {
      if (timer) clearInterval(timer);
      setError(err instanceof Error ? err.message : "PARADOX could not complete this request.");
      setProgress(0);
    } finally {
      if (timer) clearInterval(timer);
      setBusy(false);
    }
  }

  function restoreHistory(item: HistoryItem) {
    setMode(item.mode);
    setText(item.input);
    setView("home");
    setResult(null);
    setError("");
  }

  function clearHistory() {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <header className="topbar">
        <button className="brand" onClick={goHome} aria-label="Go to PARADOX home" type="button">
          <LogoMark />
          <span>
            <strong>PARADOX</strong>
            <small>Evidence-driven intelligence</small>
          </span>
        </button>

        <nav className="desktop-nav" aria-label="Primary">
          <NavButton active={view === "home"} onClick={goHome} icon="search">Explore</NavButton>
          <NavButton active={view === "history"} onClick={() => setView("history")} icon="history">History</NavButton>
          <NavButton active={view === "about"} onClick={() => setView("about")} icon="info">About</NavButton>
        </nav>

        <div className="top-actions">
          <button
            className="icon-button"
            onClick={() => setDarkMode((value) => !value)}
            aria-label={darkMode ? "Switch to light theme" : "Switch to dark theme"}
            title={darkMode ? "Light mode" : "Dark mode"}
            type="button"
          >
            <AppIcon name="sun" />
          </button>
          <button className="mobile-menu" onClick={() => setMobileNavOpen((value) => !value)} aria-label="Open menu" type="button">
            <AppIcon name="menu" />
          </button>
        </div>
      </header>

      {mobileNavOpen && (
        <div className="mobile-nav">
          <NavButton active={view === "home"} onClick={goHome} icon="search">Explore</NavButton>
          <NavButton active={view === "history"} onClick={() => { setView("history"); setMobileNavOpen(false); }} icon="history">History</NavButton>
          <NavButton active={view === "about"} onClick={() => { setView("about"); setMobileNavOpen(false); }} icon="info">About</NavButton>
        </div>
      )}

      <main className="page">
        {view === "home" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="status-chip"><span className="status-dot" /> Evidence first</div>
                <h1>Know what to trust.<br /><span>Understand what it means.</span></h1>
                <p>
                  PARADOX researches claims, evaluates evidence, explains situations,
                  and helps you reason through decisions — without hiding the uncertainty.
                </p>
              </div>

              <div className="hero-orbit" aria-hidden="true">
                <div className="orbit-core">
                  <LogoMark />
                  <span>research</span>
                  <span>evidence</span>
                  <span>reason</span>
                </div>
              </div>
            </section>

            <section className="workspace">
              <div className="workspace-header">
                <div>
                  <span className="eyebrow">Start with one sentence</span>
                  <h2>What would you like to investigate?</h2>
                </div>
                <span className="workspace-tip">No special format required</span>
              </div>

              <div className="mode-grid">
                {MODES.map((item) => (
                  <ModeButton key={item.id} mode={item} active={mode === item.id} onClick={() => selectMode(item.id)} />
                ))}
              </div>

              <form className="composer" onSubmit={runInvestigation}>
                <div className="composer-label">
                  <span>{selectedMode.title}</span>
                  <span className="composer-count">{text.length}/20000</span>
                </div>
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={
                    mode === "verify"
                      ? "Example: The new policy reduced waiting times by 30%."
                      : mode === "research"
                        ? "Example: What does the evidence say about..."
                        : mode === "situation"
                          ? "Example: Explain what is happening with..."
                          : "Example: I need to choose between two options because..."
                  }
                  rows={5}
                  maxLength={20000}
                  aria-label={selectedMode.title}
                />

                {mode === "decision" && (
                  <div className="decision-fields">
                    <input value={decisionOptionA} onChange={(event) => setDecisionOptionA(event.target.value)} placeholder="Option A" maxLength={500} />
                    <input value={decisionOptionB} onChange={(event) => setDecisionOptionB(event.target.value)} placeholder="Option B" maxLength={500} />
                  </div>
                )}

                <div className="composer-footer">
                  <div className="input-tools">
                    <span className="input-tool">Text</span>
                    <span className="input-tool muted">URL ready</span>
                    <span className="input-tool muted">More inputs soon</span>
                  </div>
                  <button className="primary-button" type="submit" disabled={busy}>
                    <span>{busy ? "Investigating..." : "Investigate"}</span>
                    <AppIcon name="arrow" />
                  </button>
                </div>
              </form>

              {error && (
                <div className="error-banner" role="alert">
                  <strong>Something needs attention.</strong>
                  <span>{error}</span>
                </div>
              )}
            </section>

            <section className="examples">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Try PARADOX</span>
                  <h3>Simple prompts to get started</h3>
                </div>
              </div>

              <div className="example-grid">
                {[
                  "Is this claim supported by reliable evidence?",
                  "Research the strongest evidence about this topic.",
                  "Explain what is happening and what could change next.",
                  "Compare these two options using evidence and trade-offs.",
                ].map((example) => (
                  <button
                    key={example}
                    className="example-card"
                    onClick={() => setText(example)}
                    type="button"
                  >
                    <span>{example}</span>
                    <AppIcon name="arrow" />
                  </button>
                ))}
              </div>
            </section>

            <section className="how-section">
              <div className="how-copy">
                <span className="eyebrow">How PARADOX thinks</span>
                <h2>Complex work underneath.<br />Simple answers on top.</h2>
                <p>
                  Research, evidence retrieval, source evaluation and cross-checking
                  happen behind the scenes. You see the result, the reasoning, and the
                  evidence that supports it.
                </p>
              </div>

              <div className="pipeline">
                {["Question", "Research", "Evidence", "Cross-check", "Answer"].map((label, index) => (
                  <div className="pipeline-node" key={label}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{label}</strong>
                    {index < 4 && <i />}
                  </div>
                ))}
              </div>
            </section>

            {(busy || result) && (
              <section className="analysis-area">
                {busy && <ProgressPanel progress={progress} />}
                {!busy && result && <VerdictCard result={result} />}
              </section>
            )}
          </>
        )}

        {view === "history" && (
          <section className="content-page">
            <div className="content-page-header">
              <div>
                <span className="eyebrow">Your workspace</span>
                <h1>Investigation history</h1>
                <p>Your recent questions are stored locally in this browser.</p>
              </div>
              {history.length > 0 && (
                <button className="secondary-button danger-button" onClick={clearHistory} type="button">Clear history</button>
              )}
            </div>

            {!history.length ? (
              <div className="empty-state">
                <div className="empty-icon"><AppIcon name="history" /></div>
                <h3>No investigations yet</h3>
                <p>Your recent PARADOX questions will appear here.</p>
                <button className="primary-button" onClick={goHome} type="button">
                  Start an investigation <AppIcon name="arrow" />
                </button>
              </div>
            ) : (
              <div className="history-list">
                {history.map((item) => (
                  <button className="history-item" key={item.id} onClick={() => restoreHistory(item)} type="button">
                    <div className="history-icon">{item.mode.slice(0, 1).toUpperCase()}</div>
                    <div className="history-main">
                      <div className="history-meta">
                        <span>{item.mode}</span>
                        <time>{formatDate(item.createdAt)}</time>
                      </div>
                      <strong>{item.input}</strong>
                      <small>{item.preview}</small>
                    </div>
                    <AppIcon name="arrow" />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {view === "about" && (
          <section className="content-page about-page">
            <div className="content-page-header">
              <div>
                <span className="eyebrow">About PARADOX</span>
                <h1>Evidence before certainty.</h1>
                <p>PARADOX is designed to separate what a model says from what the evidence actually supports.</p>
              </div>
            </div>

            <div className="about-grid">
              <article className="about-card"><span className="about-number">01</span><h3>Research</h3><p>Find relevant information instead of treating model memory as proof.</p></article>
              <article className="about-card"><span className="about-number">02</span><h3>Evidence</h3><p>Show the sources, relationships, and uncertainty behind an assessment.</p></article>
              <article className="about-card"><span className="about-number">03</span><h3>Reasoning</h3><p>Cross-check claims and explain conflicts rather than hiding them.</p></article>
              <article className="about-card"><span className="about-number">04</span><h3>Decisions</h3><p>Help users compare trade-offs and possible outcomes without pretending the future is certain.</p></article>
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <span>PARADOX</span>
        <span>Evidence-driven intelligence</span>
        <span>Built for clarity, transparency and exploration.</span>
      </footer>
    </div>
  );
}
