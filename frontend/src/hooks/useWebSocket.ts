'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useSessionStore } from '@/stores/session';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  timestamp: Date;
}

export function useWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [workingDir, setWorkingDir] = useState<string>('');

  const { setConnectionStatus } = useSessionStore();

  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    setMessages((prev) => [
      ...prev,
      {
        ...message,
        id: Date.now().toString(),
        timestamp: new Date(),
      },
    ]);
  }, []);

  const connect = useCallback(() => {
    if (!sessionId) return;

    // Close any existing connection first
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Use the new chat endpoint
    const ws = new WebSocket(`${WS_URL}/ws/chat/${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'connected':
            // Initial connection info
            setWorkingDir(data.working_dir || '');
            addMessage({
              type: 'system',
              content: `Connected to ${data.working_dir}. Claude is ready to help.`,
            });
            break;

          case 'typing':
            setIsTyping(data.status);
            break;

          case 'response':
            addMessage({
              type: 'assistant',
              content: data.content,
            });
            break;

          case 'error':
            addMessage({
              type: 'error',
              content: data.content,
            });
            break;

          case 'pong':
            // Heartbeat response - ignore
            break;

          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      console.log('WebSocket disconnected');

      // Exponential backoff reconnection
      if (reconnectAttempts.current < 5) {
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
        setTimeout(connect, delay);
        reconnectAttempts.current++;
      }
    };

    ws.onerror = () => {
      // Browser WebSocket error events don't contain useful info
      // The actual error will trigger onclose, which handles reconnection
      setConnectionStatus('error');
    };
  }, [sessionId, setConnectionStatus, addMessage]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (!content.trim()) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Add user message to UI immediately
      addMessage({
        type: 'user',
        content: content.trim(),
      });

      // Send to server
      wsRef.current.send(
        JSON.stringify({
          type: 'message',
          content: content.trim(),
        })
      );
    }
  }, [addMessage]);

  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    // Small delay to handle React Strict Mode double-mounting
    const timeoutId = setTimeout(() => {
      connect();
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      disconnect();
    };
  }, [sessionId, connect, disconnect]);

  // Periodic ping to keep connection alive
  useEffect(() => {
    const interval = setInterval(sendPing, 30000);
    return () => clearInterval(interval);
  }, [sendPing]);

  return {
    messages,
    isTyping,
    workingDir,
    sendMessage,
    connect,
    disconnect,
    clearMessages: () => setMessages([]),
  };
}
