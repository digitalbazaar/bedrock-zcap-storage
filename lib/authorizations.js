/*!
 * Copyright (c) 2019-2022 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from 'bedrock';
import * as database from 'bedrock-mongodb';
import assert from 'assert-plus';

const {util: {BedrockError}} = bedrock;

/**
 * An object containing information on the query plan.
 *
 * @typedef {object} ExplainObject
 */

/**
 * Inserts an authorization into storage.
 *
 * @param {object} options - The options to use.
 * @param {string} options.controller - The ID of the entity storing the
 *   authorization and that controls its potential removal from storage.
 * @param {object} options.capability - The capability to insert.
 *
 * @returns {Promise<object>} Resolves to the database record.
 */
export async function insert({controller, capability} = {}) {
  assert.string(controller, 'controller');
  assert.object(capability, 'capability');
  assert.string(capability.id, 'capability.id');

  let {invocationTarget} = capability;
  if(invocationTarget && typeof invocationTarget === 'object' &&
    typeof invocationTarget.id === 'string') {
    invocationTarget = invocationTarget.id;
  }
  if(typeof invocationTarget !== 'string') {
    throw new TypeError(
      '"capability.invocationTarget" must be a string or an object with ' +
      'where "capability.invocationTarget.id" is a string.');
  }
  if(!invocationTarget.includes(':')) {
    throw new Error(
      'The ID of the capability\'s invocation target must be an absolute URI.');
  }

  // insert the capability and get the updated record
  const now = Date.now();
  const meta = {created: now, updated: now};
  const record = {
    id: database.hash(capability.id),
    invocationTarget: database.hash(invocationTarget),
    controller: database.hash(controller),
    meta,
    authorization: {controller, capability}
  };

  try {
    const collection = database.collections['zcap-storage-authorization'];
    const result = await collection.insertOne(
      record, database.writeOptions);
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
 * Gets a authorization from storage. In addition to the `id` of the
 * capability, either `controller` or `invocationTarget` must be given.
 *
 * @param {object} options - The options to use.
 * @param {string} options.id - The ID of the capability.
 * @param {string} [options.controller] - The ID of the entity that stored the
 *   authorization.
 * @param {string|Array} [options.invocationTarget] - The `invocationTarget`
 *   for the capability.
 * @param {boolean} [options.explain=false] - An optional explain boolean.
 *
 * @returns {Promise<Object | ExplainObject>} Resolves to `{capability, meta}`
 *   or an ExplainObject if `explain=true`.
 */
export async function get({
  id, controller, invocationTarget, explain = false
} = {}) {
  assert.string(id, 'id');
  assert.optionalString(controller, 'controller');
  if(invocationTarget !== undefined) {
    if(Array.isArray(invocationTarget)) {
      assert.optionalArrayOfString(invocationTarget, 'invocationTarget');
    } else {
      assert.optionalString(invocationTarget, 'invocationTarget');
    }
  }
  if(!(controller || invocationTarget)) {
    throw new TypeError(
      'Either "controller" or "invocationTarget" must be given.');
  }

  const collection = database.collections['zcap-storage-authorization'];
  const query = {
    id: database.hash(id)
  };
  if(controller) {
    query.controller = database.hash(controller);
  }
  if(invocationTarget) {
    if(Array.isArray(invocationTarget)) {
      query.invocationTarget = {
        $in: invocationTarget.map(database.hash)
      };
    } else {
      query.invocationTarget = database.hash(invocationTarget);
    }
  }
  const projection = {_id: 0, authorization: 1, meta: 1};

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
      {id, invocationTarget, controller, httpStatusCode: 404, public: true});
  }

  return record;
}

/**
 * Retrieves all authorizations from storage that match the given query.
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
  const collection = database.collections['zcap-storage-authorization'];

  if(explain) {
    const cursor = await collection.find(query, options);
    return cursor.explain('executionStats');
  }

  return collection.find(query, options).toArray();
}

/**
 * Removes an authorization from storage.
 *
 * @param {object} options - The options to use.
 * @param {string} options.controller - The ID of the entity that stored the
 *   authorization.
 * @param {string} options.id - The ID of the zcap to remove.
 * @param {boolean} [options.explain=false] - An optional explain boolean.
 *
 * @returns {Promise<Boolean | ExplainObject>} Resolves to `true` if a zcap was
 *   removed and `false` if not or an ExplainObject if `explain=true`.
 */
export async function remove({controller, id, explain = false} = {}) {
  assert.string(controller, 'controller');
  assert.string(id, 'id');

  const collection = database.collections['zcap-storage-authorization'];
  const query = {
    controller: database.hash(controller),
    id: database.hash(id)
  };

  if(explain) {
    // 'find()' is used here because 'deleteMany()' doesn't return a
    // cursor which allows the use of the explain function.
    const cursor = await collection.find(query);
    return cursor.explain('executionStats');
  }

  const result = await collection.deleteMany(query);
  return result.result.n !== 0;
}
