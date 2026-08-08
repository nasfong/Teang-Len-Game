import { useEffect, useState } from 'react'

// Trailing-edge debounce for a value that drives a request — a search box, mainly.
// 300ms is the usual sweet spot: long enough to coalesce typing, short enough to
// still feel instant.
//
// Callers usually want BOTH values: the raw one to keep the input responsive, and
// the debounced one as the query key. Comparing them is also how a screen knows a
// request is *about* to fire, so the spinner can show the moment you type rather
// than waiting for the request to actually go out.
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])

  return debounced
}
