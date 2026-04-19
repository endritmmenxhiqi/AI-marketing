import { useEffect } from 'react';
import { getJobEventsUrl } from '../lib/api';

export const useJobEvents = (
  jobId: string | null,
  token: string,
  onMessage: (payload: any) => void,
  enabled = true
) => {
  useEffect(() => {
    if (!jobId || !token || !enabled) return;

    const source = new EventSource(getJobEventsUrl(jobId));
    source.onmessage = (event) => {
      onMessage(JSON.parse(event.data));
    };
    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [enabled, jobId, onMessage, token]);
};
