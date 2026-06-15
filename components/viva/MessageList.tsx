'use client';

import React from 'react';
import { Message } from '@/lib/viva-context';
import { ScoreDisplay } from './ScoreDisplay';
import { TypingIndicator } from './TypingIndicator';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-center text-muted-foreground">
            Ready to start? Your viva will begin shortly…
          </p>
        </div>
      ) : (
        <>
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
              <div className="flex flex-col gap-1 max-w-[80%] md:max-w-[60%]">
                {/* Input mode badge for user messages */}
                {msg.role === 'user' && msg.inputMode && (
                  <div className="flex justify-end">
                    <span className="text-xs text-muted-foreground">
                      {msg.inputMode === 'voice' ? '🎤 voice' : '⌨️ typed'}
                    </span>
                  </div>
                )}

                <div
                  className={`rounded-lg px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-none'
                      : 'bg-card border border-border text-foreground rounded-bl-none'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                  {/* Voice metrics inline */}
                  {msg.role === 'user' && msg.audioMetrics && (
                    <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-primary-foreground/20 text-xs text-primary-foreground/70">
                      <span>⏱ {msg.audioMetrics.durationSeconds.toFixed(1)}s</span>
                      <span>🗣 {msg.audioMetrics.wpm} WPM</span>
                      {msg.audioMetrics.fillerWordCount > 0 && (
                        <span>💬 {msg.audioMetrics.fillerWordCount} fillers</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Audio playback in chat */}
                {msg.role === 'user' && msg.audioUrl && (
                  <audio
                    controls
                    src={msg.audioUrl}
                    className="w-full h-8 rounded"
                    style={{ colorScheme: 'dark' }}
                  />
                )}
              </div>

              {/* Evaluation panel (desktop: beside message) */}
              {msg.role === 'assistant' && msg.evaluation && (
                <div className="hidden md:block ml-2 mt-1">
                  <ScoreDisplay
                    correctness={msg.evaluation.correctness}
                    conceptUnderstanding={msg.evaluation.conceptUnderstanding}
                    communicationClarity={msg.evaluation.communicationClarity}
                    confidenceScore={msg.evaluation.confidenceScore}
                    clarity={msg.evaluation.clarity}
                    missingConcepts={msg.evaluation.missingConcepts}
                    reasoning={msg.evaluation.reasoning}
                  />
                </div>
              )}
            </div>
          ))}

          {/* Evaluation panels (mobile: stacked below) */}
          {messages.some(m => m.role === 'assistant' && m.evaluation) && (
            <div className="md:hidden mt-4 space-y-4">
              {messages
                .filter(m => m.role === 'assistant' && m.evaluation)
                .map(msg => (
                  <div key={msg.id}>
                    <ScoreDisplay
                      correctness={msg.evaluation!.correctness}
                      conceptUnderstanding={msg.evaluation!.conceptUnderstanding}
                      communicationClarity={msg.evaluation!.communicationClarity}
                      confidenceScore={msg.evaluation!.confidenceScore}
                      clarity={msg.evaluation!.clarity}
                      missingConcepts={msg.evaluation!.missingConcepts}
                      reasoning={msg.evaluation!.reasoning}
                    />
                  </div>
                ))}
            </div>
          )}

          {isLoading && <TypingIndicator />}
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
