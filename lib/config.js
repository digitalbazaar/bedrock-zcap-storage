/*!
 * Copyright (c) 2019-2025 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from '@bedrock/core';

const namespace = 'zcap-storage';
const cfg = config[namespace] = {};

cfg.caches = {
  policy: {
    max: 1000,
    ttl: 5 * 60 * 1000
  },
  revocation: {
    max: 1000,
    ttl: 5 * 60 * 1000
  },
  zcap: {
    max: 1000,
    ttl: 5 * 60 * 1000
  }
};

cfg.logging = {
  // zcap expiration logging for observability / monitoring alerts
  zcapExpiration: {
    // log name used for filtering/alerting (e.g., CloudWatch metric filters)
    // example filter: { $.logName = "zcap-expiration" }
    logName: 'zcap-expiration',
    // log events for zcaps that are near expiration (not yet expired, but
    // within the threshold); set to `false` to disable near-expiration logging
    logNearExpiration: {
      // threshold in milliseconds; zcaps expiring within this window will be
      // logged; default: 7 days
      threshold: 7 * 24 * 60 * 60 * 1000
    },
    // log events for zcaps that have already expired; set to `false` to
    // disable expired zcap logging
    logExpired: true
  }
};
