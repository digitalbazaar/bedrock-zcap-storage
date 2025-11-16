/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import * as database from '@bedrock/mongodb';
import assert from 'assert-plus';
import {LruCache} from '@digitalbazaar/lru-memoize';

const {util: {BedrockError}} = bedrock;

const COLLECTION_NAME = 'zcap-storage-policy';

let POLICY_CACHE;

bedrock.events.on('bedrock.init', async () => {
  const cfg = bedrock.config['zcap-storage'];
  const cacheConfig = cfg.caches.policy;
  POLICY_CACHE = new LruCache(cacheConfig);
});

bedrock.events.on('bedrock-mongodb.ready', async () => {
  await database.openCollections([COLLECTION_NAME]);
  await database.createIndexes([{
    collection: COLLECTION_NAME,
    fields: {'policy.controller': 1, 'policy.delegate': 1},
    options: {unique: true}
  }]);
});

/**
 * Inserts a zcap policy into storage.
 *
 * @param {object} options - The options to use.
 * @param {object} options.policy - The policy to insert.
 *
 * @returns {Promise<object>} The database record.
 */
export async function insert({policy} = {}) {
  _assertPolicy(policy);
  if(policy.sequence !== 0) {
    throw new Error('Initial "policy.sequence" must be zero.');
  }

  const now = Date.now();
  const meta = {created: now, updated: now};
  const record = {meta, policy};

  try {
    await _getCollection().insertOne(record);
    // clear any "not found" cache value
    POLICY_CACHE.delete(_getCacheKey(policy));
    return record;
  } catch(cause) {
    if(!database.isDuplicateError(cause)) {
      throw cause;
    }
    throw new BedrockError('Duplicate revocation.', {
      name: 'DuplicateError',
      cause,
      details: {
        public: true,
        httpStatusCode: 409
      }
    });
  }
}

/**
 * Gets a count of all zcap policies in storage for the given controller.
 *
 * @param {object} options - The options to use.
 * @param {string} options.controller - The ID of a zcap policy controller.
 *
 * @returns {Promise<object>} Resolves with an object `{count}`
 *   with the number of zcap policies associated with the given `controller`.
 */
export async function count({controller} = {}) {
  assert.string(controller, 'controller');

  // count all policies with the given `controller`
  const collection = _getCollection();
  const query = {'policy.controller': controller};
  const count = await collection.countDocuments(query);
  return {count};
}

/**
 * Gets a zcap policy from storage. The `controller` and `delegate` of the
 * policy must be given.
 *
 * @param {object} options - The options to use.
 * @param {string} options.controller - The ID of the controller of the policy.
 * @param {string} options.delegate - The ID of the delegate for which the
 *   policy applies.
 * @param {boolean} [options.explain=false] - An optional explain boolean.
 * @param {boolean} [options.useCache=true] - `true` to allow use of a cache,
 *   `false` not to.
 *
 * @returns {Promise<object | ExplainObject>} Resolves to `{policy, meta}`
 *   or an ExplainObject if `explain=true`.
 */
export async function get({
  controller, delegate, explain = false, useCache = true
} = {}) {
  assert.string(controller, 'controller');
  assert.string(delegate, 'delegate');

  if(explain || !useCache) {
    return _getUncachedPolicyRecord({controller, delegate, explain});
  }

  const key = _getCacheKey({controller, delegate});
  const fn = () => _getUncachedPolicyRecord({controller, delegate});
  return POLICY_CACHE.memoize({key, fn});
}

/**
 * Retrieves all zcap policies from storage that match the given query.
 *
 * @param {object} options - The options to use.
 * @param {object} [options.query = {}] - The optional query to use.
 * @param {object} [options.options = {}] - Options (eg: 'sort', 'limit',
 *   'projection').
 * @param {boolean} [options.explain=false] - An optional explain boolean.
 *
 * @returns {Promise<Array | ExplainObject>} Resolves to the records that
 *   matched the query or an ExplainObject if `explain=true`.
 */
export async function find({
  query = {}, options = {}, explain = false
} = {}) {
  const collection = database.collections[COLLECTION_NAME];
  const cursor = await collection.find(query, options);

  if(explain) {
    return cursor.explain('executionStats');
  }

  return cursor.toArray();
}

/**
 * Update a zcap policy.
 *
 * @param {object} options - The options to use.
 * @param {object} options.policy - The updated policy.
 *
 * @returns {Promise<object>} Resolves to the updated record on success.
 */
export async function update({policy} = {}) {
  _assertPolicy(policy);

  // update record
  const {controller, delegate} = policy;
  const query = {
    'policy.controller': controller,
    'policy.delegate': delegate,
    // existing policy must be `1` before the new update
    'policy.sequence': policy.sequence - 1
  };
  const $set = {
    'meta.updated': Date.now(),
    policy
  };
  const projection = {_id: 0, meta: 1, policy: 1};
  const collection = _getCollection();
  const result = await collection.findOneAndUpdate(query, {$set}, {
    projection,
    returnDocument: 'after',
    includeResultMetadata: true
  });

  // always clear cache value whether update succeeded or not -- to ensure
  // callers can receive a fresh value for retrying an update
  POLICY_CACHE.delete(_getCacheKey(policy));

  if(result.lastErrorObject?.updatedExisting === false) {
    throw new BedrockError(
      'Could not update zcap policy; ' +
      'policy either not found or unexpected sequence number.', {
        name: 'InvalidStateError',
        details: {
          controller: policy.controller,
          delegate: policy.delegate,
          httpStatusCode: 409,
          public: true
        }
      });
  }
  return result.value;
}

/**
 * Remove a zcap policy.
 *
 * @param {object} options - The options to use.
 * @param {string} options.controller - The `controller` of the policy.
 * @param {string} options.delegate - The `delegate` of the policy.
 * @param {number} [options.sequence] - The optional `sequence` to include to
 *   match the record prior to deletion.
 *
 * @returns {Promise<boolean>} Resolves to true if a record was removed.
 */
export async function remove({controller, delegate, sequence} = {}) {
  assert.string(controller, 'controller');
  assert.string(delegate, 'delegate');
  assert.optionalNumber(sequence, 'sequence');

  const query = {
    'policy.controller': controller,
    'policy.delegate': delegate
  };
  if(sequence !== undefined) {
    query['policy.sequence'] = sequence;
  }
  const collection = _getCollection();
  const result = await collection.deleteOne(query);
  // clear any now stale cache entry
  POLICY_CACHE.delete(_getCacheKey({controller, delegate}));
  return result.deletedCount === 1;
}

function _assertPolicy(policy) {
  assert.object(policy, 'policy');
  assert.number(policy.sequence, 'policy.sequence');
  assert.string(policy.controller, 'policy.controller');
  assert.string(policy.delegate, 'policy.delegate');
  if(policy.refresh !== false) {
    assert.object(policy.refresh, 'policy.refresh');
  }
  if(!(Number.isInteger(policy.sequence) && policy.sequence >= 0)) {
    throw new TypeError('"policy.sequence" must be a non-negative integer.');
  }
}

function _getCollection() {
  return database.collections[COLLECTION_NAME];
}

async function _getUncachedPolicyRecord({
  controller, delegate, explain = false
} = {}) {
  const collection = _getCollection();
  const query = {
    'policy.controller': controller,
    'policy.delegate': delegate
  };
  const projection = {_id: 0, meta: 1, policy: 1};

  if(explain) {
    // 'find().limit(1)' is used here because 'findOne()' doesn't return a
    // cursor which allows the use of the explain function.
    const cursor = await collection.find(query, {projection}).limit(1);
    return cursor.explain('executionStats');
  }

  const record = await collection.findOne(query, {projection});
  if(!record) {
    throw new BedrockError('Authorization capability policy not found.', {
      name: 'NotFoundError',
      details: {
        controller,
        delegate,
        httpStatusCode: 404,
        public: true
      }
    });
  }

  return record;
}

function _getCacheKey({controller, delegate}) {
  return JSON.stringify({controller, delegate});
}

/**
 * An object containing information on the query plan.
 *
 * @typedef {object} ExplainObject
 */
