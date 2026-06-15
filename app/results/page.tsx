'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Message, useViva } from '@/lib/viva-context';

// ─── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ label, score, max = 10, color = 'bg-primary' }: {
  label: string;
  score: number;
  max?: number;
  color?: string;
}) {
  const pct = Math.round((score / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className="font-semibold text-foreground">{score.toFixed(1)}/{max}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ emoji, value, label }: { emoji: string; value: string | number; label: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 text-center">
      <div className="text-2xl mb-1">{emoji}</div>
      <p className="text-xl font-bold text-primary">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

// ─── Export helpers ────────────────────────────────────────────────────────────

function buildTranscriptText(
  session: { subject: string; difficulty: string; messages: Message[] },
  report: ReturnType<ReturnType<typeof useViva>['getSessionReport']>
): string {
  const lines: string[] = [];
  const now = new Date().toLocaleString();

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                     AI VIVA TRAINER — SESSION REPORT');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`Subject       : ${session.subject}`);
  lines.push(`Difficulty    : ${session.difficulty}`);
  lines.push(`Generated at  : ${now}`);
  lines.push(`Session time  : ${Math.round(report.sessionDurationMs / 60000)} min`);
  lines.push('');
  lines.push('─── SCORES ─────────────────────────────────────────────────────');
  lines.push(`Overall Score         : ${report.overallScore}/10`);
  lines.push(`Correctness           : ${report.correctnessPercent}%`);
  lines.push(`Confidence            : ${report.confidencePercent}%`);
  lines.push(`Communication         : ${report.communicationScore}/10`);
  lines.push(`Concept Understanding : ${report.conceptScore}/10`);
  lines.push('');
  lines.push('─── PREDICTION ─────────────────────────────────────────────────');
  lines.push(report.predictedPerformance);
  lines.push('');

  if (report.strengths.length) {
    lines.push('─── STRENGTHS ──────────────────────────────────────────────────');
    report.strengths.forEach(s => lines.push(`  ✓ ${s}`));
    lines.push('');
  }
  if (report.weakAreas.length) {
    lines.push('─── WEAK AREAS ─────────────────────────────────────────────────');
    report.weakAreas.forEach(w => lines.push(`  • ${w}`));
    lines.push('');
  }
  if (report.missedConcepts.length) {
    lines.push('─── MISSED CONCEPTS ────────────────────────────────────────────');
    report.missedConcepts.forEach(c => lines.push(`  – ${c}`));
    lines.push('');
  }
  if (report.suggestions.length) {
    lines.push('─── IMPROVEMENT SUGGESTIONS ────────────────────────────────────');
    report.suggestions.forEach(s => lines.push(`  → ${s}`));
    lines.push('');
  }

  lines.push('─── ANSWER ANALYTICS ───────────────────────────────────────────');
  lines.push(`Total Answers  : ${report.totalAnswers}`);
  lines.push(`Voice Answers  : ${report.voiceAnswers}`);
  lines.push(`Text Answers   : ${report.textAnswers}`);
  if (report.averageWPM > 0) lines.push(`Average WPM    : ${report.averageWPM}`);
  if (report.averageResponseDelayMs > 0)
    lines.push(`Avg Response Delay : ${(report.averageResponseDelayMs / 1000).toFixed(1)}s`);
  lines.push('');

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                           FULL TRANSCRIPT');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  session.messages.forEach((msg, idx) => {
    const role = msg.role === 'assistant' ? '🤖 EXAMINER' : '👤 STUDENT';
    const time = new Date(msg.timestamp).toLocaleTimeString();
    lines.push(`[${idx + 1}] ${role}  (${time})`);
    if (msg.inputMode) lines.push(`    Mode: ${msg.inputMode.toUpperCase()}`);
    lines.push(msg.content);

    if (msg.audioMetrics) {
      const m = msg.audioMetrics;
      lines.push(
        `    [Voice metrics: ${m.durationSeconds.toFixed(1)}s, ${m.wordCount} words, ${m.wpm} WPM, ${m.fillerWordCount} fillers, delay ${(m.responseDelayMs / 1000).toFixed(1)}s]`
      );
    }

    if (msg.evaluation) {
      const ev = msg.evaluation;
      lines.push('    ─ Evaluation:');
      lines.push(`      Correctness: ${ev.correctness}/10 — ${ev.reasoning?.correctnessReason ?? ''}`);
      lines.push(`      Concept:     ${ev.conceptUnderstanding}/10 — ${ev.reasoning?.conceptReason ?? ''}`);
      lines.push(`      Clarity:     ${ev.communicationClarity}/10 — ${ev.reasoning?.communicationReason ?? ''}`);
      lines.push(`      Confidence:  ${ev.confidenceScore}/10 — ${ev.reasoning?.confidenceReason ?? ''}`);
      if (ev.missingConcepts?.length)
        lines.push(`      Missing: ${ev.missingConcepts.join(', ')}`);
      if (ev.improvementSuggestions?.length)
        lines.push(`      Suggestions: ${ev.improvementSuggestions.join(' | ')}`);
    }
    lines.push('');
  });

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                  END OF REPORT — AI Viva Trainer');
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJSON(content: object, filename: string) {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const router = useRouter();
  const { session, getSessionReport, resetSession } = useViva();

  const handleRestart = () => {
    resetSession();
    router.push('/');
  };

  const report = session ? getSessionReport() : null;

  const handleExportText = useCallback(() => {
    if (!session || !report) return;
    const slug = session.subject.replace(/\s+/g, '_').toLowerCase();
    const date = new Date().toISOString().split('T')[0];
    const content = buildTranscriptText(session, report);
    downloadText(content, `viva_report_${slug}_${date}.txt`);
  }, [session, report]);

  const handleExportJSON = useCallback(() => {
    if (!session || !report) return;
    const slug = session.subject.replace(/\s+/g, '_').toLowerCase();
    const date = new Date().toISOString().split('T')[0];
    const payload = {
      meta: {
        subject: session.subject,
        difficulty: session.difficulty,
        generatedAt: new Date().toISOString(),
        sessionDurationMs: report.sessionDurationMs,
      },
      report,
      transcript: session.messages.map(m => ({
        role: m.role,
        content: m.content,
        inputMode: m.inputMode,
        timestamp: m.timestamp,
        audioTranscript: m.audioTranscript,
        audioMetrics: m.audioMetrics,
        evaluation: m.evaluation,
      })),
    };
    downloadJSON(payload, `viva_report_${slug}_${date}.json`);
  }, [session, report]);

  if (!session || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Button onClick={() => router.push('/')}>Back to Home</Button>
      </div>
    );
  }

  const performanceColor =
    report.overallScore >= 7
      ? 'from-green-500/20 to-primary/20 border-green-500/30'
      : report.overallScore >= 5
      ? 'from-amber-500/20 to-primary/20 border-amber-500/30'
      : 'from-destructive/20 to-primary/20 border-destructive/30';

  const sessionMins = Math.round(report.sessionDurationMs / 60000);

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Viva Report</h1>
            <p className="text-muted-foreground mt-1">
              {session.subject} · {session.difficulty} · {sessionMins} min
            </p>
          </div>
          {/* Export buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleExportText}>
              📄 Export TXT
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportJSON}>
              📦 Export JSON
            </Button>
          </div>
        </div>

        {/* Overall score hero */}
        <div
          className={`bg-gradient-to-br ${performanceColor} border rounded-2xl p-8 text-center`}
        >
          <p className="text-muted-foreground mb-1 text-sm">Overall Score</p>
          <div className="text-7xl font-bold text-primary mb-2">{report.overallScore}</div>
          <p className="text-muted-foreground text-sm">out of 10</p>
          <div className="mt-4 inline-block bg-card/60 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-medium text-foreground border border-border">
            {report.predictedPerformance}
          </div>
        </div>

        {/* Score breakdown */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            📊 Score Breakdown
          </h2>
          <ScoreBar label="Correctness" score={report.overallScore} color="bg-primary" />
          <ScoreBar label="Confidence" score={report.confidencePercent / 10} color="bg-amber-500" />
          <ScoreBar label="Communication Clarity" score={report.communicationScore} color="bg-green-500" />
          <ScoreBar label="Concept Understanding" score={report.conceptScore} color="bg-purple-500" />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard emoji="💬" value={report.totalAnswers} label="Total Answers" />
          <StatCard emoji="🎤" value={report.voiceAnswers} label="Voice Answers" />
          <StatCard emoji="⌨️" value={report.textAnswers} label="Text Answers" />
          <StatCard
            emoji="⚡"
            value={report.averageWPM > 0 ? `${report.averageWPM}` : '—'}
            label="Avg WPM"
          />
        </div>
        {report.averageResponseDelayMs > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground flex items-center gap-2">
            <span>⏱</span>
            <span>
              Average response delay:{' '}
              <span className="text-foreground font-medium">
                {(report.averageResponseDelayMs / 1000).toFixed(1)}s
              </span>{' '}
              — time between AI question and your first word
            </span>
          </div>
        )}

        {/* Strengths & Weak areas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <span>💪</span> Strengths
            </h2>
            {report.strengths.length > 0 ? (
              <ul className="space-y-2">
                {report.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-foreground flex gap-2">
                    <span className="text-green-500 font-bold shrink-0">✓</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">No strong areas identified</p>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <span>📍</span> Areas to Improve
            </h2>
            {report.weakAreas.length > 0 ? (
              <ul className="space-y-2">
                {report.weakAreas.map((w, i) => (
                  <li key={i} className="text-sm text-foreground flex gap-2">
                    <span className="text-destructive font-bold shrink-0">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">Great work! No weak areas found</p>
            )}
          </div>
        </div>

        {/* Missed concepts */}
        {report.missedConcepts.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <span>🧩</span> Frequently Missed Concepts
            </h2>
            <div className="flex flex-wrap gap-2">
              {report.missedConcepts.map((c, i) => (
                <span
                  key={i}
                  className="bg-destructive/15 text-destructive px-3 py-1 rounded-full text-sm border border-destructive/20"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {report.suggestions.length > 0 && (
          <div className="bg-secondary/20 border border-secondary/40 rounded-xl p-6">
            <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <span>💡</span> Improvement Suggestions
            </h2>
            <ul className="space-y-2">
              {report.suggestions.map((s, i) => (
                <li key={i} className="text-sm text-foreground flex gap-2">
                  <span className="text-primary font-semibold shrink-0">→</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Per-answer transcript */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <span>📝</span> Full Transcript with Evaluations
          </h2>
          <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
            {session.messages.map((msg, idx) => (
              <div key={msg.id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      msg.role === 'assistant'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {msg.role === 'assistant' ? '🤖 Examiner' : '👤 You'}
                  </span>
                  {msg.inputMode && (
                    <span className="text-xs text-muted-foreground">
                      {msg.inputMode === 'voice' ? '🎤' : '⌨️'}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">#{idx + 1}</span>
                </div>

                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed pl-1">
                  {msg.content}
                </p>

                {/* Audio metrics */}
                {msg.audioMetrics && (
                  <div className="pl-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>⏱ {msg.audioMetrics.durationSeconds.toFixed(1)}s</span>
                    <span>🗣 {msg.audioMetrics.wpm} WPM</span>
                    <span>📝 {msg.audioMetrics.wordCount} words</span>
                    {msg.audioMetrics.fillerWordCount > 0 && (
                      <span className="text-amber-400">
                        💬 {msg.audioMetrics.fillerWordCount} fillers
                      </span>
                    )}
                    <span>⏳ {(msg.audioMetrics.responseDelayMs / 1000).toFixed(1)}s delay</span>
                  </div>
                )}

                {/* Audio playback */}
                {msg.audioUrl && (
                  <audio
                    controls
                    src={msg.audioUrl}
                    className="w-full h-8 rounded-lg mt-1"
                    style={{ colorScheme: 'dark' }}
                  />
                )}

                {/* Per-answer evaluation */}
                {msg.evaluation && (
                  <div className="ml-1 mt-2 rounded-lg bg-secondary/20 border border-secondary/30 p-3 space-y-2 text-xs">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { label: 'Correctness', val: msg.evaluation.correctness, reason: msg.evaluation.reasoning?.correctnessReason, color: 'text-primary' },
                        { label: 'Concept', val: msg.evaluation.conceptUnderstanding, reason: msg.evaluation.reasoning?.conceptReason, color: 'text-purple-400' },
                        { label: 'Clarity', val: msg.evaluation.communicationClarity, reason: msg.evaluation.reasoning?.communicationReason, color: 'text-green-400' },
                        { label: 'Confidence', val: msg.evaluation.confidenceScore, reason: msg.evaluation.reasoning?.confidenceReason, color: 'text-amber-400' },
                      ].map(item => (
                        <div key={item.label} className="space-y-0.5">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className={`font-bold ${item.color}`}>{item.val}/10</span>
                          </div>
                          {item.reason && (
                            <p className="text-muted-foreground/70 leading-tight">{item.reason}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    {msg.evaluation.missingConcepts?.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {msg.evaluation.missingConcepts.map((c, i) => (
                          <span key={i} className="bg-destructive/15 text-destructive px-2 py-0.5 rounded-full">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                    {msg.evaluation.improvementSuggestions?.length > 0 && (
                      <ul className="space-y-0.5 pt-1">
                        {msg.evaluation.improvementSuggestions.map((s, i) => (
                          <li key={i} className="text-muted-foreground">
                            <span className="text-primary">→</span> {s}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-col sm:flex-row pb-8">
          <Button onClick={handleRestart} size="lg" className="flex-1">
            Start Another Viva
          </Button>
          <Button variant="outline" onClick={handleExportText} size="lg" className="flex-1">
            📄 Download Report
          </Button>
          <Button variant="outline" onClick={() => router.push('/')} size="lg" className="flex-1">
            Back to Home
          </Button>
        </div>
      </div>
    </main>
  );
}
