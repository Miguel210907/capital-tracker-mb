import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type DependencyList } from 'react';

interface RefreshableState<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRefreshable<T>(
  loader: () => Promise<T>,
  deps: DependencyList = [],
): RefreshableState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const next = await loader();
      setData(next);
    } catch (unknownError) {
      const message = unknownError instanceof Error ? unknownError.message : 'Error cargando datos.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, deps);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading((current) => current || data === null);
      setError(null);

      loader()
        .then((next) => {
          if (active) {
            setData(next);
          }
        })
        .catch((unknownError) => {
          if (active) {
            const message =
              unknownError instanceof Error ? unknownError.message : 'Error cargando datos.';
            setError(message);
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });

      return () => {
        active = false;
      };
    }, deps),
  );

  return { data, loading, refreshing, error, refresh };
}
