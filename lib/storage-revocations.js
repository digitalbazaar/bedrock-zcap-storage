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
 * An object containing information on the query plan.
 *
 * @typedef {object} ExplainObject
 */

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
 * @param {boolean} [explain=false] - An optional explain boolean.
 *
 * @return {Promise<object | ExplainObject>} Resolves with an object `{count}`
 *   with the number of zcap revocations associated with the given `rootTarget`
 *   or an ExplainObject if `explain=true`.
 */
exports.count = async ({rootTarget, explain = false} = {}) => {
  // count all revocations with the given `rootTarget`
  const collection = _getCollection();
  const query = {
    'meta.rootTarget': rootTarget
  };

  if(explain) {
    // 'find()' is used here because 'countDocuments()' doesn't return a
    // cursor which allows the use of the explain function.
    const cursor = await collection.find(query);
    return cursor.explain('executionStats');
  }

  const count = await collection.countDocuments(query);
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
 * @param {boolean} [explain=false] - An optional explain boolean.
 *
 * @return {Promise<boolean | ExplainObject>} Resolves with at least one of the
 *   capabilities has been revoked or an ExplainObject if `explain=true`.
 */
exports.isRevoked = async ({capabilities, explain = false} = {}) => {
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

  const collection = _getCollection();
  const projection = {_id: 1};

  if(explain) {
    // 'find().limit(1)' is used here because 'findOne()' doesn't return a
    // cursor which allows the use of the explain function.
    const cursor = await collection.find(query, {projection}).limit(1);
    return cursor.explain('executionStats');
  }

  const revoked = await collection.findOne(
    query, {projection});

  return !!revoked;
};

function _getCollection() {
  return database.collections['zcap-storage-revocation'];
}
