'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AudioMetrics } from '@/lib/viva-context';

// ─── Filler word list ─────────────────────────────────────────────────────────
const FILLER_WORDS = [
  'umm', 'um', 'uh', 'uhh', 'err', 'hmm',
  'like', 'basically', 'actually', 'literally',
  'you know', 'i mean', 'kind of', 'sort of',
  'right', 'okay so', 'so basically',
];

function analyzeFillersFromTranscript(transcript: string): { fillerWordCount: number; fillerWords: string[] } {
  const lower = transcript.toLowerCase();
  const found: string[] = [];
  let count = 0;
  for (const filler of FILLER_WORDS) {
    const regex = new RegExp(`\\b${filler.replace(/ /g, '\\s+')}\\b`, 'gi');
    const matches = lower.match(regex);
    if (matches && matches.length > 0) {
      found.push(filler);
      count += matches.length;
    }
  }
  return { fillerWordCount: count, fillerWords: [...new Set(found)] };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type RecordingState = 'idle' | 'recording' | 'processing' | 'done' | 'error';

interface VoiceRecorderProps {
  questionAskedAt: number; // timestamp when question was displayed — for delay calc
  onTranscriptReady: (transcript: string, audioUrl: string, metrics: AudioMetrics) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VoiceRecorder({
  questionAskedAt,
  onTranscriptReady,
  onError,
  disabled = false,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartRef = useRef<number>(0);
  const responseDelayRef = useRef<number>(0);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [audioUrl]);

  const startRecording = useCallback(async () => {
    if (disabled) return;
    setTranscript('');
    setAudioUrl(null);
    setErrorMsg('');
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick a supported MIME type
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4']
        .find(t => MediaRecorder.isTypeSupported(t)) ?? '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(t => t.stop());

        const mimeUsed = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeUsed });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        const answerDurationMs = Date.now() - recordingStartRef.current;

        setState('processing');

        // Upload to /api/transcribe
        const form = new FormData();
        // Use .webm extension for Whisper compatibility
        const ext = mimeUsed.includes('mp4') ? 'mp4' : mimeUsed.includes('ogg') ? 'ogg' : 'webm';
        form.append('audio', blob, `recording.${ext}`);

        try {
          const res = await fetch('/api/transcribe', { method: 'POST', body: form });
          const data = await res.json();

          if (!res.ok || !data.transcript) {
            throw new Error(data.message ?? 'Transcription failed');
          }

          const text: string = data.transcript;
          setTranscript(text);

          const wordCount = countWords(text);
          const durationSeconds = answerDurationMs / 1000;
          const wpm = durationSeconds > 0 ? Math.round((wordCount / durationSeconds) * 60) : 0;
          const { fillerWordCount, fillerWords } = analyzeFillersFromTranscript(text);

          const metrics: AudioMetrics = {
            durationSeconds,
            wordCount,
            wpm,
            fillerWordCount,
            fillerWords,
            responseDelayMs: responseDelayRef.current,
            answerDurationMs,
          };

          setState('done');
          onTranscriptReady(text, url, metrics);
        } catch (err) {
          console.error('Transcription error:', err);
          const msg = err instanceof Error ? err.message : 'Transcription failed';
          setErrorMsg(msg);
          setState('error');
          onError(msg);
        }
      };

      responseDelayRef.current = Date.now() - questionAskedAt;
      recordingStartRef.current = Date.now();
      recorder.start(250); // collect chunks every 250ms
      setState('recording');
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone error:', err);
      const msg =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow mic access in your browser.'
          : 'Could not access microphone. Please check your device settings.';
      setErrorMsg(msg);
      setState('error');
      onError(msg);
    }
  }, [disabled, questionAskedAt, onTranscriptReady, onError]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setTranscript('');
    setErrorMsg('');
    setElapsed(0);
    setState('idle');
  }, [audioUrl]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      {/* Main control row */}
      <div className="flex items-center gap-3">
        {/* Record / Stop button */}
        {state === 'idle' || state === 'error' ? (
          <button
            onClick={startRecording}
            disabled={disabled}
            title="Start recording"
            className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
              disabled
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 shadow-lg hover:shadow-primary/40'
            }`}
          >
            {/* Mic icon */}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </button>
        ) : state === 'recording' ? (
          <button
            onClick={stopRecording}
            title="Stop recording"
            className="relative flex items-center justify-center w-12 h-12 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-95 shadow-lg hover:shadow-destructive/40 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-destructive"
          >
            {/* Pulsing ring animation */}
            <span className="absolute inset-0 rounded-full bg-destructive/40 animate-ping" />
            {/* Stop icon */}
            <svg className="w-4 h-4 relative z-10" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          // Processing or done spinner placeholder
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
            {state === 'processing' ? (
              <svg className="w-5 h-5 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            )}
          </div>
        )}

        {/* State label + timer */}
        <div className="flex-1 min-w-0">
          {state === 'idle' && (
            <p className="text-sm text-muted-foreground">Click to record your answer</p>
          )}
          {state === 'recording' && (
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-mono text-destructive font-semibold">
                REC {formatTime(elapsed)}
              </span>
            </div>
          )}
          {state === 'processing' && (
            <p className="text-sm text-primary animate-pulse">Transcribing audio…</p>
          )}
          {state === 'done' && (
            <p className="text-sm text-green-400 font-medium">✓ Transcript ready</p>
          )}
          {state === 'error' && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}
        </div>

        {/* Reset button when done or error */}
        {(state === 'done' || state === 'error') && (
          <button
            onClick={reset}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            Re-record
          </button>
        )}
      </div>

      {/* Transcript preview */}
      {transcript && (
        <div className="rounded-lg bg-secondary/20 border border-secondary/40 px-3 py-2">
          <p className="text-xs text-muted-foreground mb-1 font-medium">TRANSCRIPT</p>
          <p className="text-sm text-foreground leading-relaxed">{transcript}</p>
        </div>
      )}

      {/* Audio playback */}
      {audioUrl && state === 'done' && (
        <audio
          controls
          src={audioUrl}
          className="w-full h-8 rounded-lg"
          style={{ colorScheme: 'dark' }}
        />
      )}
    </div>
  );
}
