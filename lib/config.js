/*!
 * Copyright (c) 2019-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from 'bedrock';

const namespace = 'zcap-storage';
const cfg = config[namespace] = {};

cfg.caches = {
  zcap: {
    maxSize: 1000,
    maxAge: 5 * 60 * 1000
  }
};
