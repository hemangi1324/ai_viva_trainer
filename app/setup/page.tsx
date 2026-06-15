'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SessionMode, useViva } from '@/lib/viva-context';

const SUBJECTS = ['DBMS', 'OOP', 'Operating Systems', 'Computer Networks', 'Java', 'Data Structures', 'Algorithms'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;
const TIME_OPTIONS = [5, 10, 15, 20] as const;
const MAIN_Q_OPTIONS = [3, 5, 7, 10] as const;
const FOLLOWUP_OPTIONS = [1, 2, 3, 5] as const;

export default function SetupPage() {
  const router = useRouter();
  const { initSession } = useViva();

  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [modeType, setModeType] = useState<'time' | 'questions'>('questions');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(10);
  const [mainQuestionLimit, setMainQuestionLimit] = useState<number>(5);
  const [maxFollowUps, setMaxFollowUps] = useState<number>(3);

  const canStart = subject && difficulty;

  const handleStart = () => {
    if (!canStart) return;
    const mode: SessionMode =
      modeType === 'time'
        ? { type: 'time', timeLimitMinutes }
        : { type: 'questions', mainQuestionLimit, maxFollowUpsPerQuestion: maxFollowUps };

    initSession(subject, difficulty as 'Easy' | 'Medium' | 'Hard', mode);
    router.push('/viva');
  };

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="space-y-8 max-w-lg w-full">

        {/* Header */}
        <div className="space-y-2 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Configure Your Viva</h1>
          <p className="text-muted-foreground">Select subject, difficulty, and session mode</p>
        </div>

        <div className="space-y-6">

          {/* Subject */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block">Select Subject</label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a subject…" />
              </SelectTrigger>
              <SelectContent>
                {SUBJECTS.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block">Select Difficulty</label>
            <div className="grid grid-cols-3 gap-3">
              {DIFFICULTIES.map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`py-3 px-4 rounded-lg font-medium text-sm transition-all ${
                    difficulty === d
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background'
                      : 'bg-card border border-border text-foreground hover:border-primary'
                  }`}
                >
                  {d === 'Easy' ? '🟢' : d === 'Medium' ? '🟡' : '🔴'} {d}
                </button>
              ))}
            </div>
          </div>

          {/* Session Mode */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground block">Session Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setModeType('questions')}
                className={`p-4 rounded-lg text-left border transition-all ${
                  modeType === 'questions'
                    ? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background'
                    : 'border-border bg-card hover:border-primary/60'
                }`}
              >
                <div className="text-2xl mb-1">🎯</div>
                <p className="font-semibold text-sm text-foreground">Question-Based</p>
                <p className="text-xs text-muted-foreground mt-0.5">Fixed number of questions</p>
              </button>
              <button
                onClick={() => setModeType('time')}
                className={`p-4 rounded-lg text-left border transition-all ${
                  modeType === 'time'
                    ? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background'
                    : 'border-border bg-card hover:border-primary/60'
                }`}
              >
                <div className="text-2xl mb-1">⏱️</div>
                <p className="font-semibold text-sm text-foreground">Time-Based</p>
                <p className="text-xs text-muted-foreground mt-0.5">Fixed duration viva</p>
              </button>
            </div>

            {/* Mode-specific options */}
            {modeType === 'time' && (
              <div className="space-y-2 pt-1">
                <label className="text-xs text-muted-foreground block">Duration</label>
                <div className="flex gap-2 flex-wrap">
                  {TIME_OPTIONS.map(t => (
                    <button
                      key={t}
                      onClick={() => setTimeLimitMinutes(t)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                        timeLimitMinutes === t
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-foreground hover:border-primary'
                      }`}
                    >
                      {t} min
                    </button>
                  ))}
                </div>
              </div>
            )}

            {modeType === 'questions' && (
              <div className="space-y-3 pt-1">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground block">Main Questions</label>
                  <div className="flex gap-2 flex-wrap">
                    {MAIN_Q_OPTIONS.map(n => (
                      <button
                        key={n}
                        onClick={() => setMainQuestionLimit(n)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                          mainQuestionLimit === n
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-border text-foreground hover:border-primary'
                        }`}
                      >
                        {n} Q
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground block">Max Follow-ups per Question</label>
                  <div className="flex gap-2 flex-wrap">
                    {FOLLOWUP_OPTIONS.map(n => (
                      <button
                        key={n}
                        onClick={() => setMaxFollowUps(n)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                          maxFollowUps === n
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-border text-foreground hover:border-primary'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Start */}
          <Button
            onClick={handleStart}
            disabled={!canStart}
            size="lg"
            className="w-full py-6 text-base"
          >
            Start Viva
          </Button>

          <Button variant="outline" onClick={() => router.back()} className="w-full">
            Back
          </Button>
        </div>
      </div>
    </main>
  );
}
