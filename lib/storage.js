/*!
 * Copyright (c) 2019-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const assert = require('assert-plus');
const bedrock = require('bedrock');
const database = require('bedrock-mongodb');
const {util: {BedrockError}} = bedrock;

// module API
const api = {};
module.exports = api;

const authorizations = api.authorizations = {};
api.revocations = require('./storage-revocations');
const zcaps = api.zcaps = {};

bedrock.events.on('bedrock-mongodb.ready', async () => {
  /* Note: There are two capability collections:

  1. The `zcap-storage-authorization` collection is used to store capabilities
  that are actively authorized for use. The authorizing party (stored as the
  `controller`) writes these capabilities to this collection after an
  application ensures they are permitted to do so for a given
  `invocationTarget`. Typically, the delegator for a given authorization
  capability is the same party that writes the capability to the
  `authorization` collection. An application may later check storage for these
  active capabilities to get them for potential revocation by querying for
  the capability by its ID and invocationTarget.

  2. The `zcap-storage-zcap` collection is used to store capabilities for an
  invoker to later invoke.

  */
  await database.openCollections([
<<<<<<< HEAD
    'zcap-storage-authorization',
    'zcap-storage-zcap'
=======
    'zcap-authorization',
    'zcap-storage'
>>>>>>> Revert indexes back and update database tests.
  ]);

  await database.createIndexes([{
    // cover queries by invocationTarget and id; as this is a unique index and
    // IDs are controlled by the capability creator, we scope the index to the
    // invocationTarget to prevent squatting on IDs and assume applications
    // will ensure authorizations written to storage were written by parties
    // authorized to delegate the zcap for the invocationTarget
    collection: 'zcap-storage-authorization',
    fields: {invocationTarget: 1, id: 1},
    options: {unique: true, background: false}
  }, {
    // cover queries by controller of the authorization and id; allows for
    // controllers to see all of the zcaps they have authorized via storage
    collection: 'zcap-storage-authorization',
    fields: {controller: 1, id: 1},
    options: {unique: true, background: false}
  }, {
    // enable queries by controller and reference ID (reference IDs are
    // scoped to controllers)
<<<<<<< HEAD
    collection: 'zcap-storage-zcap',
=======
    collection: 'zcap-storage',
>>>>>>> Revert indexes back and update database tests.
    fields: {controller: 1, referenceId: 1},
    options: {unique: true, background: false}
  }, {
    // enable queries by controller and id; as this is a unique index and IDs
    // are controlled by the zcap creator, we scope the index to the controller
    // to prevent entities from squatting on IDs
<<<<<<< HEAD
    collection: 'zcap-storage-zcap',
=======
    collection: 'zcap-storage',
>>>>>>> Revert indexes back and update database tests.
    fields: {controller: 1, id: 1},
    options: {unique: true, background: false}
  }, {
    // enable queries by controller and invoker
<<<<<<< HEAD
    collection: 'zcap-storage-zcap',
=======
    collection: 'zcap-storage',
>>>>>>> Revert indexes back and update database tests.
    fields: {controller: 1, invoker: 1},
    options: {unique: false, background: false}
  }]);
});

/**
 * An object containing information on the query plan.
 *
 * @typedef {object} ExplainObject
 */

/**
 * Inserts an authorization into storage.
 *
 * @param {string} controller the ID of the entity storing the authorization
 *   and that controls its potential removal from storage.
 * @param {Object} capability the capability to insert.
 *
 * @return {Promise<Object>} resolves to the database record.
 */
authorizations.insert = async ({controller, capability} = {}) => {
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
};

/**
 * Gets a authorization from storage. In addition to the `id` of the
 * capability, either `controller` or `invocationTarget` must be given.
 *
 * @param {string} id the ID of the capability.
 * @param {string} [controller] the ID of the entity that stored the
 *   authorization.
 * @param {string|Array} [invocationTarget] the `invocationTarget` for the
 *   capability.
 * @param {boolean} [explain=false] - An optional explain boolean.
 *
 * @return {Promise<Object | ExplainObject>} Resolves to `{capability, meta}`
 *   or an ExplainObject if `explain=true`.
 */
authorizations.get = async ({
  id, controller, invocationTarget, explain = false
} = {}) => {
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
};

/**
 * Retrieves all authorizations from storage that match the given query.
 *
 * @param {Object} [query = {}] the optional query to use.
 * @param {Object} [options = {}] options (eg: 'sort', 'limit', 'projection').
 * @param {boolean} [explain=false] - An optional explain boolean.
 *
 * @return {Promise<Array | ExplainObject>} Resolves to the records that matched
 *   the query or an ExplainObject if `explain=true`.
 */
authorizations.find = async ({
  query = {}, options = {}, explain = false
} = {}) => {
  const collection = database.collections['zcap-storage-authorization'];

  if(explain) {
    const cursor = await collection.find(query, options);
    return cursor.explain('executionStats');
  }

  return collection.find(query, options).toArray();
};

/**
 * Removes an authorization from storage.
 *
 * @param {string} controller the ID of the entity that stored the
 *   authorization.
 * @param {string} id the ID of the zcap to remove.
 * @param {boolean} [explain=false] - An optional explain boolean.
 *
 * @return {Promise<Boolean | ExplainObject>} Resolves to `true` if a zcap was
 *   removed and `false` if not or an ExplainObject if `explain=true`.
 */
authorizations.remove = async ({controller, id, explain = false} = {}) => {
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

  const result = collection.deleteMany(query);
  return result.result.n !== 0;
};

/**
 * Inserts a received capability into storage for later invocation.
 *
 * @param {string} controller the ID of the entity storing the zcap.
 * @param {string} referenceId an application specific ID for the zcap, scoped
 *   to the controller.
 * @param {Object} capability the zcap to insert.
 *
 * @return {Promise<Object>} resolves to the database record.
 */
zcaps.insert = async ({controller, referenceId, capability} = {}) => {
  assert.string(controller, 'controller');
  assert.string(referenceId, 'referenceId');
  assert.object(capability, 'capability');
  assert.string(capability.id, 'capability.id');
  assert.string(capability.invoker, 'capability.invoker');

  // insert the capability and get the updated record
  const now = Date.now();
  const meta = {created: now, updated: now, controller, referenceId};
  const record = {
    id: database.hash(capability.id),
    controller: database.hash(controller),
    invoker: database.hash(capability.invoker),
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
};

/**
 * Gets a received capability from storage. In addition to the `controller` of
 * the capability, either `id` or `referenceId` must be given.
 *
 * @param {string} controller the ID of the entity that stored the zcap.
 * @param {string} [id] the ID of the zcap.
 * @param {string} [referenceId] the application specific ID of the zcap.
 * @param {boolean} [explain=false] - An optional explain boolean.
 *
 * @return {Promise<Object | ExplainObject>} Resolves to `{capability, meta}`
 *   or an ExplainObject if `explain=true`.
 */
zcaps.get = async ({controller, id, referenceId, explain = false} = {}) => {
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
  const projection = {_id: 0, capability: 1, meta: 1};

  if(explain) {
    // 'find().limit(1)' is used here because 'findOne()' doesn't return a
    // cursor which allows the use of the explain function.
    const cursor = await collection.find(query, {projection}).limit(1);
    return cursor.explain('executionStats');
  }

  const record = collection.findOne(query, {projection});
  if(!record) {
    throw new BedrockError(
      'Authorization capability not found.',
      'NotFoundError',
      {controller, id, referenceId, httpStatusCode: 404, public: true});
  }

  return record;
};

/**
 * Retrieves all capabilities from storage that match the given query.
 *
 * @param {Object} [query = {}] the optional query to use.
 * @param {Object} [options = {}] options (eg: 'sort', 'limit', 'projection').
 * @param {boolean} [explain=false] - An optional explain boolean.
 *
 * @return {Promise<Array | ExplainObject>} Resolves to the records that
 *   matched the query or an ExplainObject if `explain=true`.
 */
zcaps.find = async ({
  query = {}, options = {}, explain = false
} = {}) => {
  const collection = database.collections['zcap-storage-zcap'];

  if(explain) {
    const cursor = await collection.find(query, options);
    return cursor.explain('executionStats');
  }

  return collection.find(query, options).toArray();
};

/**
 * Removes a capability from storage.
 *
 * @param {string} controller the ID of the entity that stored the zcap.
 * @param {string} [id] the ID of the zcap to remove.
 * @param {string} [referenceId] the application specific ID of the zcap to
 *   remove.
 * @param {boolean} [explain=false] - An optional explain boolean.
 *
 * @return {Promise<Boolean | ExplainObject>} resolves to `true` if a zcap was
 *   removed and `false` if not or an ExplainObject if `explain=true`.
 */
zcaps.remove = async ({controller, id, referenceId, explain = false} = {}) => {
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

  const result = await collection.deleteMany(query);
  return result.result.n !== 0;
};
