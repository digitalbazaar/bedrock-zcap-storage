/*
 * Copyright (c) 2019-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

require('bedrock-mongodb');

// load config defaults
require('./config');

// module API
module.exports = require('./storage');
