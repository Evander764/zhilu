import { useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
const positions = new Map<string, number>();
export function useRelatedScroll() {
  const location = useLocation();
  const action = useNavigationType();
  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);
  useLayoutEffect(() => {
    window.scrollTo(0, action === 'POP' ? positions.get(location.key) || 0 : 0);
    const save = () => {
      if (positions.size >= 100 && !positions.has(location.key))
        positions.delete(positions.keys().next().value!);
      positions.set(location.key, window.scrollY);
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => {
      window.removeEventListener('scroll', save);
    };
  }, [location.key, action]);
}
