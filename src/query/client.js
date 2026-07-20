import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { useAppError } from '../state/appError'

// One QueryClient for the app. Sensible defaults for a game lobby: don't hammer
// the server on every window focus, keep data fresh-ish for 30s, retry once — but
// never retry a 4xx (a 401/403/404 won't fix itself, and re-firing a 401 after the
// global auth guard has already logged us out is pointless).
const noRetryOn4xx = (failureCount, error) => {
  const status = error?.status
  if (typeof status === 'number' && status >= 400 && status < 500) return false
  return failureCount < 1
}

// Cache-level error hook — surfaces ONLY connection loss (ApiError status 0) and
// unexpected server faults (5xx) as the global modal. Business/auth errors (4xx)
// are shown inline by the screens that trigger them, so they're skipped here.
function reportConnectionFault(error) {
  const status = error?.status
  if (status === 0) {
    useAppError.getState().showError({ title: 'Connection lost', message: error.message })
  } else if (typeof status === 'number' && status >= 500) {
    useAppError.getState().showError({
      title: 'Something went wrong',
      message: 'The server ran into a problem. Please try again in a moment.',
    })
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: reportConnectionFault }),
  mutationCache: new MutationCache({ onError: reportConnectionFault }),
  defaultOptions: {
    queries: {
      retry: noRetryOn4xx,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})
