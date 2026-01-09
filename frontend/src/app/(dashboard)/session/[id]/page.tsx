'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { useRepositoryStore } from '@/stores/repository';
import { useSessionStore } from '@/stores/session';
import { useModeStore } from '@/stores/mode';
import { useWebSocket } from '@/hooks/useWebSocket';
import { sessionsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { SlashCommandMenu } from '@/components/chat/SlashCommandMenu';
import { CommandPalette, useCommandPaletteShortcut } from '@/components/chat/CommandPalette';
import { ModeIndicator } from '@/components/chat/ModeIndicator';
import { PlanPanel } from '@/components/chat/PlanPanel';
import { PermissionDialog, usePermissionDialog } from '@/components/chat/PermissionDialog';
import { ToolUseList } from '@/components/chat/ToolUseDisplay';
import { usePermissionStore } from '@/stores/permissions';
import {
  isSlashCommandInput,
  getCommandPrefix,
  parseSlashCommand,
  findCommand,
  generateHelpText,
  type SlashCommand,
} from '@/lib/commands';
import {
  Send,
  Square,
  FolderGit2,
  Wifi,
  WifiOff,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Terminal,
  Command,
} from 'lucide-react';
import Link from 'next/link';

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const { user } = useAuthStore();
  const { selectedRepo } = useRepositoryStore();
  const { connectionStatus } = useSessionStore();
  const { mode, toggleMode } = useModeStore();

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isTyping,
    workingDir,
    activeToolUses,
    sendMessage,
    sendCommand,
    sendPermissionResponse,
    clearMessages,
  } = useWebSocket(sessionId);

  // Permission dialog hook
  const { currentRequest, handleRespond, hasPendingRequests } = usePermissionDialog();
  const { toolUses } = usePermissionStore();

  // Handle permission response - update local store and send to backend
  const onPermissionRespond = useCallback(
    (requestId: string, allowed: boolean, scope: 'once' | 'session' | 'always') => {
      handleRespond(requestId, allowed, scope);
      sendPermissionResponse(requestId, allowed, scope);
    },
    [handleRespond, sendPermissionResponse]
  );

  // Command palette keyboard shortcut
  useCommandPaletteShortcut(
    () => setCommandPaletteOpen(true),
    connectionStatus === 'connected'
  );

  // Plan mode toggle shortcut (Shift+Tab like Claude Code)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        toggleMode();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleMode]);

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

  // Execute a command (either from menu or parsed from input)
  const executeCommand = useCallback((command: SlashCommand, args: string[] = []) => {
    setShowSlashMenu(false);
    setInputValue('');

    if (command.handler === 'frontend') {
      // Handle frontend commands locally
      switch (command.name) {
        case 'help':
          // Add help text as system message by sending to chat
          sendMessage(generateHelpText());
          break;
        case 'clear':
          clearMessages();
          break;
        case 'plan':
          toggleMode();
          break;
        case 'settings':
          router.push('/settings');
          break;
        default:
          sendMessage(`Unknown frontend command: /${command.name}`);
      }
    } else {
      // Send to backend
      sendCommand(command.name, args);
    }

    inputRef.current?.focus();
  }, [sendMessage, sendCommand, clearMessages, router]);

  // Handle selecting a command from the menu
  const handleSelectCommand = useCallback((command: SlashCommand) => {
    executeCommand(command);
  }, [executeCommand]);

  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return;

    // Check if input is a slash command
    const parsed = parseSlashCommand(inputValue);
    if (parsed) {
      const command = findCommand(parsed.command);
      if (command) {
        executeCommand(command, parsed.args);
        return;
      }
      // Unknown command - send as regular message
    }

    // Send as regular message with current mode
    sendMessage(inputValue, mode);
    setInputValue('');
    setShowSlashMenu(false);
    inputRef.current?.focus();
  }, [inputValue, sendMessage, executeCommand, mode]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Show slash menu when typing /
    if (isSlashCommandInput(value)) {
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Close slash menu on escape
    if (e.key === 'Escape' && showSlashMenu) {
      setShowSlashMenu(false);
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

          <div className="flex items-center gap-3">
            <ModeIndicator />
            <Separator orientation="vertical" className="h-6" />
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
      <div className="flex-1 flex min-h-0">
        {/* Messages */}
        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="container mx-auto max-w-3xl space-y-4 p-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {/* Active Tool Uses */}
            {activeToolUses.length > 0 && (
              <div className="flex justify-start">
                <div className="max-w-[80%]">
                  <ToolUseList toolUses={toolUses.filter(t => activeToolUses.some(a => a.id === t.id))} />
                </div>
              </div>
            )}

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
            <div className="relative flex gap-2">
              {/* Slash Command Menu */}
              {showSlashMenu && (
                <SlashCommandMenu
                  prefix={getCommandPrefix(inputValue) || ''}
                  onSelect={handleSelectCommand}
                  onClose={() => setShowSlashMenu(false)}
                />
              )}

              <Input
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask Claude or type / for commands..."
                className="flex-1"
                disabled={connectionStatus !== 'connected' || isTyping}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCommandPaletteOpen(true)}
                disabled={connectionStatus !== 'connected'}
                title="Command Palette (Cmd+K)"
              >
                <Command className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || connectionStatus !== 'connected' || isTyping}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Enter to send | / for commands | <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-600">Cmd+K</kbd> palette | <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-600">Shift+Tab</kbd> plan mode
            </p>
          </div>
        </div>
        </div>

        {/* Plan Panel (shown in plan mode) */}
        <PlanPanel />
      </div>

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onSelectCommand={handleSelectCommand}
      />

      {/* Permission Dialog */}
      <PermissionDialog
        request={currentRequest}
        onRespond={onPermissionRespond}
      />
    </div>
  );
}

interface MessageProps {
  message: {
    id: string;
    type: 'user' | 'assistant' | 'system' | 'error' | 'command_result';
    content: string;
    timestamp: Date;
    data?: Record<string, unknown>;
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

  if (message.type === 'command_result') {
    return (
      <div className="flex justify-start">
        <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-lg p-4 max-w-[80%]">
          <div className="flex items-start gap-2">
            <Terminal className="h-5 w-5 flex-shrink-0 mt-0.5 text-blue-500" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-blue-700 text-sm">Command Result</p>
              <pre className="text-sm mt-2 whitespace-pre-wrap font-mono bg-blue-100 p-2 rounded overflow-x-auto">
                {message.content}
              </pre>
            </div>
          </div>
          <div className="text-xs mt-2 text-blue-400">
            {message.timestamp.toLocaleTimeString()}
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
