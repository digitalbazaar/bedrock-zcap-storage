/*!
 * Copyright (c) 2019-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const assert = require('assert-plus');
const bedrock = require('bedrock');
const database = require('bedrock-mongodb');
const {util: {BedrockError}} = bedrock;

bedrock.events.on('bedrock-mongodb.ready', async () => {
  await database.openCollections(['zcap-revocation']);
  await database.createIndexes([{
    collection: 'zcap-revocation',
    fields: {'meta.delegator': 1, 'capability.id': 1},
    options: {unique: true, background: false}
  }]);
});

/**
 * Inserts a zcap revocation into storage.
 *
 * @param {string} delegator - The ID of the entity that delegated the
 *   revocation.
 * @param {Object} capability - The capability to insert.
 *
 * @return {Promise<Object>} the database record.
 */
exports.insert = async ({delegator, capability} = {}) => {
  assert.string(delegator, 'delegator');
  assert.object(capability, 'capability');
  assert.string(capability.id, 'capability.id');

  const now = Date.now();
  const meta = {
    created: now, updated: now,
    delegator
  };
  const record = {
    capability,
    meta,
  };

  try {
    const result = await database.collections['zcap-revocation'].insertOne(
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
 *
 * @return {Promise<boolean>} At least one of the capabilities has been revoked.
 */
exports.isRevoked = async ({capabilities}) => {
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

  const revoked = await database.collections['zcap-revocation'].findOne(
    query, {projection: {_id: 1}});

  return !!revoked;
};
