# AI Viva Trainer — Voice Feature Implementation Walkthrough

---

## 1. Existing Architecture Analysis

Before writing a single line, the entire codebase was inspected. Here is what was found:

| Layer | Technology |
|---|---|
| Framework | **Next.js 16** with App Router, React 19, TypeScript |
| Styling | **Tailwind CSS v4** with OKLCH dark-mode tokens |
| UI Library | Radix UI + shadcn/ui components |
| State Management | **React Context API** — pure in-memory, no DB |
| AI / LLM | **Groq SDK** with 3-model fallback chain |
| Backend | Next.js API Routes (serverless) |
| Authentication | None |
| Database | None |
| Audio | **None existed** |

Original data flow:
  /setup → initSession() → /viva → ChatInterface
  → user types → POST /api/viva → Groq returns question + evaluation
  → End Interview → /results → getSessionSummary()

---

## 2. Files Inspected

All 15 key files were read before any changes were made:
app/layout.tsx, app/page.tsx, app/setup/page.tsx, app/viva/page.tsx,
app/results/page.tsx, app/api/viva/route.ts, lib/viva-context.tsx,
components/viva/ChatInterface.tsx, components/viva/MessageList.tsx,
components/viva/ScoreDisplay.tsx, components/viva/TypingIndicator.tsx,
package.json, .env, next.config.mjs, app/globals.css

---

## 3. Files Modified

### lib/viva-context.tsx
WHY: Original tracked only correctness scores. New features need 4 score types,
     audio metrics, session modes, and a richer report.

ADDED:
- Evaluation interface with 4 scores + reasoning block + improvement suggestions
- AudioMetrics interface (duration, wordCount, wpm, fillerCount, responseDelay, answerDuration)
- SessionMode interface (type: time|questions with limits)
- Message extended: inputMode, audioUrl, audioTranscript, audioMetrics
- VivaSession extended: confidenceScores[], communicationScores[], conceptScores[], mode, sessionStartTime, counters
- New context actions: addConfidenceScore, addCommunicationScore, addConceptScore, incrementMainQuestion, incrementFollowUp
- getSessionReport() replaces getSessionSummary() — returns 15-field SessionReport

HOW: React Context propagates these values to all components. Calling any setter
     triggers targeted re-renders only in consumers.

---

### app/api/viva/route.ts
WHY: Original prompt requested 3 evaluation fields. New version requests 8 fields
     with per-score reasoning, processes audio stats, and builds adaptive context.

ADDED:
- AudioStats interface accepted in request body
- buildAudioContext(audioStats, inputMode) — tells Groq student's speaking metrics
- buildAdaptiveContext(isFollowUp, previousScores, knowledgeDepth) — tells Groq how to probe
- getSystemPrompt() now accepts 9 parameters
- Response JSON schema: conceptUnderstanding, communicationClarity, confidenceScore,
  improvementSuggestions, reasoning block
- Request body accepts: inputMode, audioStats, isFollowUp, mainQuestionIndex,
  previousScores, knowledgeDepth

HOW: The system prompt tells Groq the exact JSON structure to return. extractJSON()
     handles any stray markdown around the response JSON.

---

### app/setup/page.tsx
WHY: Original only had subject + difficulty. Mode selection needed.

ADDED:
- Card-style toggle: Question-Based vs Time-Based
- Time mode: 5/10/15/20 minute picker
- Question mode: main question count (3/5/7/10) + max follow-ups (1/2/3/5)
- initSession() now receives full SessionMode object

---

### app/viva/page.tsx
WHY: Minor update to pass mode context to initial fetch.

ADDED: mainQuestionIndex: 0 and previousScores: [] in initial question body.

---

### components/viva/ChatInterface.tsx
WHY: Voice/text toggle, TTS, session limits, metrics → all needed here.

ADDED:
useTTS hook: window.speechSynthesis, speaks each new AI question automatically,
  toggle button (mute/unmute), stops speech before user submits answer.

useSessionLimits hook:
  Time mode: setInterval countdown, red pulse below 60s, auto-end at 0.
  Question mode: checkAndAdvance() increments counters, ends session at limit.

Voice/text toggle: pill-shaped mode switcher. recorderKey increments after each
  answer to remount VoiceRecorder (clearing its state for next question).

sendAnswer(): unified function for both text and voice — computes knowledgeDepth
  from last 3 scores, sends all new fields to /api/viva, stores all 4 scores.

---

### components/viva/MessageList.tsx
WHY: Voice badge, audio metrics, playback, and new evaluation fields needed.

ADDED:
- Voice/text badge above each user message
- Inline audio metrics in message bubble (WPM, duration, fillers)
- <audio controls> element for voice answer playback
- Passes all 4 evaluation fields + reasoning to ScoreDisplay

---

### components/viva/ScoreDisplay.tsx
WHY: Original showed 1 score. Now shows 4 with progress bars and AI reasoning.

ADDED:
- MiniBar sub-component: coloured progress bar per score
- 4 score rows: Correctness (blue), Concept (purple), Clarity (green), Confidence (amber)
- Per-score AI reasoning text in tiny muted font
- Overall feedback and missing concepts sections

---

### app/results/page.tsx
WHY: Original showed basic summary. New version is a full viva report with export.

ADDED:
- ScoreBar component: 4 animated metric bars
- Performance colour-coded hero (green/amber/red based on overall score)
- Stats grid: total/voice/text answers, avg WPM, response delay
- Strengths, weak areas, missed concepts (tag cloud), suggestions
- Full transcript panel: every message with evaluation, reasoning, audio metrics, playback
- buildTranscriptText(): human-readable .txt export
- JSON export: structured object with meta, report, and full transcript
- Both exports use programmatic <a> click + blob URL (no server needed)

---

## 4. Files Created

### app/api/transcribe/route.ts (NEW)
WHAT: Accepts multipart/form-data with audio blob, returns { transcript: string }

FLOW:
  FormData received → groq.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-large-v3-turbo',
    response_format: 'json',
    language: 'en'
  }) → { transcript }
  Fallback: whisper-large-v3 if first model fails
  All fail: 503 with message to type instead

WHY SEPARATE ROUTE: STT and LLM evaluation are different concerns. Clean REST.
ZERO NEW PACKAGES: groq-sdk already supports audio transcriptions.

---

### components/viva/VoiceRecorder.tsx (NEW)
WHAT: Self-contained recording component. State: idle→recording→processing→done|error.

RECORDING:
  navigator.mediaDevices.getUserMedia({ audio: true })
  MIME type priority: audio/webm;codecs=opus > webm > ogg > mp4
  MediaRecorder collects chunks every 250ms

ON STOP:
  answerDurationMs = Date.now() - recordingStartRef
  Blob from chunks → URL.createObjectURL(blob) → audioUrl for playback
  Upload to /api/transcribe via FormData
  On transcript: count words, compute WPM = (words/seconds)*60
  Scan transcript for 16 filler patterns (regex with word boundaries)
  Measure responseDelayMs = Date.now() - questionAskedAt (at recording start)
  Fire onTranscriptReady(transcript, audioUrl, metrics)

FILLER WORDS DETECTED:
  umm, um, uh, uhh, err, hmm, like, basically, actually, literally,
  you know, i mean, kind of, sort of, right, okay so, so basically

UI STATES:
  idle: blue mic SVG button
  recording: red pulsing stop button with animated ring + REC MM:SS timer
  processing: spinner + "Transcribing audio..." text
  done: green checkmark + transcript preview + audio player + Re-record link
  error: error message + Re-record link

---

## 5. Database Changes

None. No database exists in this project. Session data is in React state.
Export feature allows users to save their report as .txt or .json.

---

## 6. API Changes

POST /api/viva request:
  Before: { messages, subject, difficulty, isFirstMessage }
  After: + inputMode, audioStats, isFollowUp, mainQuestionIndex, previousScores, knowledgeDepth

POST /api/viva response evaluation:
  Before: { correctness, clarity, missingConcepts }
  After: + conceptUnderstanding, communicationClarity, confidenceScore,
           improvementSuggestions, reasoning (4 reason strings), isFollowUp

POST /api/transcribe (NEW):
  Request: multipart/form-data with audio file
  Response: { transcript: string }

---

## 7. Audio Recording Flow

User clicks mic →
  getUserMedia({ audio: true }) →
  responseDelay captured = Date.now() - questionAskedAt →
  MediaRecorder.start(250ms) →
  User clicks stop →
  recorder.onstop: assemble Blob → create audioUrl →
  fetch('/api/transcribe', FormData) →
  Groq Whisper → transcript →
  computeMetrics(transcript, duration) →
  onTranscriptReady(transcript, audioUrl, metrics) →
  ChatInterface.sendAnswer('voice', audioUrl, metrics)

---

## 8. Speech-to-Text Flow

POST /api/transcribe ←
  FormData with audio blob (webm/ogg/mp4)
  try: groq.audio.transcriptions.create({ file, model: 'whisper-large-v3-turbo', language: 'en' })
  returns { transcript }
  fallback: whisper-large-v3
  all fail: 503

---

## 9. Groq Integration Flow

sendAnswer(text, 'voice', audioUrl, metrics):
  knowledgeDepth = avg(last 3 scores) >= 7 ? 'deep' : >= 4 ? 'moderate' : 'surface'

POST /api/viva:
  systemPrompt includes:
    - Core examiner role
    - Audio metrics block (WPM, fillers, delay) if voice
    - Adaptive context (how deep to probe) if follow-up

  Groq returns:
    { question, isFollowUp, evaluation: {
        correctness, conceptUnderstanding, communicationClarity, confidenceScore,
        clarity, missingConcepts, improvementSuggestions,
        reasoning: { correctnessReason, conceptReason, communicationReason, confidenceReason }
      }
    }

All 4 scores stored in context arrays → used in report

---

## 10. Confidence Scoring Logic

CLIENT-SIDE (hard metrics sent to Groq):
  - fillerWordCount: regex scan of 16 filler patterns
  - wpm: (wordCount / durationSeconds) * 60
  - responseDelayMs: time from question display to mic click
  - answerDurationMs: total recording time

SERVER-SIDE (Groq AI reasoning):
  > 5 fillers → significantly lower confidence
  delay > 5s → suggests uncertainty
  wpm < 80 → excessive hesitation
  wpm > 180 → nervous/rushed or over-rehearsed
  short answer on complex topic → lower confidence
  Groq explains reasoning in confidenceReason field

For text answers: Groq infers from hedging language, vague phrasing, etc.

---

## 11. Session Management Logic

TIME-BASED:
  Session starts → setInterval every 1s
  timeLeft = (timeLimitMinutes * 60) - elapsedSeconds
  Header shows "⏱ MM:SS" → red + pulsing when < 60s
  timeLeft reaches 0 → clearInterval + onEndInterview()

QUESTION-BASED:
  After each Groq response → checkAndAdvance(wasFollowUp):
    if wasFollowUp:
      followUpCount++ 
      if >= maxFollowUpsPerQuestion: incrementMainQuestion() (resets followUpCount)
    else:
      incrementMainQuestion()
    if mainQuestionCount >= mainQuestionLimit: return true → onEndInterview()
  Header shows "Q 2/5"

---

## 12. Report Generation Logic

getSessionReport():
  overallScore = avg(scores)
  confidencePercent = avg(confidenceScores) * 10
  communicationScore = avg(communicationScores)
  conceptScore = avg(conceptScores)

  strengths = messages where correctness >= 7, take clarity text
  weakAreas = messages where correctness <= 4, take clarity text
  missedConcepts = all missingConcepts[] combined, deduplicated
  suggestions = all improvementSuggestions[] combined, deduplicated

  voiceAnswers / textAnswers = count by inputMode
  averageWPM = avg(audioMetrics.wpm)
  averageResponseDelayMs = avg(audioMetrics.responseDelayMs)
  sessionDurationMs = Date.now() - sessionStartTime

  predictedPerformance:
    >= 8.0 → "Excellent — Distinction expected"
    >= 6.5 → "Good — Pass with merit likely"
    >= 5.0 → "Average — Borderline pass"
    >= 3.0 → "Below Average — Extra preparation needed"
    < 3.0  → "Needs Significant Improvement"

---

## 13. Export Logic

TXT: buildTranscriptText() → formatted string with headers, all scores, full
     conversation with metrics and evaluation per message → Blob → <a> click

JSON: { meta, report, transcript[] } → JSON.stringify → Blob → <a> click

Both run entirely in the browser — no server call needed.

---

## 14. Text-to-Speech Flow

New AI message arrives → session.messages.length changes →
  ChatInterface useEffect triggers →
  finds last assistant message →
  setLastQuestionAt(timestamp) [for VoiceRecorder delay calc] →
  if ttsEnabled: speak(content)

speak(text):
  speechSynthesis.cancel() [stop ongoing speech]
  new SpeechSynthesisUtterance(text)
  utt.rate = 0.95
  pick English voice preferring "Google" or "Natural"
  speechSynthesis.speak(utt)

Toggle: 🔊 (speaking) | 🔉 (enabled, silent) | 🔇 (disabled)
Before user submits: stopSpeech() called to avoid overlap

---

## 15. How a Beginner Can Understand This

STEP 1 — THE BIG PICTURE:
  The app simulates a real viva exam. An AI "examiner" (Groq LLM) asks questions.
  You answer by typing or speaking. The AI scores your answer and asks follow-ups.

STEP 2 — HOW SPEAKING WORKS:
  Browser has a built-in MediaRecorder. When you click mic:
  1. Browser asks for mic permission
  2. Records audio chunks every 250ms
  3. On stop: combines chunks into an audio file (Blob)
  4. Sends to /api/transcribe server
  5. Server sends to Groq Whisper AI
  6. Whisper returns the words you said as text
  7. Those words are treated exactly like typed text

STEP 3 — HOW CONFIDENCE ANALYSIS WORKS:
  While you record, the app measures:
  - How long you waited before answering (response delay)
  - How long you spoke (duration)
  - Words per minute = (words / seconds) * 60
  - Filler words: scans transcript for "um", "uh", "like", "basically", etc.
  All these numbers are sent to Groq, which reasons about your confidence level.

STEP 4 — HOW ADAPTIVE FOLLOW-UPS WORK:
  After each answer, the app knows your average score.
  It tells Groq: "student scored avg 6/10 — they understand basics but probe edge cases"
  OR: "student scored avg 3/10 — simplify and ask them to define key terms first"
  Groq adjusts the next question accordingly.

STEP 5 — HOW SESSION MODES WORK:
  Time mode = a countdown timer (setInterval). Hits zero → interview ends.
  Question mode = two counters. When main question count hits the limit → ends.

STEP 6 — HOW THE REPORT IS GENERATED:
  getSessionReport() averages the score arrays collected during the session.
  It also gathers all missing concepts and suggestions into deduplicated lists.
  The predicted performance string is chosen based on overall score ranges.

STEP 7 — HOW EXPORT WORKS:
  JavaScript builds a string or object, creates a Blob (in-memory file),
  generates a temporary blob:// URL, creates a hidden <a> tag, clicks it,
  then deletes it. The browser shows a Save File dialog. No server needed.

---

## Summary

| File | Status | Key Feature |
|---|---|---|
| lib/viva-context.tsx | MODIFIED | Extended types, 4 score arrays, session modes, rich report |
| app/api/viva/route.ts | MODIFIED | 6-metric eval, reasoning, audio context, adaptive follow-ups |
| app/api/transcribe/route.ts | NEW | Groq Whisper STT |
| components/viva/VoiceRecorder.tsx | NEW | Mic recording, filler analysis, WPM, delay, audio URL |
| components/viva/ChatInterface.tsx | MODIFIED | TTS, voice/text toggle, session limits, metrics |
| components/viva/MessageList.tsx | MODIFIED | Voice badge, audio metrics, audio playback |
| components/viva/ScoreDisplay.tsx | MODIFIED | 4 scores with bars and AI reasoning |
| app/setup/page.tsx | MODIFIED | Session mode selection |
| app/viva/page.tsx | MODIFIED | Minor: passes mode context to initial fetch |
| app/results/page.tsx | MODIFIED | Full report, transcript, audio playback, TXT/JSON export |

New npm packages: 0
Build status: EXIT CODE 0 (all 7 routes compiled successfully)
