/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as brZcapStorage from '@bedrock/zcap-storage';
import * as database from '@bedrock/mongodb';
import * as helpers from './helpers.js';
import {mocks as mockData} from './mock-data.js';

describe('zcap policies API', () => {
  describe('insert API', async () => {
    beforeEach(async () => {
      const collectionName = 'zcap-storage-policy';
      await helpers.removeCollection(collectionName);
    });
    it('properly inserts a policy', async () => {
      let err;
      let result;
      const policy = structuredClone(mockData.policies.alpha);
      try {
        result = await brZcapStorage.policies.insert({policy});
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.policy.controller.should.equal(policy.controller);
      result.policy.delegate.should.equal(policy.delegate);
      result.policy.sequence.should.equal(policy.sequence);

      const collection = database.collections['zcap-storage-policy'];
      const findResult = await collection.find({
        'policy.controller': policy.controller,
        'policy.delegate': policy.delegate
      }).toArray();
      findResult.should.have.length(1);
      findResult[0].policy.controller.should.eql(policy.controller);
      findResult[0].policy.delegate.should.eql(policy.delegate);
    });
    it('properly inserts a "refresh=false" policy', async () => {
      let err;
      let result;
      const policy = structuredClone(mockData.policies.alpha);
      policy.refresh = false;
      try {
        result = await brZcapStorage.policies.insert({policy});
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.policy.controller.should.equal(policy.controller);
      result.policy.delegate.should.equal(policy.delegate);
      result.policy.sequence.should.equal(policy.sequence);

      const collection = database.collections['zcap-storage-policy'];
      const findResult = await collection.find({
        'policy.controller': policy.controller,
        'policy.delegate': policy.delegate
      }).toArray();
      findResult.should.have.length(1);
      findResult[0].policy.controller.should.eql(policy.controller);
      findResult[0].policy.delegate.should.eql(policy.delegate);
    });
    it(`throws when 'sequence' is not zero`, async () => {
      const policy = structuredClone(mockData.policies.alpha);
      policy.sequence = 1;

      let err;
      let result;
      try {
        result = await brZcapStorage.policies.insert({policy});
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
    });
    it(`throws DuplicateError on same 'controller' and 'delegate'`,
      async () => {
        const policy = structuredClone(mockData.policies.alpha);

        // insert alpha policy
        await brZcapStorage.policies.insert({policy});

        // attempt to insert same policy again
        let err;
        let result;
        try {
          result = await brZcapStorage.policies.insert({policy});
        } catch(e) {
          err = e;
        }
        should.not.exist(result);
        should.exist(err);
        err.name.should.equal('DuplicateError');
      });
  });
  describe('count API', async () => {
    let policy;
    beforeEach(async () => {
      const collectionName = 'zcap-storage-policy';
      await helpers.removeCollection(collectionName);

      policy = structuredClone(mockData.policies.alpha);
      await brZcapStorage.policies.insert({policy});
    });
    it(`properly gets a policy count for 'controller'`,
      async () => {
        const {controller} = policy;
        let err;
        let result;
        try {
          result = await brZcapStorage.policies.count({controller});
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        should.exist(result);
        result.count.should.equal(1);
      });
    it(`throws when no 'controller' is provided`, async () => {
      let err;
      let result;
      try {
        result = await brZcapStorage.policies.count({});
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
    });
  });
  describe('get API', async () => {
    let policy;
    beforeEach(async () => {
      const collectionName = 'zcap-storage-policy';
      await helpers.removeCollection(collectionName);

      policy = structuredClone(mockData.policies.alpha);
      await brZcapStorage.policies.insert({policy});
    });
    it(`properly gets a policy with 'controller' and 'delegate'`,
      async () => {
        const {controller, delegate} = policy;
        let err;
        let result;
        try {
          result = await brZcapStorage.policies.get({controller, delegate});
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        should.exist(result);
        result.policy.should.deep.equal(policy);
      });
    it(`throws when no 'controller' is provided`, async () => {
      let err;
      let result;
      try {
        result = await brZcapStorage.policies.get({});
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
    });
    it(`throws when no 'delegate' is provided`, async () => {
      const {controller} = policy;
      let err;
      let result;
      try {
        result = await brZcapStorage.policies.get({controller});
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
    });
    it('throws NotFoundError when no policy is found', async () => {
      let err;
      let result;
      try {
        result = await brZcapStorage.policies.get({
          controller: '123456', delegate: '654321'
        });
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
      err.name.should.equal('NotFoundError');
    });
  });
  describe('update API', async () => {
    beforeEach(async () => {
      const collectionName = 'zcap-storage-policy';
      await helpers.removeCollection(collectionName);
    });
    it('properly updates a policy', async () => {
      let err;
      let result;
      const policy = structuredClone(mockData.policies.alpha);
      await brZcapStorage.policies.insert({policy});
      try {
        policy.sequence++;
        result = await brZcapStorage.policies.update({policy});
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.policy.controller.should.equal(policy.controller);
      result.policy.sequence.should.equal(1);

      const collection = database.collections['zcap-storage-policy'];
      const findResult = await collection.find({
        'policy.controller': policy.controller
      }).toArray();
      findResult.should.have.length(1);
      findResult[0].policy.controller.should.eql(policy.controller);
      findResult[0].policy.delegate.should.eql(policy.delegate);
    });
    it(`throws InvalidStateError with improper 'sequence' value`, async () => {
      const policy = structuredClone(mockData.policies.alpha);
      await brZcapStorage.policies.insert({policy});

      let err;
      let result;
      try {
        policy.sequence = 2;
        result = await brZcapStorage.policies.update({policy});
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
      err.name.should.equal('InvalidStateError');
    });
  });
  describe('remove API', async () => {
    let policy;
    beforeEach(async () => {
      const collectionName = 'zcap-storage-policy';
      await helpers.removeCollection(collectionName);

      policy = structuredClone(mockData.policies.alpha);
      await brZcapStorage.policies.insert({policy});
    });
    it(`properly removes a policy with a 'controller' and 'delegate'`,
      async () => {
        const {controller, delegate} = policy;
        let err;
        let result;
        try {
          result = await brZcapStorage.policies.remove({
            controller, delegate
          });
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        should.exist(result);
        result.should.equal(true);
      });
    it(`throws when no 'delegate' is provided`, async () => {
      const {controller} = policy;
      let err;
      let result;
      try {
        result = await brZcapStorage.policies.remove({controller});
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
    });
    it(`properly removes a policy w/ 'controller', 'delegate', 'sequence'`,
      async () => {
        const {controller, delegate} = policy;
        let err;
        let result;
        try {
          result = await brZcapStorage.policies.remove({
            controller, delegate, sequence: 0
          });
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        should.exist(result);
        result.should.equal(true);
      });
    it(`removes no policy w/ mismatched 'controller', 'delegate', 'sequence'`,
      async () => {
        const {controller, delegate} = policy;
        let err;
        let result;
        try {
          result = await brZcapStorage.policies.remove({
            controller, delegate, sequence: 1
          });
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        should.exist(result);
        result.should.equal(false);
      });
    it(`throws when no 'controller' is provided`, async () => {
      let err;
      let result;
      try {
        result = await brZcapStorage.policies.remove({});
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
    });
  });
});
