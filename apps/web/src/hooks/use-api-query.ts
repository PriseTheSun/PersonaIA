import { useCallback, useEffect, useRef, useState } from 'react';

type QueryState<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: null; error: Error };

export function useApiQuery<T>(query: (signal: AbortSignal) => Promise<T>, dependencies: unknown[] = []) {
  const queryRef = useRef(query);
  queryRef.current = query;
  const [state, setState] = useState<QueryState<T>>({ status: 'loading', data: null, error: null });
  const [requestId, setRequestId] = useState(0);
  const retry = useCallback(() => setRequestId((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', data: null, error: null });
    queryRef.current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: 'success', data, error: null });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: 'error', data: null, error: error instanceof Error ? error : new Error('Unknown error') });
        }
      });
    return () => controller.abort();
    // Dependencies are explicitly controlled by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, requestId]);

  return { ...state, retry };
}
