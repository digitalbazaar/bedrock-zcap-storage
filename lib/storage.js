/*!
 * Copyright (c) 2019-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const assert = require('assert-plus');
const bedrock = require('bedrock');
const database = require('bedrock-mongodb');
const {promisify} = require('util');
const {util: {BedrockError}} = bedrock;

// module API
const api = {};
module.exports = api;

const authorizations = api.authorizations = {};
api.revocations = require('./storage-revocations');
const zcaps = api.zcaps = {};

bedrock.events.on('bedrock-mongodb.ready', async () => {
  /* Note: There are two capability collections:

  1. The `zcap-authorization` collection is used to store capabilities that are
  actively authorized for use. The authorizing party (stored as the
  `controller`) writes these capabilities to this collection after an
  application ensures they are permitted to do so for a given
  `invocationTarget`. Typically, the delegator for a given authorization
  capability is the same party that writes the capability to the
  `authorization` collection. An application may later check storage for these
  active capabilities when verifying a capability invocation by querying for
  the capability by its ID and invocationTarget.

  2. The `zcap-storage` collection is used to store capabilities for an
  invoker to later invoke.

  */
  await promisify(database.openCollections)([
    'zcap-authorization',
    'zcap-storage'
  ]);

  await promisify(database.createIndexes)([{
    // cover queries by invocationTarget and id; as this is a unique index and
    // IDs are controlled by the capability creator, we scope the index to the
    // invocationTarget to prevent squatting on IDs and assume applications
    // will ensure authorizations written to storage were written by parties
    // authorized to delegate the zcap for the invocationTarget
    collection: 'zcap-authorization',
    fields: {invocationTarget: 1, id: 1},
    options: {unique: true, background: false}
  }, {
    // cover queries by controller of the authorization and id; allows for
    // controllers to see all of the zcaps they have authorized via storage
    collection: 'zcap-authorization',
    fields: {controller: 1, id: 1},
    options: {unique: true, background: false}
  }, {
    // enable queries by controller and reference ID (reference IDs are
    // scoped to controllers)
    collection: 'zcap-storage',
    fields: {controller: 1, referenceId: 1},
    options: {unique: true, background: false}
  }, {
    // enable queries by controller and id; as this is a unique index and IDs
    // are controlled by the zcap creator, we scope the index to the controller
    // to prevent entities from squatting on IDs
    collection: 'zcap-storage',
    fields: {controller: 1, id: 1},
    options: {unique: true, background: false}
  }, {
    // enable queries by controller and invoker
    collection: 'zcap-storage',
    fields: {controller: 1, invoker: 1},
    options: {unique: false, background: false}
  }]);
});

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
    const result = await database.collections['zcap-authorization'].insertOne(
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
 *
 * @return {Promise<Object>} resolves to `{capability, meta}`.
 */
authorizations.get = async ({id, controller, invocationTarget} = {}) => {
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

  const record = await database.collections['zcap-authorization'].findOne(
    query, {_id: 0, authorization: 1, meta: 1});
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
 * @param {Object} query the optional query to use (default: {}).
 * @param {Object} fields optional fields to include or exclude (default: {}).
 * @param {Object} options options (eg: 'sort', 'limit').
 *
 * @return {Promise<Array>} resolves to the records that matched the query.
 */
authorizations.find = async ({query = {}, fields = {}, options = {}}) => {
  // FIXME remove options.fields from all libraries that call on zcap-storage
  // instead use options.projection
  if(fields && options.projection) {
    throw new TypeError(
      '"fields" or "options.projection" must be given, not both.');
  }
  options.projection = options.projection || fields;
  return database.collections['zcap-authorization'].find(
    query, options).toArray();
};

/**
 * Removes an authorization from storage.
 *
 * @param {string} controller the ID of the entity that stored the
 *   authorization.
 * @param {string} id the ID of the zcap to remove.
 *
 * @return {Promise<Boolean>} resolves to `true` if a zcap was removed and
 *   `false` if not.
 */
authorizations.remove = async ({controller, id} = {}) => {
  assert.string(controller, 'controller');
  assert.string(id, 'id');

  const result = await database.collections['zcap-authorization'].deleteMany(
    {controller: database.hash(controller), id: database.hash(id)});
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
    const result = await database.collections['zcap-storage'].insertOne(
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
 * Gets a received capability from storage. In addition to the `controller` of
 * the capability, either `id` or `referenceId` must be given.
 *
 * @param {string} controller the ID of the entity that stored the zcap.
 * @param {string} [id] the ID of the zcap.
 * @param {string} [referenceId] the application specific ID of the zcap.
 *
 * @return {Promise<Object>} resolves to `{capability, meta}`.
 */
zcaps.get = async ({controller, id, referenceId} = {}) => {
  assert.string(controller, 'controller');
  assert.optionalString(id, 'id');
  assert.optionalString(referenceId, 'referenceId');
  if(!(id || referenceId)) {
    throw new TypeError('Either "id" or "referenceId" must be given.');
  }

  const query = {controller: database.hash(controller)};
  if(id) {
    query.id = database.hash(id);
  }
  if(referenceId) {
    query.referenceId = database.hash(referenceId);
  }
  const record = await database.collections['zcap-storage'].findOne(
    query, {_id: 0, capability: 1, meta: 1});
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
 * @param {Object} query the optional query to use (default: {}).
 * @param {Object} fields optional fields to include or exclude (default: {}).
 * @param {Object} options options (eg: 'sort', 'limit').
 *
 * @return {Promise<Array>} resolves to the records that matched the query.
 */
zcaps.find = async ({query = {}, fields = {}, options = {}}) => {
  // FIXME remove options.fields from all libraries that call on zcap-storage
  // instead use options.projection
  if(fields && options.projection) {
    throw new TypeError(
      '"fields" or "options.projection" must be given, not both.');
  }
  options.projection = options.projection || fields;
  return database.collections['zcap-storage'].find(query, options).toArray();
};

/**
 * Removes a capability from storage.
 *
 * @param {string} controller the ID of the entity that stored the zcap.
 * @param {string} [id] the ID of the zcap to remove.
 * @param {string} [referenceId] the application specific ID of the zcap to
 *   remove.
 *
 * @return {Promise<Boolean>} resolves to `true` if a zcap was removed and
 *   `false` if not.
 */
zcaps.remove = async ({controller, id, referenceId} = {}) => {
  assert.string(controller, 'controller');
  assert.optionalString(id, 'id');
  assert.optionalString(referenceId, 'referenceId');
  if(!(id || referenceId)) {
    throw new TypeError('Either "id" or "referenceId" must be given.');
  }

  const query = {controller: database.hash(controller)};
  if(id) {
    query.id = database.hash(id);
  }
  if(referenceId) {
    query.referenceId = database.hash(referenceId);
  }
  const result = await database.collections['zcap-storage'].deleteMany(query);
  return result.result.n !== 0;
};
