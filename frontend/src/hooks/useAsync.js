import { useCallback, useEffect, useState } from 'react';

/**
 * Runs an async loader and tracks loading / error / data so every page can show
 * the same loading, empty and error states without repeating itself.
 */
export default function useAsync(loader, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const run = useCallback(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loader()
      .then((result) => alive && setData(result))
      .catch((err) => alive && setError(err.message || 'Something went wrong.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(run, [run]);

  return { data, loading, error, reload: run, setData };
}
