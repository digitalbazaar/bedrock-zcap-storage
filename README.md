# bedrock-zcap-storage
Backend storage of Authorization Capabilities for Bedrock apps

## Zcap Expiration Logging

Proactive logging for zcap expiration events, designed for observability alerting.

### Configuration

```js
// bedrock config
config['zcap-storage'].logging.zcapExpiration = {
  // Key for metric filters: { $.logName = "zcap-expiration" }
  logName: 'zcap-expiration',

  // Warn when zcaps expire within threshold (default: 7 days)
  // Set to `false` to disable
  logNearExpiration: {
    threshold: 7 * 24 * 60 * 60 * 1000,

    // Suppress warnings for short-lived/ephemeral zcaps whose original TTL
    // (delegation lifetime, computed from `proof.created` to `expires`) is
    // at or below this value in ms. Such zcaps are intentionally
    // short-lived and would always trip the threshold by design.
    // Defaults to `null`, which uses the value of `threshold`. Set to `0`
    // (or a negative number) to disable the filter and warn on all zcaps
    // near expiration. Zcaps without a `proof.created` timestamp are never
    // suppressed.
    minTtl: null
  },

  // Log when expired zcaps are presented (default: true)
  // Set to `false` to disable
  logExpired: true
};
```

### Log Events

**Near-expiration** (warning level):
```json
{
  "logName": "zcap-expiration",
  "event": "zcap-near-expiration",
  "capabilityId": "urn:zcap:...",
  "invocationTarget": "https://...",
  "timeUntilExpirationMs": 432000000
}
```

**Expired** (error level):
```json
{
  "logName": "zcap-expiration",
  "event": "zcap-expired",
  "capabilityId": "urn:zcap:...",
  "invocationTarget": "https://...",
  "expiredAgoMs": 3600000
}
```
