/*!
 * Copyright (c) 2019-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const brZcapStorage = require('bedrock-zcap-storage');
const database = require('bedrock-mongodb');
const mockData = require('./mock-data');
const {util: {clone}} = require('bedrock');
const helpers = require('./helpers.js');

describe('revocation API', () => {
  describe('insert API', () => {
    it('properly inserts a revocation', async () => {
      let err;
      let result;
      const revocation = clone(mockData.revocations.alpha);
      try {
        result = await brZcapStorage.revocations.insert(revocation);
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.capability.should.eql(revocation.capability);

      const collection = database.collections['zcap-storage-revocation'];
      const findResult = await collection.find({
        'capability.id': revocation.capability.id,
      }).toArray();
      findResult.should.have.length(1);
      findResult[0].capability.should.eql(revocation.capability);
    });
    it('inserts a revocation with capability expiration date',
      async () => {
        let err;
        let result;
        const revocation = clone(mockData.revocations.gamma);
        try {
          result = await brZcapStorage.revocations.insert(revocation);
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        should.exist(result);
        result.capability.should.eql(revocation.capability);

        const collection = database.collections['zcap-storage-revocation'];
        const findResult = await collection.find({
          'capability.id': revocation.capability.id,
        }).toArray();
        findResult.should.have.length(1);
        findResult[0].capability.should.eql(revocation.capability);
      });
    it('returns DuplicateError on same id and delegator', async () => {
      const revocation = clone(mockData.revocations.beta);

      // insert beta revocation
      await brZcapStorage.revocations.insert(revocation);

      // attempt to insert same revocation again
      let err;
      let result;
      try {
        result = await brZcapStorage.revocations.insert(revocation);
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
      err.name.should.equal('DuplicateError');
    });
  });
  describe('count API', () => {
    let revocation;
    before(async () => {
      const collectionName = 'zcap-storage-revocation';
      await helpers.removeCollection(collectionName);

      revocation = clone(mockData.revocations.alpha);
      await brZcapStorage.revocations.insert(revocation);
    });
    it(`returns a count of all revocations with the given 'rootTarget'`,
      async () => {
        const rootTarget = revocation.rootTarget;
        let result;
        let err;
        try {
          result = await brZcapStorage.revocations.count({rootTarget});
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        should.exist(result);
        result.should.be.an('object');
        result.count.should.equal(1);
      });
  });
  describe('isRevoked API', () => {
    let revocation;
    before(async () => {
      const collectionName = 'zcap-storage-revocation';
      await helpers.removeCollection(collectionName);

      revocation = clone(mockData.revocations.alpha);
      revocation.capability.id = '5acb9314-dd56-43c0-bb98-af6a940f69dc';
      await brZcapStorage.revocations.insert(revocation);
    });
    it('returns true on a matching revocation', async () => {
      const capabilities = [{
        capabilityId: revocation.capability.id,
        delegator: revocation.delegator,
      }];
      let result;
      let err;
      try {
        result = await brZcapStorage.revocations.isRevoked({capabilities});
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.should.be.a('boolean');
      result.should.be.true;
    });
    it('returns false on unknown delegator', async () => {
      const capabilities = [{
        capabilityId: revocation.capability.id,
        // an unknown delegator
        delegator: '8eb105d5-59ed-47f1-8364-5c77258715a4',
      }];
      let result;
      let err;
      try {
        result = await brZcapStorage.revocations.isRevoked({capabilities});
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.should.be.a('boolean');
      result.should.be.false;
    });
    it('returns false on unknown id', async () => {
      const capabilities = [{
        // an unknown id
        capabilityId: '758444cb-007f-480d-a7be-273308fdd1b0',
        delegator: revocation.delegator,
      }];
      let result;
      let err;
      try {
        result = await brZcapStorage.revocations.isRevoked({capabilities});
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.should.be.a('boolean');
      result.should.be.false;
    });
    it('returns false on unknown id and delegator', async () => {
      const capabilities = [{
        // an unknown id
        capabilityId: '758444cb-007f-480d-a7be-273308fdd1b0',
        // an unknown delegator
        delegator: '8eb105d5-59ed-47f1-8364-5c77258715a4',
      }];
      let result;
      let err;
      try {
        result = await brZcapStorage.revocations.isRevoked({capabilities});
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.should.be.a('boolean');
      result.should.be.false;
    });
  });
});
