'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { useRepositoryStore } from '@/stores/repository';
import { useSessionStore } from '@/stores/session';
import { useWebSocket } from '@/hooks/useWebSocket';
import { sessionsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Send,
  Square,
  FolderGit2,
  Wifi,
  WifiOff,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const { user } = useAuthStore();
  const { selectedRepo } = useRepositoryStore();
  const { connectionStatus } = useSessionStore();

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, isTyping, workingDir, sendMessage } = useWebSocket(sessionId);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Verify session exists
  useEffect(() => {
    if (user && sessionId) {
      verifySession();
    }
  }, [user, sessionId]);

  const verifySession = async () => {
    if (!user) return;
    try {
      await sessionsApi.get(user.id, sessionId);
    } catch (error) {
      console.error('Session not found:', error);
      router.push('/repos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return;
    sendMessage(inputValue);
    setInputValue('');
    inputRef.current?.focus();
  }, [inputValue, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTerminate = async () => {
    if (!user || !sessionId) return;
    try {
      await sessionsApi.terminate(user.id, sessionId);
      router.push('/repos');
    } catch (error) {
      console.error('Failed to terminate session:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Session Header */}
      <div className="border-b bg-white px-4 py-3 shrink-0">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/repos">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <FolderGit2 className="h-4 w-4 text-gray-500" />
              <span className="font-medium">
                {selectedRepo?.full_name || workingDir}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Badge
              variant={connectionStatus === 'connected' ? 'default' : 'destructive'}
              className={
                connectionStatus === 'connected'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }
            >
              {connectionStatus === 'connected' ? (
                <>
                  <Wifi className="h-3 w-3 mr-1" />
                  Connected
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 mr-1" />
                  Disconnected
                </>
              )}
            </Badge>
            <Button variant="outline" size="sm" onClick={handleTerminate}>
              <Square className="h-4 w-4 mr-2" />
              End Session
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Messages */}
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="container mx-auto max-w-3xl space-y-4 p-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Claude is thinking...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t bg-white p-4 shrink-0">
          <div className="container mx-auto max-w-3xl">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Claude to make changes..."
                className="flex-1"
                disabled={connectionStatus !== 'connected' || isTyping}
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || connectionStatus !== 'connected' || isTyping}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Press Enter to send. Try: "Change the hero text to 'Build Faster'"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MessageProps {
  message: {
    id: string;
    type: 'user' | 'assistant' | 'system' | 'error';
    content: string;
    timestamp: Date;
  };
}

function MessageBubble({ message }: MessageProps) {
  if (message.type === 'system') {
    return (
      <div className="flex justify-center">
        <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-full text-sm">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.type === 'error') {
    return (
      <div className="flex justify-start">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 max-w-[80%]">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Error</p>
              <p className="text-sm mt-1">{message.content}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isUser = message.type === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg p-4 ${
          isUser
            ? 'bg-orange-500 text-white'
            : 'bg-gray-100 text-gray-900'
        }`}
      >
        <div className="whitespace-pre-wrap text-sm">
          {message.content}
        </div>
        <div
          className={`text-xs mt-2 ${
            isUser ? 'text-orange-200' : 'text-gray-400'
          }`}
        >
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
