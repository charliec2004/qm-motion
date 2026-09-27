import React, { useEffect, useState } from 'react';

// Client-side navigation for internal paths; external URLs behave normally.
export default function Link({ href, onClick, ...props }) {
  function handleClick(event) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    if (!href.startsWith('/')) return;
    event.preventDefault();
    window.history.pushState({}, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo(0, 0);
  }
  return <a href={href} onClick={handleClick} {...props} />;
}

export function usePath() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  return path;
}
