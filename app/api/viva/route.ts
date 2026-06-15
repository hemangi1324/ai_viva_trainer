import Groq from 'groq-sdk';
import { NextRequest, NextResponse } from 'next/server';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AudioStats {
  durationSeconds?: number;
  wordCount?: number;
  wpm?: number;
  fillerWordCount?: number;
  fillerWords?: string[];
  responseDelayMs?: number;
  answerDurationMs?: number;
}

interface RequestBody {
  messages: Message[];
  subject: string;
  difficulty: string;
  isFirstMessage: boolean;
  inputMode?: 'text' | 'voice';
  audioStats?: AudioStats;
  // For adaptive follow-ups
  isFollowUp?: boolean;
  mainQuestionIndex?: number;
  previousScores?: number[];       // correctness scores so far
  knowledgeDepth?: 'surface' | 'moderate' | 'deep'; // inferred from last answer
}

// Groq model fallback chain (free tier, most capable first)
const MODEL_CHAIN = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
];

/**
 * Robust JSON extractor — handles plain JSON, markdown-fenced JSON, nested objects
 */
function extractJSON(text: string): Record<string, unknown> | null {
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch { /* fall through */ }

  // Brace counting to find outermost {}
  let start = -1;
  let depth = 0;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (cleaned[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        try {
          const candidate = cleaned.slice(start, i + 1);
          const parsed = JSON.parse(candidate);
          if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
        } catch { /* try next */ }
        start = -1;
      }
    }
  }
  return null;
}

function buildAudioContext(audioStats?: AudioStats, inputMode?: string): string {
  if (!audioStats || inputMode !== 'voice') return '';

  const parts: string[] = ['\n\nAUDIO METRICS (for confidence analysis):'];
  if (audioStats.durationSeconds != null)
    parts.push(`- Recording duration: ${audioStats.durationSeconds.toFixed(1)}s`);
  if (audioStats.wordCount != null)
    parts.push(`- Word count: ${audioStats.wordCount}`);
  if (audioStats.wpm != null)
    parts.push(`- Speaking speed: ${audioStats.wpm} WPM (normal range: 120-160 WPM)`);
  if (audioStats.fillerWordCount != null)
    parts.push(`- Filler words detected: ${audioStats.fillerWordCount} (${(audioStats.fillerWords ?? []).join(', ')})`);
  if (audioStats.responseDelayMs != null)
    parts.push(`- Response delay (time to start answering): ${(audioStats.responseDelayMs / 1000).toFixed(1)}s`);
  if (audioStats.answerDurationMs != null)
    parts.push(`- Total answer duration: ${(audioStats.answerDurationMs / 1000).toFixed(1)}s`);

  parts.push(
    '\nUse these metrics to inform confidenceScore:',
    '- High WPM (>180) or very low WPM (<80) may indicate nervousness or over-rehearsal',
    '- Many filler words (>5) strongly lower confidence score',
    '- Long response delay (>5s) suggests uncertainty',
    '- Short answer with few words on a complex topic is a red flag'
  );
  return parts.join('\n');
}

function buildAdaptiveContext(
  isFollowUp?: boolean,
  previousScores?: number[],
  knowledgeDepth?: string,
  mainQuestionIndex?: number
): string {
  if (!isFollowUp) return '';

  const avgScore =
    previousScores && previousScores.length > 0
      ? previousScores.reduce((a, b) => a + b, 0) / previousScores.length
      : 5;

  const parts: string[] = ['\n\nADAPTIVE FOLLOW-UP CONTEXT:'];
  parts.push(`- This is a follow-up question for main question #${(mainQuestionIndex ?? 0) + 1}`);
  parts.push(`- Student average correctness so far: ${avgScore.toFixed(1)}/10`);
  parts.push(`- Demonstrated knowledge depth: ${knowledgeDepth ?? 'moderate'}`);

  if (avgScore >= 7) {
    parts.push(
      '- Student is performing well. Push deeper: ask about edge cases, internal mechanics, trade-offs, or real-world scenarios.'
    );
  } else if (avgScore >= 4) {
    parts.push(
      '- Student has partial knowledge. Probe the specific gaps: ask them to clarify the weak points or give an example.'
    );
  } else {
    parts.push(
      '- Student is struggling. Simplify slightly but still probe: ask them to define key terms or explain a simpler related concept first.'
    );
  }

  return parts.join('\n');
}

function getSystemPrompt(
  subject: string,
  difficulty: string,
  isFirstMessage: boolean,
  inputMode?: string,
  audioStats?: AudioStats,
  isFollowUp?: boolean,
  previousScores?: number[],
  knowledgeDepth?: string,
  mainQuestionIndex?: number
): string {
  const audioContext = buildAudioContext(audioStats, inputMode);
  const adaptiveContext = buildAdaptiveContext(isFollowUp, previousScores, knowledgeDepth, mainQuestionIndex);

  return `[ignoring loop detection]
You are an expert engineering viva examiner for ${subject}. Difficulty: ${difficulty}.

EXAMINER RULES:
- Ask ONE concise, precise technical question at a time.
- Evaluate the student's answer with strict academic honesty.
- Generate intelligent follow-up questions based on demonstrated knowledge depth.
- Do NOT give away answers — guide the student to think deeper.
- If the student shows surface knowledge, probe internal mechanisms and edge cases.
- If the student shows deep knowledge, explore advanced trade-offs and real-world applications.
${audioContext}
${adaptiveContext}

EVALUATION CRITERIA (all scored 0-10):
1. correctness — factual accuracy and completeness
2. conceptUnderstanding — depth of understanding beyond memorization
3. communicationClarity — how clearly and structured the explanation was
4. confidenceScore — inferred from phrasing, hesitation, filler words, speaking speed${inputMode === 'voice' ? ' and audio metrics above' : ' and text phrasing patterns'}

${isFirstMessage
    ? 'FIRST MESSAGE: Ask an opening viva question appropriate to subject and difficulty. Set evaluation to null.'
    : `FOLLOW-UP MESSAGE: First, fully evaluate the student's last answer. Then ask the next question.
${isFollowUp
      ? 'Generate an ADAPTIVE follow-up based on what the student just showed they know/don\'t know.'
      : 'Start a new main topic question.'
    }`
  }

CRITICAL: Respond ONLY with valid JSON. No markdown, no extra text:
{
  "question": "Your next question here",
  "isFollowUp": true,
  "evaluation": {
    "correctness": 7,
    "conceptUnderstanding": 6,
    "communicationClarity": 8,
    "confidenceScore": 5,
    "clarity": "Overall feedback sentence",
    "missingConcepts": ["concept1", "concept2"],
    "improvementSuggestions": ["suggestion1", "suggestion2"],
    "reasoning": {
      "correctnessReason": "Why you gave this correctness score",
      "conceptReason": "Why you gave this concept understanding score",
      "communicationReason": "Why you gave this communication clarity score",
      "confidenceReason": "Why you gave this confidence score"
    }
  }
}`;
}

function is429(error: unknown): boolean {
  const msg = String(error);
  return (
    msg.includes('429') ||
    msg.includes('Too Many Requests') ||
    msg.includes('rate_limit_exceeded') ||
    msg.includes('Rate limit') ||
    (error instanceof Error && (error as { status?: number }).status === 429)
  );
}

export async function POST(request: NextRequest) {
  const body: RequestBody = await request.json();
  const {
    messages,
    subject,
    difficulty,
    isFirstMessage,
    inputMode,
    audioStats,
    isFollowUp,
    previousScores,
    knowledgeDepth,
    mainQuestionIndex,
  } = body;

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: 'configuration_error', message: 'GROQ_API_KEY is not configured.' },
      { status: 500 }
    );
  }

  const systemPrompt = getSystemPrompt(
    subject,
    difficulty,
    isFirstMessage,
    inputMode,
    audioStats,
    isFollowUp,
    previousScores,
    knowledgeDepth,
    mainQuestionIndex
  );

  const chatHistory = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' as const : 'assistant' as const,
    content: msg.content,
  }));

  let lastError: unknown = null;

  for (const modelName of MODEL_CHAIN) {
    try {
      const completion = await groq.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          ...chatHistory,
          ...(isFirstMessage
            ? [{ role: 'user' as const, content: 'Please start the viva examination.' }]
            : []),
        ],
        temperature: 0.7,
        max_tokens: 1200,
      });

      const responseText = completion.choices[0]?.message?.content ?? '';
      console.log(`✓ [${modelName}] raw response:`, responseText.slice(0, 200));

      let parsedResponse = extractJSON(responseText);

      if (!parsedResponse?.question) {
        parsedResponse = {
          question:
            responseText.replace(/```[\s\S]*?```/g, '').trim() ||
            'Could you elaborate on your understanding of the topic?',
          isFollowUp: isFollowUp ?? false,
          evaluation: isFirstMessage
            ? null
            : {
                correctness: 5,
                conceptUnderstanding: 5,
                communicationClarity: 5,
                confidenceScore: 5,
                clarity: 'Could not parse AI response — please continue.',
                missingConcepts: [],
                improvementSuggestions: [],
                reasoning: {
                  correctnessReason: 'Parse error',
                  conceptReason: 'Parse error',
                  communicationReason: 'Parse error',
                  confidenceReason: 'Parse error',
                },
              },
        };
      }

      if (isFirstMessage) {
        parsedResponse.evaluation = null;
      }

      return NextResponse.json(parsedResponse);
    } catch (error) {
      lastError = error;
      if (is429(error)) {
        console.warn(`✗ [${modelName}] rate-limited — trying next model...`);
        continue;
      }
      console.warn(`✗ [${modelName}] error: ${String(error).slice(0, 150)}`);
      continue;
    }
  }

  console.error('All Groq models exhausted. Last error:', String(lastError).slice(0, 200));

  if (is429(lastError)) {
    return NextResponse.json(
      {
        error: 'rate_limit',
        message:
          "You've reached the daily API limit for today. Groq's free tier resets every 24 hours. Please try again tomorrow! 🌙",
      },
      { status: 429 }
    );
  }

  return NextResponse.json(
    {
      error: 'service_unavailable',
      message: 'The AI service is temporarily unavailable. Please try again in a few minutes.',
    },
    { status: 503 }
  );
}
