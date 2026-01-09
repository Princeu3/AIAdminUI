'use client';

import { useAuthStore } from '@/stores/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Github, Sparkles, CheckCircle, Info } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuthStore();

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-500">Manage your account</p>
      </div>

      {/* GitHub Account */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Github className="h-6 w-6" />
              <div>
                <CardTitle className="text-lg">GitHub Account</CardTitle>
                <CardDescription>Your GitHub account for repository access</CardDescription>
              </div>
            </div>
            <Badge variant="default" className="bg-green-100 text-green-700">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user.github_avatar_url || undefined} />
              <AvatarFallback>{user.github_username[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{user.github_username}</p>
              {user.github_email && (
                <p className="text-sm text-gray-500">{user.github_email}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Claude Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-orange-500" />
              <div>
                <CardTitle className="text-lg">Claude Code</CardTitle>
                <CardDescription>
                  AI-powered code assistance
                </CardDescription>
              </div>
            </div>
            <Badge variant="default" className="bg-green-100 text-green-700">
              <CheckCircle className="h-3 w-3 mr-1" />
              Ready
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex gap-3">
            <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-800">
                Claude Code is configured on the server and ready to use.
                Your AI sessions use the server's Claude Max subscription.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Section */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-2">How It Works</h3>
        <ul className="text-sm text-gray-600 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-orange-500">1.</span>
            <span>
              Select a repository from your connected GitHub repos
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-orange-500">2.</span>
            <span>
              Start a session to chat with Claude about your code
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-orange-500">3.</span>
            <span>
              Claude will help you make changes, create PRs, and more
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
