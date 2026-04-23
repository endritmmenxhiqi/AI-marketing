import { useEffect, useRef } from 'react';
import { getJobEventsUrl } from '../lib/api';

export const useJobEvents = (
  jobId: string | null,
  token: string,
  onMessage: (payload: any) => void,
  enabled = true
) => {
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!jobId || !token || !enabled) return;

    const source = new EventSource(getJobEventsUrl(jobId));
    source.onmessage = (event) => {
      try {
        onMessageRef.current(JSON.parse(event.data));
      } catch (error) {
        console.error('Failed to parse job event payload.', error);
      }
    };
    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [enabled, jobId, token]);
};
