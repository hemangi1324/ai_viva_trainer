'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageList } from './MessageList';
import { VoiceRecorder } from './VoiceRecorder';
import { AudioMetrics, Message, useViva } from '@/lib/viva-context';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChatInterfaceProps {
  onEndInterview: () => void;
}

// ─── Banner Components ────────────────────────────────────────────────────────

function RateLimitBanner({ message }: { message: string }) {
  return (
    <div className="mx-4 my-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 flex gap-3 items-start">
      <span className="text-2xl shrink-0">⏳</span>
      <div>
        <p className="font-semibold text-amber-400 text-sm">API Limit Reached</p>
        <p className="text-amber-300/80 text-sm mt-0.5">{message}</p>
      </div>
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="mx-4 my-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 flex gap-3 items-start">
      <span className="text-xl shrink-0">⚠️</span>
      <div className="flex-1">
        <p className="text-destructive text-sm">{message}</p>
      </div>
      <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground text-xs shrink-0">
        ✕
      </button>
    </div>
  );
}

// ─── TTS Hook ─────────────────────────────────────────────────────────────────

function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string) => {
    if (!ttsEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // stop any ongoing speech
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95;
    utt.pitch = 1;
    utt.volume = 1;
    // Prefer a natural English voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural'))
    ) ?? voices.find(v => v.lang.startsWith('en'));
    if (preferred) utt.voice = preferred;
    utt.onstart = () => setIsSpeaking(true);
    utt.onend = () => setIsSpeaking(false);
    utt.onerror = () => setIsSpeaking(false);
    utteranceRef.current = utt;
    window.speechSynthesis.speak(utt);
  }, [ttsEnabled]);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  return { isSpeaking, ttsEnabled, setTtsEnabled, speak, stop };
}

// ─── Session Limit Logic ──────────────────────────────────────────────────────

function useSessionLimits(onEndInterview: () => void) {
  const { session, incrementMainQuestion, incrementFollowUp, resetFollowUpCount } = useViva();
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialise timer for time-based mode
  useEffect(() => {
    if (!session || session.mode.type !== 'time') return;
    const limitMs = (session.mode.timeLimitMinutes ?? 10) * 60 * 1000;
    const elapsed = Date.now() - session.sessionStartTime;
    const remaining = Math.max(0, Math.floor((limitMs - elapsed) / 1000));
    setTimeLeft(remaining);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          onEndInterview();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  /**
   * Returns true if the session should end after this question–answer exchange.
   * Also updates counters as a side-effect.
   */
  const checkAndAdvance = useCallback(
    (wasFollowUp: boolean): boolean => {
      if (!session) return false;
      const { mode } = session;

      if (mode.type === 'questions') {
        const maxMain = mode.mainQuestionLimit ?? 5;
        const maxFollowUp = mode.maxFollowUpsPerQuestion ?? 3;

        if (wasFollowUp) {
          const nextFollowUp = session.followUpCount + 1;
          if (nextFollowUp >= maxFollowUp) {
            // Move to next main question
            const nextMain = session.mainQuestionCount + 1;
            incrementMainQuestion(); // resets followUpCount
            if (nextMain >= maxMain) return true; // session ends
          } else {
            incrementFollowUp();
          }
        } else {
          const nextMain = session.mainQuestionCount + 1;
          incrementMainQuestion();
          if (nextMain >= maxMain) return true;
        }
      }
      return false;
    },
    [session, incrementMainQuestion, incrementFollowUp]
  );

  // Not used externally but kept for future use
  void resetFollowUpCount;

  return { timeLeft, formatTime, checkAndAdvance };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ChatInterface({ onEndInterview }: ChatInterfaceProps) {
  const {
    session,
    addMessage,
    addScore,
    addConfidenceScore,
    addCommunicationScore,
    addConceptScore,
    setLoading,
    setError,
  } = useViva();

  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const [textInput, setTextInput] = useState('');
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);
  // Timestamp when the latest AI question was rendered (for delay tracking)
  const [lastQuestionAt, setLastQuestionAt] = useState<number>(Date.now());
  // Key to reset VoiceRecorder between answers
  const [recorderKey, setRecorderKey] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const { isSpeaking, ttsEnabled, setTtsEnabled, speak, stop: stopSpeech } = useTTS();
  const { timeLeft, formatTime, checkAndAdvance } = useSessionLimits(onEndInterview);

  // Speak the latest assistant message when it arrives
  useEffect(() => {
    if (!session) return;
    const last = [...session.messages].reverse().find(m => m.role === 'assistant');
    if (last) {
      setLastQuestionAt(last.timestamp);
      if (ttsEnabled) speak(last.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.messages.length]);

  // ─── Core send logic (shared by text + voice) ───────────────────────────────

  const sendAnswer = useCallback(
    async (
      answerText: string,
      mode: 'text' | 'voice',
      audioUrl?: string,
      audioMetrics?: AudioMetrics
    ) => {
      if (!answerText.trim() || !session || rateLimitMsg) return;

      stopSpeech();

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: answerText,
        timestamp: Date.now(),
        inputMode: mode,
        audioUrl,
        audioTranscript: mode === 'voice' ? answerText : undefined,
        audioMetrics,
      };

      addMessage(userMessage);
      setTextInput('');
      setLoading(true);

      // Infer knowledge depth from recent scores for adaptive follow-ups
      const recentScores = session.scores.slice(-3);
      const avgRecent =
        recentScores.length > 0
          ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length
          : 5;
      const knowledgeDepth =
        avgRecent >= 7 ? 'deep' : avgRecent >= 4 ? 'moderate' : 'surface';

      try {
        const response = await fetch('/api/viva', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              ...session.messages.map(m => ({ role: m.role, content: m.content })),
              { role: 'user', content: answerText },
            ],
            subject: session.subject,
            difficulty: session.difficulty,
            isFirstMessage: false,
            inputMode: mode,
            audioStats: audioMetrics,
            isFollowUp: session.followUpCount > 0,
            mainQuestionIndex: session.mainQuestionCount,
            previousScores: session.scores,
            knowledgeDepth,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 429 || data.error === 'rate_limit') {
            setRateLimitMsg(
              data.message ??
                "You've reached the daily API limit. Groq's free tier resets every 24 hours. Please try again tomorrow! 🌙"
            );
            return;
          }
          setError(data.message ?? data.error ?? 'Failed to get a response from the AI.');
          return;
        }

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.question,
          timestamp: Date.now(),
          evaluation: data.evaluation ?? null,
        };

        addMessage(assistantMessage);

        if (data.evaluation) {
          const ev = data.evaluation;
          if (ev.correctness != null) addScore(ev.correctness);
          if (ev.confidenceScore != null) addConfidenceScore(ev.confidenceScore);
          if (ev.communicationClarity != null) addCommunicationScore(ev.communicationClarity);
          if (ev.conceptUnderstanding != null) addConceptScore(ev.conceptUnderstanding);
        }

        // Check if session limits hit
        const shouldEnd = checkAndAdvance(!!data.isFollowUp);
        if (shouldEnd) {
          setTimeout(onEndInterview, 1500); // small delay so last message renders
        }

        // Reset recorder for next answer
        setRecorderKey(k => k + 1);
      } catch (err) {
        console.error('Error:', err);
        setError('Network error — please check your connection and try again.');
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [
      session,
      rateLimitMsg,
      stopSpeech,
      addMessage,
      setLoading,
      setError,
      addScore,
      addConfidenceScore,
      addCommunicationScore,
      addConceptScore,
      checkAndAdvance,
      onEndInterview,
    ]
  );

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleTextSend = () => {
    sendAnswer(textInput, 'text');
  };

  const handleVoiceTranscript = (
    transcript: string,
    audioUrl: string,
    metrics: AudioMetrics
  ) => {
    sendAnswer(transcript, 'voice', audioUrl, metrics);
  };

  const handleVoiceError = (msg: string) => {
    setError(msg);
  };

  // ─── Session info display ─────────────────────────────────────────────────────

  function SessionBadge() {
    if (!session) return null;
    const { mode } = session;
    if (mode.type === 'time' && timeLeft !== null) {
      const urgent = timeLeft < 60;
      return (
        <span
          className={`text-xs font-mono px-2 py-1 rounded-full border ${
            urgent
              ? 'border-destructive/50 bg-destructive/10 text-destructive animate-pulse'
              : 'border-border bg-muted/40 text-muted-foreground'
          }`}
        >
          ⏱ {formatTime(timeLeft)}
        </span>
      );
    }
    if (mode.type === 'questions') {
      return (
        <span className="text-xs px-2 py-1 rounded-full border border-border bg-muted/40 text-muted-foreground">
          Q {session.mainQuestionCount + 1}/{mode.mainQuestionLimit ?? 5}
        </span>
      );
    }
    return null;
  }

  if (!session) return <div>Loading…</div>;
  const isBlocked = !!rateLimitMsg || session.isLoading;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-border px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground truncate">{session.subject}</h2>
            <p className="text-xs text-muted-foreground">Difficulty: {session.difficulty}</p>
          </div>
          <SessionBadge />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* TTS toggle */}
          <button
            onClick={() => {
              if (isSpeaking) stopSpeech();
              setTtsEnabled(v => !v);
            }}
            title={ttsEnabled ? 'Mute AI voice' : 'Enable AI voice'}
            className={`text-xs px-2 py-1 rounded-full border transition-colors ${
              ttsEnabled
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border bg-muted/40 text-muted-foreground'
            }`}
          >
            {isSpeaking ? '🔊' : ttsEnabled ? '🔉' : '🔇'}
          </button>

          <Button variant="outline" size="sm" onClick={onEndInterview}>
            End Interview
          </Button>
        </div>
      </div>

      {/* ── Rate limit banner ──────────────────────────────────────────────── */}
      {rateLimitMsg && <RateLimitBanner message={rateLimitMsg} />}

      {/* ── Messages ───────────────────────────────────────────────────────── */}
      <MessageList messages={session.messages} isLoading={session.isLoading} />

      {/* ── Input Area ─────────────────────────────────────────────────────── */}
      <div className="border-t border-border px-4 py-4 bg-card space-y-3">
        {session.error && (
          <ErrorBanner message={session.error} onDismiss={() => setError(null)} />
        )}

        {/* Mode toggle */}
        <div className="flex gap-1 p-1 bg-muted/40 rounded-lg w-fit">
          <button
            onClick={() => setInputMode('text')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              inputMode === 'text'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            ⌨️ Type
          </button>
          <button
            onClick={() => setInputMode('voice')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              inputMode === 'voice'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            🎤 Voice
          </button>
        </div>

        {/* Input */}
        {inputMode === 'text' ? (
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder={
                isBlocked ? 'Waiting…' : 'Type your answer here…'
              }
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e =>
                e.key === 'Enter' && !session.isLoading && !rateLimitMsg && handleTextSend()
              }
              disabled={isBlocked}
              className="flex-1"
            />
            <Button
              onClick={handleTextSend}
              disabled={!textInput.trim() || isBlocked}
              className="px-6"
            >
              {session.isLoading ? 'Thinking…' : 'Send'}
            </Button>
          </div>
        ) : (
          <VoiceRecorder
            key={recorderKey}
            questionAskedAt={lastQuestionAt}
            onTranscriptReady={handleVoiceTranscript}
            onError={handleVoiceError}
            disabled={isBlocked}
          />
        )}
      </div>
    </div>
  );
}
