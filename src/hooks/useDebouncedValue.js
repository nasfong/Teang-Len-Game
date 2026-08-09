import { useEffect, useState } from 'react'

// Trailing-edge debounce for a value that drives a request (a search box). Callers
// usually want both: the raw value for the input, the debounced one as the query key.
// Comparing the two is also how a screen knows a request is about to fire.
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])

  return debounced
}
