/*!
 * Copyright (c) 2019-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const assert = require('assert-plus');
const bedrock = require('bedrock');
const database = require('bedrock-mongodb');
const {util: {BedrockError}} = bedrock;

bedrock.events.on('bedrock-mongodb.ready', async () => {
  await database.openCollections(['zcap-storage-revocation']);
  await database.createIndexes([{
    collection: 'zcap-storage-revocation',
    fields: {'meta.delegator': 1, 'capability.id': 1},
    options: {unique: true, background: false}
  }, {
    collection: 'zcap-storage-revocation',
    fields: {'meta.rootTarget': 1},
    options: {unique: false, background: false}
  }, {
    // automatically expire revocations with an `expires` date field
    collection: 'zcap-storage-revocation',
    fields: {'meta.expires': 1},
    options: {
      unique: false,
      background: false,
      expireAfterSeconds: 0
    }
  }]);
});

/**
 * Inserts a zcap revocation into storage.
 *
 * @param {string} delegator - The ID of the entity that delegated the
 *   revocation.
 * @param {string} rootTarget - The ID of a root object or resource to
 *   associate with the revocation; this can be used to aggregate multiple
 *   revocations associated with the same root object or resource.
 * @param {Object} capability - The capability to insert.
 *
 * @return {Promise<Object>} the database record.
 */
exports.insert = async ({delegator, rootTarget, capability} = {}) => {
  assert.string(delegator, 'delegator');
  assert.string(rootTarget, 'rootTarget');
  assert.object(capability, 'capability');
  assert.string(capability.id, 'capability.id');

  const now = Date.now();
  const meta = {
    created: now, updated: now,
    delegator,
    rootTarget
  };
  if(capability.expires) {
    meta.expires = new Date(capability.expires);
  }
  const record = {
    capability,
    meta,
  };

  try {
    const result = await _getCollection().insertOne(
      record, database.writeOptions);
    return result.ops[0];
  } catch(e) {
    if(!database.isDuplicateError(e)) {
      throw e;
    }
    throw new BedrockError(
      'Duplicate revocation.',
      'DuplicateError', {
        public: true,
        httpStatusCode: 409
      }, e);
  }
};

/**
 * Gets a count of all zcap revocations in storage for the given root target.
 *
 * @param {string} rootTarget - The ID of a root object or resource
 *   associated with the revocations to count.
 *
 * @return {Promise<object>} An object `{count}` with the number of zcap
 *   revocations associated with the given `rootTarget`.
 */
exports.count = async ({rootTarget} = {}) => {
  // count all revocations with the given `rootTarget`
  const collection = _getCollection();
  const count = await collection.countDocuments({
    'meta.rootTarget': rootTarget
  });
  return {count};
};

/**
 * A summary of a capability.
 *
 * @typedef {Object} CapabilitySummary
 * @property {string} capabilityId - The value of `capability.id`.
 * @property {string} delegator - The delegator of the capability.
 */

/**
 * Determine if any of the provided capabilities have been revoked.
 *
 * @param {Object} options - The options to use.
 * @param {CapabilitySummary[]} capabilities  - The capabilities to check.
 *
 * @return {Promise<boolean>} At least one of the capabilities has been revoked.
 */
exports.isRevoked = async ({capabilities}) => {
  assert.arrayOfObject(capabilities, 'capabilities');

  const query = {$or: []};

  for(const c of capabilities) {
    assert.string(c.capabilityId, 'capabilityId');
    assert.string(c.delegator, 'delegator');
    query.$or.push({
      'capability.id': c.capabilityId,
      'meta.delegator': c.delegator,
    });
  }

  const revoked = await _getCollection().findOne(
    query, {projection: {_id: 1}});

  return !!revoked;
};

function _getCollection() {
  return database.collections['zcap-storage-revocation'];
}
