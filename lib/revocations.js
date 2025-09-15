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

    // clear any revocation cache entry
    REVOCATION_CACHE.delete(_getRevocationCacheKey({
      capabilityId: capability.id, delegator
    }));

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
  if(explain) {
    return _getUncachedRevocations({capabilities, limit: 1, explain});
  }
  return _cachedIsRevoked({capabilities});
}

function _getCollection() {
  return database.collections['zcap-storage-revocation'];
}

async function _cachedIsRevoked({capabilities}) {
  /* Note: This function will cause all possible revocation records related to
  the capability summaries listed in `capabilities` to be looked up with no
  more than a single database call. If every capability summary is in the
  cache, then all revocation values will come from the cache, otherwise the
  revocation values will be fetched from the database.

  This function will resolve as soon as any positive revocation status is
  found; any subsequent results will still be cached for future queries, but
  any subsequent database look up errors will be caught and ignored. If a
  database look up error occurs before any positive revocation status is found
  then the error will be surfaced. Any negative revocation status results will
  cause the operation to continue to wait until either a positive revocation
  status result is found, an error occurs, or all capabilities have been found
  to be non-revoked. */
  let resolveRevoked;
  let rejectRevoked;
  const revokedPromise = new Promise((resolve, reject) => {
    resolveRevoked = resolve;
    rejectRevoked = reject;
  });

  // run all checks concurrently and return immediately when any positive
  // revocation status is found or an error occurs
  const dbCallState = {capabilities, promise: null};
  Promise.all(capabilities.map(async capabilitySummary => {
    const key = _getRevocationCacheKey(capabilitySummary);
    const fn = _createCacheGetter({capabilitySummary, dbCallState});
    const revoked = await REVOCATION_CACHE.memoize({key, fn});
    if(revoked) {
      resolveRevoked(true);
    }
  })).then(() => resolveRevoked(false), rejectRevoked);

  // will resolve on a positive revocation hit or when all revocation checks
  // are negative; will only reject if an error occurs *before* either of these
  // conditions occurs, otherwise the error will be safely ignored
  return revokedPromise;
}

function _getRevocationCacheKey(capabilitySummary) {
  const {capabilityId, delegator} = capabilitySummary;
  assert.string(capabilityId, 'capabilityId');
  assert.string(delegator, 'delegator');
  return JSON.stringify({capabilityId, delegator});
}

function _createCacheGetter({capabilitySummary, dbCallState}) {
  // return function that will resolve to revocation status for the given
  // capability summary using the shared database call
  return async () => {
    // if the database call hasn't started yet, start it
    if(!dbCallState.promise) {
      const {capabilities} = dbCallState;
      dbCallState.promise = _getUncachedRevocations({capabilities})
        .catch(e => e);
    }
    // await database result
    const {capabilityId, delegator} = capabilitySummary;
    const recordsOrError = await dbCallState.promise;
    if(recordsOrError instanceof Error) {
      throw recordsOrError;
    }
    // if a match is in `records`, then the capability is revoked
    return recordsOrError.find(record =>
      record.capability.id === capabilityId &&
      record.meta.delegator === delegator) !== undefined;
  };
}

async function _getUncachedRevocations({capabilities, limit, explain = false}) {
  const query = {$or: []};

  for(const {capabilityId, delegator} of capabilities) {
    query.$or.push({
      'capability.id': capabilityId,
      'meta.delegator': delegator
    });
  }

  const collection = _getCollection();
  const projection = {'meta.delegator': 1, 'capability.id': 1};
  const cursor = collection.find(query, {projection});
  if(limit !== undefined) {
    cursor.limit(limit);
  }

  if(explain) {
    return cursor.explain('executionStats');
  }

  return cursor.toArray();
}
