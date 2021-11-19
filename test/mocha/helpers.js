/*
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const database = require('bedrock-mongodb');

exports.removeCollection = async collectionName => {
  await database.collections[collectionName].deleteMany({});
};

exports.hash = string => {
  return database.hash(string);
};
