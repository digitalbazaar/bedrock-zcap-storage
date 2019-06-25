/*!
 * Copyright (c) 2019 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const assert = require('assert-plus');
const bedrock = require('bedrock');
const database = require('bedrock-mongodb');
const {promisify} = require('util');
const {BedrockError} = bedrock.util;

// load config defaults
require('./config');

// module API
const api = {};
module.exports = api;

const delegated = api.delegated = {};
const received = api.received = {};

bedrock.events.on('bedrock-mongodb.ready', async () => {
  /* Note: There are two capability collections:

  1. The `delegatedZCap` collection stores capabilities for a party that
  has delegated to some invoker to allow them to take some action. The
  delegating party writes these capabilities to this collection after the
  application ensures they are authorized to delegate a capability for a given
  `invocationTarget`.

  2. The `receivedZCap` collection stores capabilities for a party that
  has received a capability to perform some action. The application must
  ensure that the receiving party is listed as an invoker on the capability.

  */
  await promisify(database.openCollections)(
    ['delegatedZCap', 'receivedZCap']);

  await promisify(database.createIndexes)([{
    // cover capability queries by invocationTarget and id; as this is a
    // unique index and IDs are controlled by the zcap creator, we scope
    // the index to the invocationTarget to prevent squatting on IDs and
    // assume applications will ensure zcaps written to storage were written
    // by parties authorized to delegate the zcap for the invocationTarget
    collection: 'delegatedZCap',
    fields: {invocationTarget: 1, id: 1},
    options: {unique: true, background: false}
  }, {
    // cover capability queries by delegatedBy and id; allows for delegators
    // to see all of the zcaps they have delegated
    collection: 'delegatedZCap',
    fields: {delegatedBy: 1, id: 1},
    options: {unique: true, background: false}
  }, {
    // enable queries by invoker and reference ID (reference IDs are
    // scoped to invokers)
    collection: 'receivedZCap',
    fields: {invoker: 1, referenceId: 1},
    options: {unique: true, background: false}
  }, {
    // enable queries by invoker and id; as this is a unique index and IDs
    // are controlled by the zcap creator, we scope the index to the invoker
    // to prevent entities from squatting on IDs
    collection: 'receivedZCap',
    fields: {invoker: 1, id: 1},
    options: {unique: true, background: false}
  }]);
});

/**
 * Inserts a delegated capability into storage.
 *
 * @param {string} delegatedBy the ID of the entity that delegated the
 *   capability.
 * @param {Object} capability the capability to insert.
 *
 * @return {Promise<Object>} resolves to the database record.
 */
delegated.insert = async ({delegatedBy, capability}) => {
  assert.string(delegatedBy, 'delegatedBy');
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
    delegatedBy: database.hash(delegatedBy),
    meta,
    capability
  };

  try {
    const result = await database.collections.delegatedZCap.insert(
      record, database.writeOptions);
    return result.ops[0];
  } catch(e) {
    if(!database.isDuplicateError(e)) {
      throw e;
    }
    throw new BedrockError(
      'Duplicate delegated authorization capability.',
      'DuplicateError', {
        public: true,
        httpStatusCode: 409
      }, e);
  }
};

/**
 * Gets a delegated capability from storage. In addition to the `id` of the
 * capability, either `delegatedBy` or `invocationTarget` must be given.
 *
 * @param {string} id the ID of the capability.
 * @param {string} [delegatedBy] the ID of the entity that delegated the zcap.
 * @param {string} [invocationTarget] the `invocationTarget` for the zcap.
 *
 * @return {Promise<Object>} resolves to `{capability, meta}`.
 */
delegated.get = async ({id, delegatedBy, invocationTarget}) => {
  assert.string(id, 'id');
  assert.optionalString(delegatedBy, 'delegatedBy');
  assert.optionalString(invocationTarget, 'invocationTarget');
  if(!(delegatedBy && invocationTarget)) {
    throw new TypeError(
      'Either "delegatedBy" or "invocationTarget" must be given.');
  }

  const query = {
    id: database.hash(id)
  };
  if(delegatedBy) {
    query.delegatedBy = database.hash(delegatedBy);
  }
  if(invocationTarget) {
    query.invocationTarget = database.hash(invocationTarget);
  }

  const record = await database.collections.delegatedZCap.findOne(
    query, {_id: 0, capability: 1, meta: 1});
  if(!record) {
    throw new BedrockError(
      'Authorization capability not found.',
      'NotFoundError',
      {id, invocationTarget, delegatedBy, httpStatusCode: 404, public: true});
  }

  return record;
};

/**
 * Retrieves all delegated capabilities from storage that match the given query.
 *
 * @param {Object} query the optional query to use (default: {}).
 * @param {Object} fields optional fields to include or exclude (default: {}).
 * @param {Object} options options (eg: 'sort', 'limit').
 *
 * @return {Promise<Array>} resolves to the records that matched the query.
 */
delegated.find = async ({query = {}, fields = {}, options = {}}) => {
  return database.collections.delegatedZCap.find(
    query, fields, options).toArray();
};

/**
 * Removes a delegated capability from storage.
 *
 * @param {string} delegatedBy the ID of the entity that delegated the zcap.
 * @param {string} id the ID of the zcap to remove.
 *
 * @return {Promise<Boolean>} resolves to `true` if a zcap was removed and
 *   `false` if not.
 */
delegated.remove = async ({delegatedBy, id}) => {
  assert.string(delegatedBy, 'delegatedBy');
  assert.string(id, 'id');

  const result = await database.collections.delegatedZCap.remove(
    {delegatedBy: database.hash(delegatedBy), id: database.hash(id)});
  return result.result.n !== 0;
};

/**
 * Inserts a received capability into storage.
 *
 * @param {string} referenceId an application specific ID for the zcap, scoped
 *   to the invoker.
 * @param {Object} capability the capability to insert.
 *
 * @return {Promise<Object>} resolves to the database record.
 */
received.insert = async ({referenceId, capability}) => {
  assert.string(referenceId, 'referenceId');
  assert.object(capability, 'capability');
  assert.string(capability.id, 'capability.id');
  assert.string(capability.invoker, 'capability.invoker');

  // insert the capability and get the updated record
  const now = Date.now();
  const meta = {created: now, updated: now};
  const record = {
    id: database.hash(capability.id),
    invoker: database.hash(capability.invoker),
    referenceId: database.hash(referenceId),
    meta,
    capability
  };

  try {
    const result = await database.collections.receivedZCap.insert(
      record, database.writeOptions);
    return result.ops[0];
  } catch(e) {
    if(!database.isDuplicateError(e)) {
      throw e;
    }
    throw new BedrockError(
      'Duplicate received authorization capability.',
      'DuplicateError', {
        public: true,
        httpStatusCode: 409
      }, e);
  }
};

/**
 * Gets a received capability from storage. In addition to the `invoker` of the
 * capability, either `id` or `referenceId` must be given.
 *
 * @param {string} invoker the ID of the invoker of the zcap.
 * @param {string} [id] the ID of the zcap.
 * @param {string} [referenceId] the application specific ID of the zcap.
 *
 * @return {Promise<Object>} resolves to `{capability, meta}`.
 */
received.get = async ({invoker, id, referenceId}) => {
  assert.string(invoker, 'invoker');
  assert.optionalString(id, 'id');
  assert.optionalString(referenceId, 'referenceId');
  if(!(id && referenceId)) {
    throw new TypeError('Either "id" or "referenceId" must be given.');
  }

  const query = {
    invoker: database.hash(invoker)
  };
  if(id) {
    query.id = database.hash(id);
  }
  if(referenceId) {
    query.referenceId = database.hash(referenceId);
  }

  const record = await database.collections.receivedZCap.findOne(
    query, {_id: 0, capability: 1, meta: 1});
  if(!record) {
    throw new BedrockError(
      'Authorization capability not found.',
      'NotFoundError',
      {invoker, id, referenceId, httpStatusCode: 404, public: true});
  }

  return record;
};

/**
 * Retrieves all received capabilities from storage that match the given query.
 *
 * @param {Object} query the optional query to use (default: {}).
 * @param {Object} fields optional fields to include or exclude (default: {}).
 * @param {Object} options options (eg: 'sort', 'limit').
 *
 * @return {Promise<Array>} resolves to the records that matched the query.
 */
received.find = async ({query = {}, fields = {}, options = {}}) => {
  return database.collections.receivedZCap.find(
    query, fields, options).toArray();
};

/**
 * Removes a received capability from storage.
 *
 * @param {string} invoker the ID of the entity authorized to invoke the zcap.
 * @param {string} id the ID of the zcap to remove.
 *
 * @return {Promise<Boolean>} resolves to `true` if a zcap was removed and
 *   `false` if not.
 */
received.remove = async ({invoker, id}) => {
  assert.string(invoker, 'invoker');
  assert.string(id, 'id');

  const result = await database.collections.receivedZCap.remove(
    {invoker: database.hash(invoker), id: database.hash(id)});
  return result.result.n !== 0;
};
