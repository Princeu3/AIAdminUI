'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useSessionStore } from '@/stores/session';
import { usePermissionStore, type ToolType, type PermissionScope } from '@/stores/permissions';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'error' | 'command_result';
  content: string;
  timestamp: Date;
  data?: Record<string, unknown>;
  toolUses?: ToolUseInfo[];
}

interface ToolUseInfo {
  id: string;
  name: string;
  status: 'running' | 'completed';
}

interface CommandResult {
  command: string;
  success: boolean;
  content: string;
  data?: Record<string, unknown>;
}

/**
 * Map tool names from Claude CLI to our ToolType enum
 */
function mapToolName(name: string): ToolType {
  const mapping: Record<string, ToolType> = {
    read: 'read',
    Read: 'read',
    write: 'write',
    Write: 'write',
    edit: 'write',
    Edit: 'write',
    bash: 'bash',
    Bash: 'bash',
    browser: 'browser',
    Browser: 'browser',
    WebFetch: 'browser',
    WebSearch: 'browser',
  };
  return mapping[name] || 'mcp';
}

export function useWebSocket(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const streamingContentRef = useRef<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [workingDir, setWorkingDir] = useState<string>('');
  const [activeToolUses, setActiveToolUses] = useState<ToolUseInfo[]>([]);

  const { setConnectionStatus } = useSessionStore();
  const { addRequest, addToolUse, updateToolUse } = usePermissionStore();

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

          case 'command_result':
            addMessage({
              type: 'command_result',
              content: data.content,
              data: data.data,
            });
            break;

          case 'command_error':
            addMessage({
              type: 'error',
              content: `Command error: ${data.error}`,
            });
            break;

          case 'text_delta':
            // Streaming text chunk - append to streaming content
            streamingContentRef.current += data.content || '';
            break;

          case 'tool_use':
            // Tool use status update
            {
              const toolInfo: ToolUseInfo = {
                id: data.tool_id,
                name: data.tool_name,
                status: data.status,
              };

              if (data.status === 'running') {
                setActiveToolUses((prev) => [...prev, toolInfo]);
                // Add to tool use store
                addToolUse({
                  id: data.tool_id,
                  tool: mapToolName(data.tool_name),
                  status: 'running',
                  description: `Running ${data.tool_name}`,
                });
              } else if (data.status === 'completed') {
                setActiveToolUses((prev) =>
                  prev.map((t) =>
                    t.id === data.tool_id ? { ...t, status: 'completed' } : t
                  )
                );
                updateToolUse(data.tool_id, { status: 'completed' });
              }
            }
            break;

          case 'permission_request':
            // Permission request from backend
            addRequest({
              id: data.request_id,
              tool: mapToolName(data.tool),
              path: data.path,
              command: data.command,
              description: data.description,
              timestamp: new Date(),
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

  const sendMessage = useCallback((content: string, mode: 'normal' | 'plan' = 'normal') => {
    if (!content.trim()) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Add user message to UI immediately
      addMessage({
        type: 'user',
        content: content.trim(),
      });

      // Send to server with mode
      wsRef.current.send(
        JSON.stringify({
          type: 'message',
          content: content.trim(),
          mode,
        })
      );
    }
  }, [addMessage]);

  const sendCommand = useCallback((command: string, args: string[] = []) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Add system message showing command was executed
      addMessage({
        type: 'system',
        content: `Running /${command}...`,
      });

      wsRef.current.send(
        JSON.stringify({
          type: 'command',
          command,
          args,
        })
      );
    }
  }, [addMessage]);

  const sendPermissionResponse = useCallback(
    (requestId: string, allowed: boolean, scope: PermissionScope) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'permission_response',
            request_id: requestId,
            allowed,
            scope,
          })
        );
      }
    },
    []
  );

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
    activeToolUses,
    sendMessage,
    sendCommand,
    sendPermissionResponse,
    connect,
    disconnect,
    clearMessages: () => {
      setMessages([]);
      setActiveToolUses([]);
      streamingContentRef.current = '';
    },
  };
}
