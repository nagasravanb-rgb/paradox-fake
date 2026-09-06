import { NavLink, Route, Routes } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { VerifyPage } from "./pages/Verify";
import { ResearchPage } from "./pages/Research";
import { SituationPage } from "./pages/Situation";
import { DecisionPage } from "./pages/Decision";
import { GraphPage } from "./pages/Graph";
import { TruthShiftPage } from "./pages/TruthShift";
import { TracePage } from "./pages/Trace";
import { EvaluationPage } from "./pages/Evaluation";
import { SettingsPage } from "./pages/Settings";

const nav = [
  ["/", "Dashboard"],
  ["/verify", "Verify"],
  ["/research", "Research"],
  ["/situation", "Situation"],
  ["/decision", "Decision"],
  ["/graph", "Knowledge Graph"],
  ["/truth-shift", "Truth-Shift"],
  ["/trace", "Execution Trace"],
  ["/evaluation", "Evaluation"],
  ["/settings", "Settings"],
] as const;

export function App() {
  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="border-r border-line bg-white p-4">
        <div className="mb-6">
          <div className="text-xs uppercase tracking-[0.2em] text-accent">PARADOX</div>
          <h1 className="text-lg font-semibold leading-tight">Evidence-Driven Intelligent Engine</h1>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Primary">
          {nav.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `px-2 py-1 text-sm border-l-2 ${isActive ? "border-accent font-medium" : "border-transparent text-neutral-700"}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="p-6 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/research" element={<ResearchPage />} />
          <Route path="/situation" element={<SituationPage />} />
          <Route path="/decision" element={<DecisionPage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/truth-shift" element={<TruthShiftPage />} />
          <Route path="/trace" element={<TracePage />} />
          <Route path="/evaluation" element={<EvaluationPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
