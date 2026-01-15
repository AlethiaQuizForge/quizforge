export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = async (
  err: Error,
  request: { path: string; method: string; headers: { [key: string]: string } },
  context: { routerKind: string; routePath: string; routeType: string; renderSource: string; revalidateReason: string | undefined; }
) => {
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureException(err, {
    extra: {
      request,
      context,
    },
  });
};
