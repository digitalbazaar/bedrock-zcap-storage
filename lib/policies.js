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
    fields: {'policy.controller': 1},
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
 * Gets a zcap policy from storage. The `controller` of policy must be given.
 *
 * @param {object} options - The options to use.
 * @param {string} options.controller - The ID of the controller of the policy.
 * @param {boolean} [options.explain=false] - An optional explain boolean.
 * @param {boolean} [options.useCache=true] - `true` to allow use of a cache,
 *   `false` not to.
 *
 * @returns {Promise<object | ExplainObject>} Resolves to `{policy, meta}`
 *   or an ExplainObject if `explain=true`.
 */
export async function get({controller, explain = false, useCache = true} = {}) {
  assert.string(controller, 'controller');

  if(explain || !useCache) {
    return _getUncachedPolicyRecord({controller, explain});
  }

  const fn = () => _getUncachedPolicyRecord({controller});
  return POLICY_CACHE.memoize({key: controller, fn});
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
  const {controller} = policy;
  const query = {
    'policy.controller': controller,
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
  if(result.lastErrorObject?.updatedExisting === false) {
    throw new BedrockError(
      'Could not update zcap policy; ' +
      'policy either not found or unexpected sequence number.', {
        name: 'InvalidStateError',
        details: {
          controller: policy.controller,
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
 * @param {string} options.controller - The controller of the policy.
 * @param {number} [options.sequence] - The optional sequence to include to
 *   match the record prior to deletion.
 *
 * @returns {Promise<boolean>} Resolves to true if a record was removed.
 */
export async function remove({controller, sequence} = {}) {
  assert.string(controller, 'controller');
  assert.optionalNumber(sequence, 'sequence');

  const query = {'policy.controller': controller};
  if(sequence !== undefined) {
    query['policy.sequence'] = sequence;
  }
  const collection = _getCollection();
  const result = await collection.deleteOne(query);
  return result.deletedCount === 1;
}

function _assertPolicy(policy) {
  assert.object(policy, 'policy');
  assert.number(policy.sequence, 'policy.sequence');
  assert.string(policy.controller, 'policy.controller');
  assert.object(policy.refresh, 'policy.refresh');
  if(!(Number.isInteger(policy.sequence) && policy.sequence >= 0)) {
    throw new TypeError('"policy.sequence" must be a non-negative integer.');
  }
}

function _getCollection() {
  return database.collections[COLLECTION_NAME];
}

async function _getUncachedPolicyRecord({controller, explain = false} = {}) {
  const collection = _getCollection();
  const query = {'policy.controller': controller};
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
      details: {controller, httpStatusCode: 404, public: true}
    });
  }

  return record;
}

/**
 * An object containing information on the query plan.
 *
 * @typedef {object} ExplainObject
 */
