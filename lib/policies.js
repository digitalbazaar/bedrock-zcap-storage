/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import * as database from '@bedrock/mongodb';
import assert from 'assert-plus';

const {util: {BedrockError}} = bedrock;

const COLLECTION_NAME = 'zcap-storage-policy';

bedrock.events.on('bedrock-mongodb.ready', async () => {
  await database.openCollections([COLLECTION_NAME]);
  await database.createIndexes([{
    collection: COLLECTION_NAME,
    fields: {controller: 1},
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
    throw new TypeError('Initial "policy.sequence" must be zero.');
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
  const projection = {_id: 0, policy: 0};
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
 */
export async function remove({controller} = {}) {
  assert.string(controller, 'controller');

  const query = {'policy.controller': controller};
  const collection = _getCollection();
  const result = await collection.deleteOne(query);
  if(result.deletedCount === 0) {
    throw new BedrockError('Profile agent not found.', {
      name: 'NotFoundError',
      details: {
        controller,
        httpStatusCode: 404,
        public: true
      }
    });
  }
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

/**
 * An object containing information on the query plan.
 *
 * @typedef {object} ExplainObject
 */
