/*
 * Copyright (c) 2019-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');
const {config} = bedrock;

const namespace = 'zcap-storage';
const cfg = config[namespace] = {};

cfg.caches = {
  zcap: {
    maxSize: 1000,
    maxAge: 5 * 60 * 1000
  }
};
