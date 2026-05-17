'use client'

import { useEffect } from 'react'

export function FetchSanitizer() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const originalFetch = window.fetch.bind(window)

    window.fetch = function patchedFetch(input, init) {
      if (init?.headers) {
        const safeHeaders: Record<string, string> = {}
        let entries: [string, string][] = []

        if (init.headers instanceof Headers) {
          init.headers.forEach((value, key) => entries.push([key, value]))
        } else if (Array.isArray(init.headers)) {
          entries = init.headers as [string, string][]
        } else {
          entries = Object.entries(init.headers as Record<string, string>)
        }

        let hadBadChar = false
        for (const [key, value] of entries) {
          let safe = ''
          for (let i = 0; i < value.length; i++) {
            const cp = value.charCodeAt(i)
            if (cp > 255) {
              if (!hadBadChar) {
                console.error('[FetchSanitizer] Removed non-ISO-8859-1 char from header "' + key + '" at index ' + i + ': U+' + cp.toString(16).padStart(4, '0') + ' (' + value[i] + ')')
                console.error('[FetchSanitizer] Full original value:', JSON.stringify(value))
                hadBadChar = true
              }
            } else {
              safe += value[i]
            }
          }
          safeHeaders[key] = safe
        }

        init = { ...init, headers: safeHeaders }
      }
      return originalFetch(input, init)
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  return null
}
