/*!
 * Copyright (c) 2019-2022 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from 'bedrock';
import * as database from 'bedrock-mongodb';
import assert from 'assert-plus';
import {LruCache} from '@digitalbazaar/lru-memoize';

const {util: {BedrockError}} = bedrock;

// cache for `zcaps` collection only
let ZCAP_CACHE;

bedrock.events.on('bedrock.init', async () => {
  const cfg = bedrock.config['zcap-storage'];
  ZCAP_CACHE = new LruCache(cfg.caches.zcap);
});

/**
 * An object containing information on the query plan.
 *
 * @typedef {object} ExplainObject
 */

/**
 * Inserts a received capability into storage for later invocation.
 *
 * @param {object} options - The options to use.
 * @param {string} options.controller - The ID of the entity storing the zcap.
 * @param {string} options.referenceId - An application specific ID for the
 *   zcap, scoped to the controller.
 * @param {object} options.capability - The zcap to insert.
 *
 * @returns {Promise<object>} Resolves to the database record.
 */
export async function insert({controller, referenceId, capability} = {}) {
  assert.string(controller, 'controller');
  assert.string(referenceId, 'referenceId');
  assert.object(capability, 'capability');
  assert.string(capability.id, 'capability.id');
  assert.string(capability.controller, 'capability.controller');

  // insert the capability and get the updated record
  const now = Date.now();
  const meta = {created: now, updated: now, controller, referenceId};
  const record = {
    id: database.hash(capability.id),
    controller: database.hash(controller),
    invoker: database.hash(capability.controller),
    referenceId: database.hash(referenceId),
    meta,
    capability
  };

  try {
    const collection = database.collections['zcap-storage-zcap'];
    const result = await collection.insertOne(record, database.writeOptions);
    return result.ops[0];
  } catch(e) {
    if(!database.isDuplicateError(e)) {
      throw e;
    }
    throw new BedrockError(
      'Duplicate authorization capability.',
      'DuplicateError', {
        public: true,
        httpStatusCode: 409
      }, e);
  }
}

/**
 * Gets a received capability from storage. In addition to the `controller` of
 * the capability, either `id` or `referenceId` must be given.
 *
 * @param {object} options - The options to use.
 * @param {string} options.controller - The ID of the entity that stored the
 *   zcap.
 * @param {string} [options.id] - The ID of the zcap.
 * @param {string} [options.referenceId] - The application specific ID of the
 *   zcap.
 * @param {boolean} [options.explain=false] - An optional explain boolean.
 * @param {boolean} [options.useCache=true] - `true` to allow use of a cache,
 *   `false` not to.
 *
 * @returns {Promise<object | ExplainObject>} Resolves to `{capability, meta}`
 *   or an ExplainObject if `explain=true`.
 */
export async function get({
  controller, id, referenceId, explain = false, useCache = true
} = {}) {
  assert.string(controller, 'controller');
  assert.optionalString(id, 'id');
  assert.optionalString(referenceId, 'referenceId');
  if(!(id || referenceId)) {
    throw new TypeError('Either "id" or "referenceId" must be given.');
  }

  if(explain || !useCache) {
    return _getUncachedZcapRecord({controller, id, referenceId, explain});
  }

  // use cache
  // note: if the zcap has expired it will still be returned from the cache
  // until its cache max age is hit; zcaps should always be refreshed sooner
  // than the cache max age to ensure proper continued use
  const key = id ? JSON.stringify({controller, id}) :
    JSON.stringify({controller, referenceId});
  const fn = () => _getUncachedZcapRecord({controller, id, referenceId});
  return ZCAP_CACHE.memoize({key, fn});
}

/**
 * Retrieves all capabilities from storage that match the given query.
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
  const collection = database.collections['zcap-storage-zcap'];
  const cursor = await collection.find(query, options);

  if(explain) {
    return cursor.explain('executionStats');
  }

  return cursor.toArray();
}

/**
 * Removes a capability from storage.
 *
 * @param {object} options - The options to use.
 * @param {string} options.controller - The ID of the entity that stored the
 *   zcap.
 * @param {string} [options.id] - The ID of the zcap to remove.
 * @param {string} [options.referenceId] - The application specific ID of the
 *   zcap to remove.
 * @param {boolean} [options.explain=false] - An optional explain boolean.
 *
 * @returns {Promise<boolean | ExplainObject>} Resolves to `true` if a zcap was
 *   removed and `false` if not or an ExplainObject if `explain=true`.
 */
export async function remove({
  controller, id, referenceId, explain = false
} = {}) {
  assert.string(controller, 'controller');
  assert.optionalString(id, 'id');
  assert.optionalString(referenceId, 'referenceId');
  if(!(id || referenceId)) {
    throw new TypeError('Either "id" or "referenceId" must be given.');
  }

  const collection = database.collections['zcap-storage-zcap'];
  const query = {controller: database.hash(controller)};
  if(id) {
    query.id = database.hash(id);
  }
  if(referenceId) {
    query.referenceId = database.hash(referenceId);
  }

  if(explain) {
    // 'find()' is used here because 'deleteMany()' doesn't return a
    // cursor which allows the use of the explain function.
    const cursor = await collection.find(query);
    return cursor.explain('executionStats');
  }

  // clear cache values
  ZCAP_CACHE.delete(JSON.stringify({controller, id}));
  ZCAP_CACHE.delete(JSON.stringify({controller, referenceId}));

  const result = await collection.deleteMany(query);
  return result.result.n !== 0;
}

async function _getUncachedZcapRecord({
  controller, id, referenceId, explain = false
} = {}) {
  const collection = database.collections['zcap-storage-zcap'];
  const query = {controller: database.hash(controller)};
  if(id) {
    query.id = database.hash(id);
  }
  if(referenceId) {
    query.referenceId = database.hash(referenceId);
  }
  const projection = {_id: 0, capability: 1, meta: 1};

  if(explain) {
    // 'find().limit(1)' is used here because 'findOne()' doesn't return a
    // cursor which allows the use of the explain function.
    const cursor = await collection.find(query, {projection}).limit(1);
    return cursor.explain('executionStats');
  }

  const record = await collection.findOne(query, {projection});
  if(!record) {
    throw new BedrockError(
      'Authorization capability not found.',
      'NotFoundError',
      {controller, id, referenceId, httpStatusCode: 404, public: true});
  }

  return record;
}
