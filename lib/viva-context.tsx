'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

// ─── Core Types ────────────────────────────────────────────────────────────────

export interface Evaluation {
  correctness: number;           // 0-10
  conceptUnderstanding: number;  // 0-10
  communicationClarity: number;  // 0-10
  confidenceScore: number;       // 0-10
  clarity: string;               // overall feedback sentence
  missingConcepts: string[];
  improvementSuggestions: string[];
  // Per-score reasoning (new)
  reasoning: {
    correctnessReason: string;
    conceptReason: string;
    communicationReason: string;
    confidenceReason: string;
  };
}

export interface AudioMetrics {
  durationSeconds: number;
  wordCount: number;
  wpm: number;
  fillerWordCount: number;
  fillerWords: string[];       // which fillers were detected
  responseDelayMs: number;     // ms between question display and recording start
  answerDurationMs: number;    // ms of actual recording
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  inputMode?: 'text' | 'voice';
  audioUrl?: string;            // object URL for playback (voice answers only)
  audioTranscript?: string;     // raw Whisper transcript
  audioMetrics?: AudioMetrics;  // speaking stats
  evaluation?: Evaluation | null;
  questionAskedAt?: number;     // timestamp when AI question was rendered (for delay calc)
}

export interface SessionMode {
  type: 'time' | 'questions';
  timeLimitMinutes?: number;        // for time mode
  mainQuestionLimit?: number;       // for question mode
  maxFollowUpsPerQuestion?: number; // for question mode
}

export interface VivaSession {
  subject: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  messages: Message[];
  scores: number[];               // correctness scores
  confidenceScores: number[];
  communicationScores: number[];
  conceptScores: number[];
  isLoading: boolean;
  error: string | null;
  mode: SessionMode;
  sessionStartTime: number;       // Date.now() when session started
  mainQuestionCount: number;      // how many non-follow-up questions asked
  followUpCount: number;          // follow-ups for the current main question
}

export interface SessionReport {
  overallScore: number;
  correctnessPercent: number;
  confidencePercent: number;
  communicationScore: number;
  conceptScore: number;
  strengths: string[];
  weakAreas: string[];
  missedConcepts: string[];
  suggestions: string[];
  predictedPerformance: string;
  totalAnswers: number;
  voiceAnswers: number;
  textAnswers: number;
  averageWPM: number;
  averageResponseDelayMs: number;
  sessionDurationMs: number;
}

// ─── Context Interface ─────────────────────────────────────────────────────────

interface VivaContextType {
  session: VivaSession | null;
  initSession: (
    subject: string,
    difficulty: 'Easy' | 'Medium' | 'Hard',
    mode: SessionMode
  ) => void;
  addMessage: (message: Message) => void;
  addScore: (score: number) => void;
  addConfidenceScore: (score: number) => void;
  addCommunicationScore: (score: number) => void;
  addConceptScore: (score: number) => void;
  incrementMainQuestion: () => void;
  incrementFollowUp: () => void;
  resetFollowUpCount: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetSession: () => void;
  getSessionReport: () => SessionReport;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const VivaContext = createContext<VivaContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function VivaProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<VivaSession | null>(null);

  const initSession = useCallback(
    (subject: string, difficulty: 'Easy' | 'Medium' | 'Hard', mode: SessionMode) => {
      setSession({
        subject,
        difficulty,
        messages: [],
        scores: [],
        confidenceScores: [],
        communicationScores: [],
        conceptScores: [],
        isLoading: false,
        error: null,
        mode,
        sessionStartTime: Date.now(),
        mainQuestionCount: 0,
        followUpCount: 0,
      });
    },
    []
  );

  const addMessage = useCallback((message: Message) => {
    setSession(prev => {
      if (!prev) return null;
      return { ...prev, messages: [...prev.messages, message] };
    });
  }, []);

  const addScore = useCallback((score: number) => {
    setSession(prev => {
      if (!prev) return null;
      return { ...prev, scores: [...prev.scores, score] };
    });
  }, []);

  const addConfidenceScore = useCallback((score: number) => {
    setSession(prev => {
      if (!prev) return null;
      return { ...prev, confidenceScores: [...prev.confidenceScores, score] };
    });
  }, []);

  const addCommunicationScore = useCallback((score: number) => {
    setSession(prev => {
      if (!prev) return null;
      return { ...prev, communicationScores: [...prev.communicationScores, score] };
    });
  }, []);

  const addConceptScore = useCallback((score: number) => {
    setSession(prev => {
      if (!prev) return null;
      return { ...prev, conceptScores: [...prev.conceptScores, score] };
    });
  }, []);

  const incrementMainQuestion = useCallback(() => {
    setSession(prev => {
      if (!prev) return null;
      return { ...prev, mainQuestionCount: prev.mainQuestionCount + 1, followUpCount: 0 };
    });
  }, []);

  const incrementFollowUp = useCallback(() => {
    setSession(prev => {
      if (!prev) return null;
      return { ...prev, followUpCount: prev.followUpCount + 1 };
    });
  }, []);

  const resetFollowUpCount = useCallback(() => {
    setSession(prev => {
      if (!prev) return null;
      return { ...prev, followUpCount: 0 };
    });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setSession(prev => {
      if (!prev) return null;
      return { ...prev, isLoading: loading };
    });
  }, []);

  const setError = useCallback((error: string | null) => {
    setSession(prev => {
      if (!prev) return null;
      return { ...prev, error };
    });
  }, []);

  const resetSession = useCallback(() => {
    setSession(null);
  }, []);

  // ─── Report Generation ───────────────────────────────────────────────────────

  const getSessionReport = useCallback((): SessionReport => {
    if (!session) {
      return {
        overallScore: 0,
        correctnessPercent: 0,
        confidencePercent: 0,
        communicationScore: 0,
        conceptScore: 0,
        strengths: [],
        weakAreas: [],
        missedConcepts: [],
        suggestions: [],
        predictedPerformance: 'Incomplete',
        totalAnswers: 0,
        voiceAnswers: 0,
        textAnswers: 0,
        averageWPM: 0,
        averageResponseDelayMs: 0,
        sessionDurationMs: 0,
      };
    }

    const avg = (arr: number[]) =>
      arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

    const overallScore = avg(session.scores);
    const correctnessPercent = Math.round(avg(session.scores) * 10);
    const confidencePercent = Math.round(avg(session.confidenceScores) * 10);
    const communicationScore = avg(session.communicationScores);
    const conceptScore = avg(session.conceptScores);

    const strengths: string[] = [];
    const weakAreas: string[] = [];
    const missedConcepts: string[] = [];
    const suggestions: string[] = [];

    session.messages.forEach((msg) => {
      if (msg.role !== 'assistant' || !msg.evaluation) return;
      const ev = msg.evaluation;
      const { correctness, missingConcepts, improvementSuggestions } = ev;

      if (correctness >= 7) {
        if (ev.clarity?.length > 10) strengths.push(ev.clarity);
      } else if (correctness <= 4) {
        if (ev.clarity?.length > 10) weakAreas.push(ev.clarity);
      }
      missingConcepts?.forEach(c => missedConcepts.push(c));
      improvementSuggestions?.forEach(s => suggestions.push(s));
    });

    // Voice/text answer breakdown
    const userMessages = session.messages.filter(m => m.role === 'user');
    const voiceAnswers = userMessages.filter(m => m.inputMode === 'voice').length;
    const textAnswers = userMessages.filter(m => m.inputMode === 'text').length;

    // Average WPM from voice answers
    const wpmValues = userMessages
      .filter(m => m.audioMetrics?.wpm)
      .map(m => m.audioMetrics!.wpm);
    const averageWPM = avg(wpmValues);

    // Average response delay
    const delayValues = userMessages
      .filter(m => m.audioMetrics?.responseDelayMs)
      .map(m => m.audioMetrics!.responseDelayMs);
    const averageResponseDelayMs = avg(delayValues);

    // Predicted performance
    let predictedPerformance = 'Needs Improvement';
    if (overallScore >= 8) predictedPerformance = 'Excellent — Distinction expected';
    else if (overallScore >= 6.5) predictedPerformance = 'Good — Pass with merit likely';
    else if (overallScore >= 5) predictedPerformance = 'Average — Borderline pass';
    else if (overallScore >= 3) predictedPerformance = 'Below Average — Extra preparation needed';
    else predictedPerformance = 'Needs Significant Improvement';

    return {
      overallScore,
      correctnessPercent,
      confidencePercent,
      communicationScore,
      conceptScore,
      strengths: [...new Set(strengths)].slice(0, 5),
      weakAreas: [...new Set(weakAreas)].slice(0, 5),
      missedConcepts: [...new Set(missedConcepts)].slice(0, 10),
      suggestions: [...new Set(suggestions)].slice(0, 6),
      predictedPerformance,
      totalAnswers: userMessages.length,
      voiceAnswers,
      textAnswers,
      averageWPM,
      averageResponseDelayMs,
      sessionDurationMs: Date.now() - session.sessionStartTime,
    };
  }, [session]);

  return (
    <VivaContext.Provider
      value={{
        session,
        initSession,
        addMessage,
        addScore,
        addConfidenceScore,
        addCommunicationScore,
        addConceptScore,
        incrementMainQuestion,
        incrementFollowUp,
        resetFollowUpCount,
        setLoading,
        setError,
        resetSession,
        getSessionReport,
      }}
    >
      {children}
    </VivaContext.Provider>
  );
}

export function useViva() {
  const context = useContext(VivaContext);
  if (!context) throw new Error('useViva must be used within VivaProvider');
  return context;
}
