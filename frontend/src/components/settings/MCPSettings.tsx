'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Puzzle,
  Plus,
  Trash2,
  Power,
  PowerOff,
  Terminal,
  Globe,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface MCPServer {
  name: string;
  type: 'stdio' | 'sse';
  command?: string[];
  url?: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
  created_at: string;
}

interface MCPPreset {
  name: string;
  description: string;
  type: string;
  command: string[];
  args?: string[];
  env_required?: string[];
  args_required?: string[];
}

export function MCPSettings() {
  const { user } = useAuthStore();
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [presets, setPresets] = useState<MCPPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Form state
  const [newServer, setNewServer] = useState({
    name: '',
    type: 'stdio' as 'stdio' | 'sse',
    command: '',
    url: '',
    env: {} as Record<string, string>,
  });

  useEffect(() => {
    if (user) {
      fetchServers();
      fetchPresets();
    }
  }, [user]);

  const fetchServers = async () => {
    if (!user) return;
    try {
      const response = await fetch(`${API_URL}/api/mcp/servers?user_id=${user.id}`);
      const data = await response.json();
      setServers(data.servers || []);
    } catch (e) {
      setError('Failed to fetch MCP servers');
    } finally {
      setLoading(false);
    }
  };

  const fetchPresets = async () => {
    try {
      const response = await fetch(`${API_URL}/api/mcp/presets`);
      const data = await response.json();
      setPresets(data.presets || []);
    } catch (e) {
      console.error('Failed to fetch presets:', e);
    }
  };

  const addServer = async () => {
    if (!user) return;

    const serverData = {
      name: newServer.name,
      type: newServer.type,
      command: newServer.type === 'stdio' ? newServer.command.split(' ') : undefined,
      url: newServer.type === 'sse' ? newServer.url : undefined,
      env: Object.keys(newServer.env).length > 0 ? newServer.env : undefined,
    };

    try {
      const response = await fetch(`${API_URL}/api/mcp/servers?user_id=${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to add server');
      }

      await fetchServers();
      setAddDialogOpen(false);
      setNewServer({ name: '', type: 'stdio', command: '', url: '', env: {} });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add server');
    }
  };

  const addPreset = async (preset: MCPPreset) => {
    if (!user) return;

    const serverData = {
      name: preset.name,
      type: preset.type,
      command: preset.command,
    };

    try {
      const response = await fetch(`${API_URL}/api/mcp/servers?user_id=${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to add preset');
      }

      await fetchServers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add preset');
    }
  };

  const removeServer = async (name: string) => {
    if (!user) return;

    try {
      const response = await fetch(
        `${API_URL}/api/mcp/servers/${name}?user_id=${user.id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Failed to remove server');
      await fetchServers();
    } catch (e) {
      setError('Failed to remove server');
    }
  };

  const toggleServer = async (name: string, enabled: boolean) => {
    if (!user) return;

    try {
      const response = await fetch(
        `${API_URL}/api/mcp/servers/${name}/toggle?user_id=${user.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        }
      );

      if (!response.ok) throw new Error('Failed to toggle server');
      await fetchServers();
    } catch (e) {
      setError('Failed to toggle server');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Puzzle className="h-6 w-6 text-purple-500" />
            <div>
              <CardTitle className="text-lg">MCP Servers</CardTitle>
              <CardDescription>
                Model Context Protocol servers for extended capabilities
              </CardDescription>
            </div>
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Server
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add MCP Server</DialogTitle>
                <DialogDescription>
                  Configure a new MCP server connection
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={newServer.name}
                    onChange={(e) =>
                      setNewServer({ ...newServer, name: e.target.value })
                    }
                    placeholder="my-server"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      variant={newServer.type === 'stdio' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() =>
                        setNewServer({ ...newServer, type: 'stdio' })
                      }
                    >
                      <Terminal className="h-4 w-4 mr-2" />
                      stdio
                    </Button>
                    <Button
                      variant={newServer.type === 'sse' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setNewServer({ ...newServer, type: 'sse' })}
                    >
                      <Globe className="h-4 w-4 mr-2" />
                      SSE
                    </Button>
                  </div>
                </div>
                {newServer.type === 'stdio' ? (
                  <div>
                    <label className="text-sm font-medium">Command</label>
                    <Input
                      value={newServer.command}
                      onChange={(e) =>
                        setNewServer({ ...newServer, command: e.target.value })
                      }
                      placeholder="npx -y @modelcontextprotocol/server-filesystem"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-sm font-medium">URL</label>
                    <Input
                      value={newServer.url}
                      onChange={(e) =>
                        setNewServer({ ...newServer, url: e.target.value })
                      }
                      placeholder="http://localhost:3001/sse"
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={addServer} disabled={!newServer.name}>
                  Add Server
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Connected Servers */}
        {servers.length > 0 ? (
          <div className="space-y-3 mb-6">
            <h4 className="text-sm font-medium text-gray-700">Connected Servers</h4>
            {servers.map((server) => (
              <div
                key={server.name}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border',
                  server.enabled
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                )}
              >
                <div className="flex items-center gap-3">
                  {server.type === 'stdio' ? (
                    <Terminal className="h-4 w-4 text-gray-500" />
                  ) : (
                    <Globe className="h-4 w-4 text-gray-500" />
                  )}
                  <div>
                    <div className="font-medium text-sm">{server.name}</div>
                    <div className="text-xs text-gray-500">
                      {server.type === 'stdio'
                        ? server.command?.join(' ')
                        : server.url}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      server.enabled
                        ? 'bg-green-100 text-green-700 border-green-300'
                        : 'bg-gray-100 text-gray-500 border-gray-300'
                    }
                  >
                    {server.enabled ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </>
                    ) : (
                      'Disabled'
                    )}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleServer(server.name, !server.enabled)}
                    title={server.enabled ? 'Disable' : 'Enable'}
                  >
                    {server.enabled ? (
                      <PowerOff className="h-4 w-4" />
                    ) : (
                      <Power className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeServer(server.name)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500 mb-6">
            <Puzzle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No MCP servers configured</p>
            <p className="text-xs">Add a server or use a preset below</p>
          </div>
        )}

        {/* Presets */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Available Presets</h4>
          <div className="grid gap-2">
            {presets.map((preset) => {
              const isAdded = servers.some((s) => s.name === preset.name);
              return (
                <div
                  key={preset.name}
                  className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-gray-50"
                >
                  <div>
                    <div className="font-medium text-sm">{preset.name}</div>
                    <div className="text-xs text-gray-500">{preset.description}</div>
                  </div>
                  <Button
                    size="sm"
                    variant={isAdded ? 'outline' : 'default'}
                    onClick={() => !isAdded && addPreset(preset)}
                    disabled={isAdded}
                  >
                    {isAdded ? 'Added' : 'Add'}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
