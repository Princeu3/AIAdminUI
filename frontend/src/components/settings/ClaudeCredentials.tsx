'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Key,
  Upload,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileJson
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface CredentialStatus {
  has_credentials: boolean;
  created_at?: string;
  updated_at?: string;
}

export function ClaudeCredentials() {
  const { user } = useAuthStore();
  const [status, setStatus] = useState<CredentialStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchStatus();
    }
  }, [user]);

  const fetchStatus = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/credentials/claude?user_id=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch credential status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.name.endsWith('.json')) {
      setError('Please select a .json file');
      return;
    }

    // Validate file content
    try {
      const content = await file.text();
      JSON.parse(content); // Validate JSON
    } catch {
      setError('Invalid JSON file');
      return;
    }

    setError(null);
    setSuccess(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/credentials/claude?user_id=${user.id}`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setSuccess('Credentials uploaded successfully');
        fetchStatus();
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to upload credentials');
      }
    } catch (err) {
      setError('Failed to upload credentials');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async () => {
    if (!user) return;

    setError(null);
    setSuccess(null);
    setDeleting(true);

    try {
      const response = await fetch(`${API_URL}/api/credentials/claude?user_id=${user.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSuccess('Credentials deleted successfully');
        setStatus({ has_credentials: false });
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to delete credentials');
      }
    } catch (err) {
      setError('Failed to delete credentials');
    } finally {
      setDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Key className="h-6 w-6 text-orange-500" />
            <div>
              <CardTitle className="text-lg">Claude Credentials</CardTitle>
              <CardDescription>
                Bring your own Claude API credentials
              </CardDescription>
            </div>
          </div>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          ) : status?.has_credentials ? (
            <Badge variant="default" className="bg-green-100 text-green-700">
              <CheckCircle className="h-3 w-3 mr-1" />
              Configured
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-gray-100 text-gray-600">
              Not Set
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {/* Credential Info */}
        {status?.has_credentials && status.created_at && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              Credentials added: {new Date(status.created_at).toLocaleDateString()}
              {status.updated_at && status.updated_at !== status.created_at && (
                <span className="ml-2">
                  (Updated: {new Date(status.updated_at).toLocaleDateString()})
                </span>
              )}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />

          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-1"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                {status?.has_credentials ? 'Update Credentials' : 'Upload credentials.json'}
              </>
            )}
          </Button>

          {status?.has_credentials && (
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {/* Help Text */}
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="flex gap-3">
            <FileJson className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 space-y-2">
              <p className="font-medium">How to get your credentials.json:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700">
                <li>Run <code className="bg-blue-100 px-1 rounded">claude login</code> in your terminal</li>
                <li>Complete the authentication flow</li>
                <li>Find your credentials at <code className="bg-blue-100 px-1 rounded">~/.claude/.credentials.json</code></li>
                <li>Upload the file here</li>
              </ol>
              <p className="text-blue-600 mt-2">
                Your credentials are encrypted and stored securely. They will be used for your AI sessions instead of the server default.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
