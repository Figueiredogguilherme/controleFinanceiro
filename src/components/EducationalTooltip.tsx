import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { FINANCIAL_GLOSSARY } from '../services/aiAssistant';

interface EducationalTooltipProps {
  term: string;
  customExplanation?: string;
  customTitle?: string;
  inlineLabel?: string;
}

export const EducationalTooltip: React.FC<EducationalTooltipProps> = ({
  term,
  customExplanation,
  customTitle,
  inlineLabel,
}) => {
  const [open, setOpen] = useState(false);

  const entry = FINANCIAL_GLOSSARY.find(
    (g) => g.term.toLowerCase() === term.toLowerCase() || g.term.toLowerCase().includes(term.toLowerCase()),
  );

  const title = customTitle ?? entry?.shortTitle ?? term;
  const explanation =
    customExplanation ??
    entry?.simpleExplanation ??
    'Indicador financeiro utilizado na análise de rentabilidade, risco ou tributação.';

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
        title={`Entender ${term}`}
      >
        <HelpCircle className="h-3.5 w-3.5" />
        <span>{inlineLabel ?? term}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:absolute sm:inset-auto sm:left-0 sm:top-7 sm:block sm:w-80 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <div className="w-full max-w-sm rounded-2xl border border-emerald-500/40 bg-slate-900 p-4 text-left shadow-2xl shadow-black/70">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                  Explicação Didática
                </span>
                <h4 className="text-sm font-bold text-white">
                  {term} — {title}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Fechar explicação"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">{explanation}</p>
            {entry?.practicalExample && !customExplanation && (
              <div className="mt-2.5 rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 text-xs text-slate-300">
                <span className="font-semibold text-amber-300">Na prática: </span>
                {entry.practicalExample}
              </div>
            )}
          </div>
        </div>
      )}
    </span>
  );
};
