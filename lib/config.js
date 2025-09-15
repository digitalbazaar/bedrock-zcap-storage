/*!
 * Copyright (c) 2019-2025 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from '@bedrock/core';

const namespace = 'zcap-storage';
const cfg = config[namespace] = {};

cfg.caches = {
  revocation: {
    max: 1000,
    ttl: 5 * 60 * 1000
  },
  zcap: {
    max: 1000,
    ttl: 5 * 60 * 1000
  }
};
