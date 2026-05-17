'use client'

if (typeof window !== 'undefined') {
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

      for (const [key, value] of entries) {
        let safe = ''
        for (let i = 0; i < value.length; i++) {
          const cp = value.charCodeAt(i)
          if (cp > 255) {
            console.error('[FetchSanitizer] Removed non-ISO-8859-1 char from header "' + key + '" at index ' + i + ': U+' + cp.toString(16).padStart(4, '0'))
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
}

export function FetchSanitizer() {
  return null
}
