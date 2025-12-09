import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Clock,
  Smartphone,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

interface ApiKey {
  id: number;
  keyPrefix: string;
  name: string;
  description?: string;
  isActive: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

export default function ApiKeyManagement() {
  const queryClient = useQueryClient();
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [newKeyData, setNewKeyData] = useState<{
    key: string;
    name: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Form state
  const [keyName, setKeyName] = useState('');
  const [keyDescription, setKeyDescription] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('365');

  // Fetch API keys
  const { data: apiKeys, isLoading } = useQuery<ApiKey[]>({
    queryKey: ['/api/api-keys'],
    queryFn: getQueryFn({ on4xx: 'throw' }),
  });

  // Generate new API key
  const generateKeyMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; expiresInDays?: number }) => {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to generate API key');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/api-keys'] });
      setNewKeyData({
        key: data.fullKey,
        name: data.name,
      });
      setShowNewKeyDialog(false);
      // Reset form
      setKeyName('');
      setKeyDescription('');
      setExpiresInDays('365');
    },
  });

  // Revoke API key
  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: number) => {
      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to revoke API key');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/api-keys'] });
    },
  });

  const handleGenerateKey = () => {
    if (!keyName.trim()) {
      alert('Please enter a name for the API key');
      return;
    }

    generateKeyMutation.mutate({
      name: keyName,
      description: keyDescription || undefined,
      expiresInDays: expiresInDays ? parseInt(expiresInDays) : undefined,
    });
  };

  const handleCopyKey = () => {
    if (newKeyData?.key) {
      navigator.clipboard.writeText(newKeyData.key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleRevokeKey = (keyId: number, keyName: string) => {
    if (confirm(`Are you sure you want to revoke the API key "${keyName}"? This cannot be undone.`)) {
      revokeKeyMutation.mutate(keyId);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">API Key Management</h1>
          <p className="text-gray-600">
            Generate and manage API keys for mobile app access
          </p>
        </div>
        <Button onClick={() => setShowNewKeyDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Generate New Key
        </Button>
      </div>

      {/* Alert for security */}
      <Alert className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Security Notice</AlertTitle>
        <AlertDescription>
          API keys provide full access to your account. Keep them secure and never share them publicly.
          Keys are only shown once during creation.
        </AlertDescription>
      </Alert>

      {/* API Keys List */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Loading API keys...
          </CardContent>
        </Card>
      ) : apiKeys && apiKeys.length > 0 ? (
        <div className="grid gap-4">
          {apiKeys.map((apiKey) => (
            <Card key={apiKey.id}>
              <CardContent className="py-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="bg-blue-100 p-3 rounded-lg">
                      <Key className="h-6 w-6 text-blue-600" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold">{apiKey.name}</h3>
                        {apiKey.isActive ? (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>

                      {apiKey.description && (
                        <p className="text-sm text-gray-600 mb-2">{apiKey.description}</p>
                      )}

                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Smartphone className="h-3 w-3" />
                          <span className="font-mono">{apiKey.keyPrefix}...****</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Created {format(new Date(apiKey.createdAt), 'MMM d, yyyy')}
                        </div>

                        {apiKey.expiresAt && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Expires {format(new Date(apiKey.expiresAt), 'MMM d, yyyy')}
                          </div>
                        )}

                        {apiKey.lastUsedAt && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last used {format(new Date(apiKey.lastUsedAt), 'MMM d, yyyy')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRevokeKey(apiKey.id, apiKey.name)}
                    disabled={revokeKeyMutation.isPending}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Revoke
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No API Keys</h3>
            <p className="text-gray-600 mb-4">
              Generate your first API key to access the mobile API
            </p>
            <Button onClick={() => setShowNewKeyDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Generate API Key
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generate New Key Dialog */}
      <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate New API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for mobile app access. The full key will only be shown once.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="keyName">Key Name *</Label>
              <Input
                id="keyName"
                placeholder="e.g., Mobile App - iPhone"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="keyDescription">Description (Optional)</Label>
              <Input
                id="keyDescription"
                placeholder="e.g., Primary mobile device"
                value={keyDescription}
                onChange={(e) => setKeyDescription(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="expiresInDays">Expires In (Days)</Label>
              <Input
                id="expiresInDays"
                type="number"
                placeholder="365"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                className="mt-1"
              />
              <p className="text-sm text-gray-500 mt-1">
                Leave empty for no expiration
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setShowNewKeyDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerateKey}
              disabled={generateKeyMutation.isPending || !keyName.trim()}
            >
              {generateKeyMutation.isPending ? 'Generating...' : 'Generate Key'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Key Display Dialog */}
      <Dialog open={!!newKeyData} onOpenChange={() => setNewKeyData(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              API Key Generated
            </DialogTitle>
            <DialogDescription>
              Save this key now! You won't be able to see it again.
            </DialogDescription>
          </DialogHeader>

          {newKeyData && (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Important</AlertTitle>
                <AlertDescription>
                  This key will only be shown once. Copy it now and store it securely.
                </AlertDescription>
              </Alert>

              <div>
                <Label className="mb-2 block">Key Name</Label>
                <div className="text-lg font-semibold">{newKeyData.name}</div>
              </div>

              <div>
                <Label className="mb-2 block">API Key</Label>
                <div className="flex gap-2">
                  <Input
                    value={newKeyData.key}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    onClick={handleCopyKey}
                    variant="outline"
                    className="gap-2"
                  >
                    {copiedKey ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg text-sm">
                <p className="font-semibold mb-2">Usage Example:</p>
                <pre className="bg-white p-3 rounded border overflow-x-auto">
{`curl -H "Authorization: Bearer ${newKeyData.key}" \\
  http://localhost:3000/api/time/clock-in`}
                </pre>
              </div>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <Button onClick={() => setNewKeyData(null)}>
              I've Saved My Key
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
