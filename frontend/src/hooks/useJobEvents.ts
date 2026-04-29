import { useEffect } from 'react';
import { getJobEventsUrl } from '../lib/api';

export const useJobEvents = (
  jobId: string | null,
  onMessage: (payload: any) => void,
  enabled = true
) => {
  useEffect(() => {
    if (!jobId || !enabled) return;

    const source = new EventSource(getJobEventsUrl(jobId), { withCredentials: true });
    source.onmessage = (event) => {
      onMessage(JSON.parse(event.data));
    };
    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [enabled, jobId, onMessage]);
};
