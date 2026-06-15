import Groq from 'groq-sdk';
import { NextRequest, NextResponse } from 'next/server';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Groq Whisper model fallback chain
const WHISPER_MODELS = ['whisper-large-v3-turbo', 'whisper-large-v3'];

export async function POST(request: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: 'configuration_error', message: 'GROQ_API_KEY is not set.' },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Expected multipart/form-data with an audio file.' },
      { status: 400 }
    );
  }

  const audioFile = formData.get('audio') as File | null;
  if (!audioFile) {
    return NextResponse.json(
      { error: 'missing_audio', message: 'No audio file found in request.' },
      { status: 400 }
    );
  }

  let lastError: unknown = null;

  for (const model of WHISPER_MODELS) {
    try {
      // Groq SDK accepts a File/Blob directly
      const transcription = await groq.audio.transcriptions.create({
        file: audioFile,
        model,
        response_format: 'json',
        language: 'en',
      });

      const transcript = transcription.text?.trim() ?? '';
      console.log(`✓ [${model}] transcribed: "${transcript.slice(0, 80)}..."`);

      return NextResponse.json({ transcript });
    } catch (err) {
      lastError = err;
      console.warn(`✗ [${model}] transcription error:`, String(err).slice(0, 120));
      continue;
    }
  }

  // All models failed
  console.error('All Whisper models failed. Last error:', String(lastError).slice(0, 200));
  return NextResponse.json(
    {
      error: 'transcription_failed',
      message: 'Could not transcribe audio. Please type your answer instead.',
    },
    { status: 503 }
  );
}
