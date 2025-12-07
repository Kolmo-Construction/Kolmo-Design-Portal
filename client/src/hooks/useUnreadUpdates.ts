import { useQuery } from '@tanstack/react-query';

export function useUnreadUpdates(projectId?: number) {
  return useQuery({
    queryKey: ['/api/projects', projectId, 'updates', 'unread-count'],
    queryFn: async () => {
      if (!projectId) return { unreadCount: 0 };

      const res = await fetch(`/api/projects/${projectId}/updates/unread-count`, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to fetch unread count');
      }

      return res.json();
    },
    enabled: !!projectId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
