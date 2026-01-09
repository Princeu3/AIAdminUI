'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { useRepositoryStore } from '@/stores/repository';
import { reposApi, sessionsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Plus, FolderGit2, Play, Trash2, RefreshCw, Lock, Globe, Search } from 'lucide-react';

interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  description: string | null;
  clone_url: string;
  default_branch: string;
  private: boolean;
  updated_at: string;
}

export default function ReposPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { connectedRepos, setConnectedRepos, setSelectedRepo } = useRepositoryStore();

  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadConnectedRepos();
    }
  }, [user]);

  const loadConnectedRepos = async () => {
    if (!user) return;
    try {
      const { repos } = await reposApi.listConnectedRepos(user.id);
      setConnectedRepos(repos);
    } catch (error) {
      console.error('Failed to load connected repos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGitHubRepos = async () => {
    if (!user) return;
    try {
      const { repos } = await reposApi.listGitHubRepos(user.id);
      setGithubRepos(repos);
    } catch (error) {
      console.error('Failed to load GitHub repos:', error);
    }
  };

  const handleConnect = async (repo: GitHubRepo) => {
    if (!user) return;
    setConnectingId(repo.id);
    try {
      const result = await reposApi.connectRepo(user.id, {
        github_repo_id: repo.id,
        full_name: repo.full_name,
        clone_url: repo.clone_url,
        default_branch: repo.default_branch,
      });
      await loadConnectedRepos();
      setDialogOpen(false);
    } catch (error) {
      console.error('Failed to connect repo:', error);
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async (repoId: string) => {
    if (!user) return;
    try {
      await reposApi.disconnectRepo(user.id, repoId);
      await loadConnectedRepos();
    } catch (error) {
      console.error('Failed to disconnect repo:', error);
    }
  };

  const handleStartSession = async (repo: typeof connectedRepos[0]) => {
    if (!user) return;

    try {
      setSelectedRepo(repo);
      const session = await sessionsApi.create(user.id, repo.id);
      router.push(`/session/${session.session_id}`);
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  };

  const filteredGithubRepos = githubRepos.filter((repo) =>
    repo.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Repositories</h1>
          <p className="text-gray-500">Connect and manage your repositories</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={loadGitHubRepos}>
              <Plus className="h-4 w-4 mr-2" />
              Connect Repository
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Connect a Repository</DialogTitle>
              <DialogDescription>
                Select a GitHub repository to connect
              </DialogDescription>
            </DialogHeader>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search repositories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <ScrollArea className="h-96">
              <div className="space-y-2">
                {filteredGithubRepos.map((repo) => {
                  const isConnected = connectedRepos.some(
                    (r) => r.github_repo_id === repo.id
                  );

                  return (
                    <div
                      key={repo.id}
                      className="grid grid-cols-[1fr_auto] items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        {repo.private ? (
                          <Lock className="h-4 w-4 text-gray-400 shrink-0" />
                        ) : (
                          <Globe className="h-4 w-4 text-gray-400 shrink-0" />
                        )}
                        <div className="overflow-hidden">
                          <p className="font-medium truncate">{repo.full_name}</p>
                          {repo.description && (
                            <p className="text-sm text-gray-500 truncate">
                              {repo.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant={isConnected ? 'outline' : 'default'}
                        disabled={isConnected || connectingId === repo.id}
                        onClick={() => handleConnect(repo)}
                      >
                        {connectingId === repo.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : isConnected ? (
                          'Connected'
                        ) : (
                          'Connect'
                        )}
                      </Button>
                    </div>
                  );
                })}

                {filteredGithubRepos.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    No repositories found
                  </p>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      {/* Connected Repos */}
      {connectedRepos.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <FolderGit2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No repositories connected</h3>
            <p className="text-gray-500 mb-4">
              Connect a GitHub repository to start making changes with AI
            </p>
            <Button onClick={() => { loadGitHubRepos(); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Connect Repository
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {connectedRepos.map((repo) => (
            <Card key={repo.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{repo.full_name}</CardTitle>
                    <CardDescription>
                      Branch: {repo.default_branch}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">Connected</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => handleStartSession(repo)}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start Session
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDisconnect(repo.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
