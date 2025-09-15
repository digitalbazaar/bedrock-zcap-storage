/*!
 * Copyright (c) 2019-2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import * as database from '@bedrock/mongodb';
import assert from 'assert-plus';
import {LruCache} from '@digitalbazaar/lru-memoize';

const {util: {BedrockError}} = bedrock;

// cache for revocation status of zcaps
let REVOCATION_CACHE;

bedrock.events.on('bedrock-mongodb.ready', async () => {
  await database.openCollections(['zcap-storage-revocation']);
  await database.createIndexes([{
    collection: 'zcap-storage-revocation',
    fields: {'meta.delegator': 1, 'capability.id': 1},
    options: {unique: true}
  }, {
    collection: 'zcap-storage-revocation',
    fields: {'meta.rootTarget': 1},
    options: {unique: false}
  }, {
    // automatically expire revocations with an `expires` date field
    collection: 'zcap-storage-revocation',
    fields: {'meta.expires': 1},
    options: {
      unique: false,
      expireAfterSeconds: 0
    }
  }]);

  const cfg = bedrock.config['zcap-storage'];
  const cacheConfig = cfg.caches.revocation;
  REVOCATION_CACHE = new LruCache(cacheConfig);
});

/**
 * An object containing information on the query plan.
 *
 * @typedef {object} ExplainObject
 */

/**
 * Inserts a zcap revocation into storage.
 *
 * @param {object} options - The options to use.
 * @param {string} options.delegator - The ID of the entity that delegated the
 *   revocation.
 * @param {string} options.rootTarget - The ID of a root object or resource to
 *   associate with the revocation; this can be used to aggregate multiple
 *   revocations associated with the same root object or resource.
 * @param {object} options.capability - The capability to insert.
 *
 * @returns {Promise<object>} The database record.
 */
export async function insert({delegator, rootTarget, capability} = {}) {
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
    // Set the revocation record to expire from the database collection one day
    // after the capability expires, using the TTL index on `meta.expires`.
    // There is no need to keep revocation records for an extended period after
    // the capability has expired, as the capability will be rejected based on
    // its expiration, eliminating the need for a revocation. Additionally, a
    // revocation record must not expire too soon to prevent conflicts with
    // expiration-related grace periods elsewhere in the stack
    // (e.g., clock skew).
    const revocationExpires = new Date(capability.expires);
    revocationExpires.setDate(revocationExpires.getDate() + 1);
    meta.expires = revocationExpires;
  }

  const record = {capability, meta};

  try {
    await _getCollection().insertOne(record);
    return record;
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
}

/**
 * Gets a count of all zcap revocations in storage for the given root target.
 *
 * @param {object} options - The options to use.
 * @param {string} options.rootTarget - The ID of a root object or resource
 *   associated with the revocations to count.
 * @param {boolean} [options.explain=false] - An optional explain boolean.
 *
 * @returns {Promise<object | ExplainObject>} Resolves with an object `{count}`
 *   with the number of zcap revocations associated with the given `rootTarget`
 *   or an ExplainObject if `explain=true`.
 */
export async function count({rootTarget, explain = false} = {}) {
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
}

/**
 * A summary of a capability.
 *
 * @typedef {object} CapabilitySummary
 * @property {string} capabilityId - The value of `capability.id`.
 * @property {string} delegator - The delegator of the capability.
 */

/**
 * Determine if any of the provided capabilities have been revoked.
 *
 * @param {object} options - The options to use.
 * @param {CapabilitySummary[]} options.capabilities  - The capabilities to
 *   check.
 * @param {boolean} [options.explain=false] - An optional explain boolean.
 *
 * @returns {Promise<boolean | ExplainObject>} Resolves with at least one of
 *   the capabilities has been revoked or an ExplainObject if `explain=true`.
 */
export async function isRevoked({capabilities, explain = false} = {}) {
  assert.arrayOfObject(capabilities, 'capabilities');
  const records = await _getUncachedRevocations({
    capabilities, limit: 1, explain
  });
  if(explain) {
    return records;
  }
  return records.length > 0;
}

function _getCollection() {
  return database.collections['zcap-storage-revocation'];
}

async function _getUncachedRevocations({capabilities, limit, explain = false}) {
  const query = {$or: []};

  for(const c of capabilities) {
    assert.string(c.capabilityId, 'capabilityId');
    assert.string(c.delegator, 'delegator');
    query.$or.push({
      'capability.id': c.capabilityId,
      'meta.delegator': c.delegator
    });
  }

  const collection = _getCollection();
  const projection = {'capability.id': 1};
  const cursor = collection.find(query, {projection});
  if(limit !== undefined) {
    cursor.limit(limit);
  }

  if(explain) {
    return cursor.explain('executionStats');
  }

  return cursor.toArray();
}
