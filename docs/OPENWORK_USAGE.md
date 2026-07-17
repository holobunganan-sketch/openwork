# OpenCode Go usage in OpenWork

OpenWork treats provider billing data as a privileged desktop concern. Usage is fetched by Main and exposed to Renderer only as period totals; credentials and raw provider responses are not exposed through the preload API.

## Provider adapter

OpenCode does not currently publish a stable, documented Go usage API. OpenWork therefore does not guess or scrape a private endpoint. An organization that has a supported provider endpoint can opt in by starting OpenWork with:

- `OPENWORK_GO_USAGE_ENDPOINT`: an HTTPS endpoint, or an HTTP loopback endpoint for a local adapter.
- `OPENWORK_GO_USAGE_TOKEN`: optional bearer token retained in Main process environment.

The adapter response must contain `fiveHour`, `weekly`, and `monthly` objects, either at the top level or below `periods`. Each object supplies numeric `used` and `limit` values and may supply `resetsAt` as an epoch-millisecond timestamp. A valid adapter result is labelled `official` in the UI because it comes from the endpoint explicitly configured by the operator.

## Local fallback

When no adapter is configured, or when the adapter fails, OpenWork queries the authenticated loopback OpenCode sidecar for local session metadata and sums recorded session costs over rolling 5-hour, 7-day, and 30-day windows. The UI labels this result `local-estimate` and states that it can differ from Go billing.

The comparison limits are the values documented by OpenCode Go on 2026-07-17: USD 12 over five hours, USD 30 over seven days, and USD 60 over thirty days. They are reference thresholds, not a claim about remaining provider balance. If both sources fail, the UI reports `unavailable` rather than fabricating a value.

Official documentation: <https://opencode.ai/docs/go/>
