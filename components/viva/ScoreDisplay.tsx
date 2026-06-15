interface ReasoningBlock {
  correctnessReason?: string;
  conceptReason?: string;
  communicationReason?: string;
  confidenceReason?: string;
}

interface ScoreDisplayProps {
  correctness: number;
  conceptUnderstanding?: number;
  communicationClarity?: number;
  confidenceScore?: number;
  clarity: string;
  missingConcepts: string[];
  reasoning?: ReasoningBlock;
}

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full`}
        style={{ width: `${(value / 10) * 100}%` }}
      />
    </div>
  );
}

export function ScoreDisplay({
  correctness,
  conceptUnderstanding,
  communicationClarity,
  confidenceScore,
  clarity,
  missingConcepts,
  reasoning,
}: ScoreDisplayProps) {
  const scores = [
    { label: 'Correctness', value: correctness, color: 'bg-primary', reason: reasoning?.correctnessReason },
    ...(conceptUnderstanding != null
      ? [{ label: 'Concept', value: conceptUnderstanding, color: 'bg-purple-500', reason: reasoning?.conceptReason }]
      : []),
    ...(communicationClarity != null
      ? [{ label: 'Clarity', value: communicationClarity, color: 'bg-green-500', reason: reasoning?.communicationReason }]
      : []),
    ...(confidenceScore != null
      ? [{ label: 'Confidence', value: confidenceScore, color: 'bg-amber-500', reason: reasoning?.confidenceReason }]
      : []),
  ];

  return (
    <div className="bg-secondary/20 border border-secondary/40 rounded-lg p-4 my-2 text-xs w-56 space-y-3">
      <p className="font-semibold text-foreground text-sm">Evaluation</p>

      {/* Score rows */}
      <div className="space-y-2">
        {scores.map(s => (
          <div key={s.label} className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{s.label}</span>
              <span className={`font-bold text-sm`} style={{ color: undefined }}>
                <span className="text-foreground">{s.value}</span>
                <span className="text-muted-foreground">/10</span>
              </span>
            </div>
            <MiniBar value={s.value} color={s.color} />
            {s.reason && (
              <p className="text-muted-foreground/70 text-[10px] leading-tight">{s.reason}</p>
            )}
          </div>
        ))}
      </div>

      {/* Overall feedback */}
      {clarity && (
        <div className="border-t border-secondary/40 pt-2">
          <p className="text-muted-foreground mb-0.5 font-medium">Feedback</p>
          <p className="text-foreground leading-snug">{clarity}</p>
        </div>
      )}

      {/* Missing concepts */}
      {missingConcepts?.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-1 font-medium">Gaps</p>
          <div className="flex flex-wrap gap-1">
            {missingConcepts.map((c, i) => (
              <span key={i} className="bg-destructive/20 text-destructive px-1.5 py-0.5 rounded text-[10px]">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
