import {
  HelpCircle,
  Trash2,
  FileText,
  Info,
  FolderGit2,
  Minimize2,
  DollarSign,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export type CommandHandler = 'frontend' | 'backend';

export interface SlashCommand {
  name: string;
  description: string;
  shortcut?: string;
  handler: CommandHandler;
  icon: LucideIcon;
  keywords?: string[]; // Additional search terms
}

export const commands: SlashCommand[] = [
  {
    name: 'help',
    description: 'Show available commands',
    handler: 'frontend',
    icon: HelpCircle,
    keywords: ['commands', 'list', '?'],
  },
  {
    name: 'clear',
    description: 'Clear chat history',
    handler: 'frontend',
    icon: Trash2,
    keywords: ['reset', 'clean'],
  },
  {
    name: 'plan',
    description: 'Toggle plan mode',
    handler: 'frontend',
    icon: FileText,
    keywords: ['planning', 'mode'],
  },
  {
    name: 'status',
    description: 'Show session status',
    handler: 'backend',
    icon: Info,
    keywords: ['info', 'session'],
  },
  {
    name: 'files',
    description: 'List modified files',
    handler: 'backend',
    icon: FolderGit2,
    keywords: ['git', 'changes', 'modified'],
  },
  {
    name: 'compact',
    description: 'Compact conversation context',
    handler: 'backend',
    icon: Minimize2,
    keywords: ['compress', 'summarize'],
  },
  {
    name: 'cost',
    description: 'Show session cost',
    handler: 'backend',
    icon: DollarSign,
    keywords: ['tokens', 'usage', 'price'],
  },
  {
    name: 'settings',
    description: 'Open settings',
    handler: 'frontend',
    icon: Settings,
    keywords: ['preferences', 'config'],
  },
];

export interface ParsedCommand {
  command: string;
  args: string[];
}

/**
 * Parse a slash command from input text
 * @param input - The input text (e.g., "/help" or "/status arg1 arg2")
 * @returns ParsedCommand if valid slash command, null otherwise
 */
export function parseSlashCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  const parts = trimmed.slice(1).split(/\s+/);
  const command = parts[0]?.toLowerCase();
  const args = parts.slice(1);

  if (!command) return null;

  return { command, args };
}

/**
 * Get commands matching a prefix (for autocomplete)
 * @param prefix - The prefix to match (without the leading "/")
 * @returns Array of matching commands
 */
export function getMatchingCommands(prefix: string): SlashCommand[] {
  const lower = prefix.toLowerCase();

  if (!lower) return commands;

  return commands.filter((cmd) => {
    // Match by name
    if (cmd.name.startsWith(lower)) return true;
    // Match by keywords
    if (cmd.keywords?.some((kw) => kw.startsWith(lower))) return true;
    return false;
  });
}

/**
 * Find a command by exact name
 * @param name - Command name
 * @returns The command or undefined
 */
export function findCommand(name: string): SlashCommand | undefined {
  return commands.find((cmd) => cmd.name === name.toLowerCase());
}

/**
 * Check if input is a potential slash command (starts with /)
 * @param input - The input text
 * @returns true if input starts with /
 */
export function isSlashCommandInput(input: string): boolean {
  return input.trimStart().startsWith('/');
}

/**
 * Get the command prefix being typed (everything after / up to the cursor or space)
 * @param input - The input text
 * @returns The prefix or null if not typing a command
 */
export function getCommandPrefix(input: string): string | null {
  const trimmed = input.trimStart();
  if (!trimmed.startsWith('/')) return null;

  // Get everything after the / up to the first space (or end)
  const afterSlash = trimmed.slice(1);
  const spaceIndex = afterSlash.indexOf(' ');

  return spaceIndex === -1 ? afterSlash : afterSlash.slice(0, spaceIndex);
}

/**
 * Format command for display in help
 */
export function formatCommandHelp(cmd: SlashCommand): string {
  return `/${cmd.name} - ${cmd.description}`;
}

/**
 * Generate help text for all commands
 */
export function generateHelpText(): string {
  const lines = ['Available commands:', ''];

  for (const cmd of commands) {
    lines.push(`  /${cmd.name} - ${cmd.description}`);
  }

  lines.push('');
  lines.push('Tip: Press Cmd/Ctrl+K to open the command palette');

  return lines.join('\n');
}
