// client/src/lib/queryClient.ts
import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorBody = res.statusText; // Default to status text
    try {
      // Attempt to read the response body as text for more detail
      const text = await res.text();
      if (text) {
        // Try to parse as JSON for structured errors, otherwise use raw text
        try {
            const jsonError = JSON.parse(text);
            errorBody = jsonError.message || JSON.stringify(jsonError);
        } catch {
            errorBody = text.substring(0, 200) + (text.length > 200 ? '...' : ''); // Limit length
        }
      }
    } catch (e) {
      // Ignore error reading body, stick with status text
      console.error("Error reading error response body:", e);
    }
    // Throw a more informative error
    throw new Error(`HTTP Error ${res.status}: ${errorBody}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<any> {
  // Check if data is FormData (for file uploads)
  const isFormData = data instanceof FormData;

  console.log(`[apiRequest] ${method} ${url}`, isFormData ? 'FormData' : (data ? JSON.stringify(data) : 'no body'));

  const res = await fetch(url, {
    method,
    // Don't set Content-Type for FormData - browser will set it with boundary
    headers: (data && !isFormData) ? { "Content-Type": "application/json" } : {},
    // Don't stringify FormData - send it as-is
    body: data ? (isFormData ? data as FormData : JSON.stringify(data)) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);

  // Parse JSON response if it exists
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const result = await res.json();
    console.log(`[apiRequest] Response:`, result);
    return result;
  }

  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      console.log(`[getQueryFn] Returning null due to 401 for queryKey: ${queryKey[0]}`);
      return null;
    }

    // Use the modified error throwing function
    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }), // Keep original behavior unless 401 needs special handling
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 5 * 60 * 1000, // 5 minutes default
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
      retry: false,
      networkMode: 'online',
    },
    mutations: {
      retry: false,
    },
  },
});