'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatInterface } from '@/components/viva/ChatInterface';
import { useViva, Message } from '@/lib/viva-context';
import { Button } from '@/components/ui/button';

function RateLimitScreen({ message }: { message: string }) {
  const router = useRouter();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl">⏳</div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">API Limit Reached</h2>
          <p className="text-muted-foreground leading-relaxed">{message}</p>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <strong>Groq free tier</strong> resets every 24 hours.<br />
          Come back tomorrow to continue practising! 🌙
        </div>
        <Button variant="outline" onClick={() => router.push('/')}>
          ← Back to Home
        </Button>
      </div>
    </div>
  );
}

export default function VivaPage() {
  const router = useRouter();
  const { session, addMessage, setLoading, setError } = useViva();
  const hasFetched = useRef(false);
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      router.push('/setup');
      return;
    }
    if (session.messages.length === 0 && !hasFetched.current) {
      hasFetched.current = true;
      fetchInitialQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInitialQuestion = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const response = await fetch('/api/viva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [],
          subject: session.subject,
          difficulty: session.difficulty,
          isFirstMessage: true,
          // Pass mode context so the AI can set appropriate depth for first question
          mainQuestionIndex: 0,
          previousScores: [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429 || data.error === 'rate_limit') {
          setRateLimitMsg(
            data.message ||
            "You've reached the daily API limit. Groq's free tier resets every 24 hours. Please try again tomorrow! 🌙"
          );
          return;
        }
        setError(data.message || data.details || data.error || `Server error (${response.status})`);
        return;
      }

      if (!data.question) {
        setError('Received an invalid response. Please try again.');
        return;
      }

      const initialMessage: Message = {
        id: `initial-${Date.now()}`,
        role: 'assistant',
        content: data.question,
        timestamp: Date.now(),
        evaluation: null,
      };

      addMessage(initialMessage);
    } catch (error) {
      console.error('Error fetching initial question:', error);
      setError('Network error — please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading…</p>
      </div>
    );
  }

  if (rateLimitMsg) {
    return <RateLimitScreen message={rateLimitMsg} />;
  }

  return <ChatInterface onEndInterview={() => router.push('/results')} />;
}
