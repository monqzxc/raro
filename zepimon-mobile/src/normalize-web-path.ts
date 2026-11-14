if (typeof window !== 'undefined' && window.location.pathname.endsWith('.html')) {
  const { pathname, search, hash } = window.location
  window.history.replaceState(window.history.state, '', `${pathname.slice(0, -5)}${search}${hash}`)
}
