'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Github, Code2, GitBranch, Eye } from 'lucide-react';

function LandingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(errorParam === 'auth_failed' ? 'Authentication failed. Please try again.' : 'An error occurred.');
    }
  }, [searchParams]);

  useEffect(() => {
    if (isAuthenticated && user) {
      router.push('/repos');
    }
  }, [isAuthenticated, user, router]);

  const handleGitHubLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { auth_url } = await authApi.initiateGitHubLogin();
      window.location.href = auth_url;
    } catch (err) {
      setError('Failed to initiate login. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-orange-500" />
          <span className="text-xl font-bold">AI Admin UI</span>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold tracking-tight mb-6">
            Update Your Website with{' '}
            <span className="text-orange-500">Natural Language</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto">
            Connect your GitHub repository and make changes to your marketing site
            through simple chat commands. No coding required.
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
              {error}
            </div>
          )}

          <Button
            size="lg"
            onClick={handleGitHubLogin}
            disabled={loading}
            className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-6 text-lg"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
            ) : (
              <Github className="h-5 w-5 mr-2" />
            )}
            Continue with GitHub
          </Button>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mt-24 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <Code2 className="h-10 w-10 text-orange-500 mb-2" />
              <CardTitle>AI-Powered Changes</CardTitle>
              <CardDescription>
                Describe what you want to change in plain English.
                Claude Code makes the edits for you.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <GitBranch className="h-10 w-10 text-orange-500 mb-2" />
              <CardTitle>Automatic PRs</CardTitle>
              <CardDescription>
                Changes are committed to a new branch and a pull request
                is created for your review.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Eye className="h-10 w-10 text-orange-500 mb-2" />
              <CardTitle>Live Previews</CardTitle>
              <CardDescription>
                See your changes on a Vercel preview URL before
                merging to production.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* How it works */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="font-semibold text-lg">Connect Your Accounts</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Sign in with GitHub and connect your Claude Pro/Max account for AI capabilities.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h3 className="font-semibold text-lg">Select Your Repository</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Choose which GitHub repository you want to manage from your connected repos.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h3 className="font-semibold text-lg">Chat to Make Changes</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Type what you want to change: "Update the hero text to say 'Build Faster'"
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">
                4
              </div>
              <div>
                <h3 className="font-semibold text-lg">Review & Merge</h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Review the changes in the preview, then merge when you're satisfied.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-20 border-t">
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <Sparkles className="h-4 w-4" />
          <span>Powered by Claude Code</span>
        </div>
      </footer>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      }
    >
      <LandingContent />
    </Suspense>
  );
}
