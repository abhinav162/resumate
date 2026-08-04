import { useMutation } from '@tanstack/react-query';
import { githubApi } from '../../../lib/githubApi';

/**
 * Redirect to the GitHub authorize URL. One flow covers connect, "add
 * account" and reconnect: GitHub authorizes whichever account the browser is
 * signed into on github.com — reconnecting an existing account rotates its
 * token, a new account adds a connection.
 */
export function useGithubConnect() {
  return useMutation({
    mutationFn: githubApi.getConnectUrl,
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });
}
