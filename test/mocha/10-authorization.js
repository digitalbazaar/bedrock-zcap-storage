/*!
 * Copyright (c) 2021-2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as brZcapStorage from '@bedrock/zcap-storage';
import * as database from '@bedrock/mongodb';
import * as helpers from './helpers.js';
import {mocks as mockData} from './mock-data.js';

describe('authorization API', () => {
  describe('insert API', async () => {
    beforeEach(async () => {
      const collectionName = 'zcap-storage-authorization';
      await helpers.removeCollection(collectionName);
    });
    it('properly inserts an authorization', async () => {
      let err;
      let result;
      const authorization = structuredClone(mockData.authorizations.alpha);
      try {
        result = await brZcapStorage.authorizations.insert({
          controller: authorization.controller,
          capability: authorization.capability
        });
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.authorization.should.eql(authorization);

      const collection = database.collections['zcap-storage-authorization'];
      const findResult = await collection.find({
        controller: helpers.hash(authorization.controller),
        id: helpers.hash(authorization.capability.id)
      }).toArray();
      findResult.should.have.length(1);
      findResult[0].authorization.should.eql(authorization);
    });
    it(`properly inserts an authorization with 'invocationTarget' being an ` +
      'object', async () => {
      let err;
      let result;
      const authorization = structuredClone(mockData.authorizations.alpha);
      authorization.capability.invocationTarget = {
        id: 'urn:uuid:e30d372c-7ab2-429c-91b0-03dc3bcc6289'
      };
      try {
        result = await brZcapStorage.authorizations.insert({
          controller: authorization.controller,
          capability: authorization.capability
        });
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.authorization.should.eql(authorization);

      const collection = database.collections['zcap-storage-authorization'];
      const findResult = await collection.find({
        controller: helpers.hash(authorization.controller),
        id: helpers.hash(authorization.capability.id)
      }).toArray();
      findResult.should.have.length(1);
      findResult[0].authorization.should.eql(authorization);
    });
    it(`returns DuplicateError on same 'id' and 'controller'`, async () => {
      const authorization = structuredClone(mockData.authorizations.alpha);

      // insert alpha authorization
      await brZcapStorage.authorizations.insert({
        controller: authorization.controller,
        capability: authorization.capability
      });

      // attempt to insert same authorization again
      let err;
      let result;
      try {
        result = await brZcapStorage.authorizations.insert({
          controller: authorization.controller,
          capability: authorization.capability
        });
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
      err.name.should.equal('DuplicateError');
    });
    it(`returns TypeError when 'invocationTarget.id' is not a string`,
      async () => {
        let err;
        let result;
        const authorization = structuredClone(mockData.authorizations.alpha);
        authorization.capability.invocationTarget = {
          id: {}
        };
        try {
          result = await brZcapStorage.authorizations.insert({
            controller: authorization.controller,
            capability: authorization.capability
          });
        } catch(e) {
          err = e;
        }
        should.not.exist(result);
        should.exist(err);
        err.name.should.equal('TypeError');
      });
    it(`returns Error when 'invocationTarget' is not an absolute URI`,
      async () => {
        let err;
        let result;
        const authorization = structuredClone(mockData.authorizations.alpha);
        authorization.capability.invocationTarget = '123456';
        try {
          result = await brZcapStorage.authorizations.insert({
            controller: authorization.controller,
            capability: authorization.capability
          });
        } catch(e) {
          err = e;
        }
        should.not.exist(result);
        should.exist(err);
        err.name.should.equal('Error');
      });
  });
  describe('get API', async () => {
    let authorization;
    beforeEach(async () => {
      const collectionName = 'zcap-storage-authorization';
      await helpers.removeCollection(collectionName);

      authorization = structuredClone(mockData.authorizations.alpha);
      await brZcapStorage.authorizations.insert({
        controller: authorization.controller,
        capability: authorization.capability
      });
    });
    it(`properly gets an authorization with 'controller' and 'id'`,
      async () => {
        let err;
        let result;
        try {
          result = await brZcapStorage.authorizations.get({
            controller: authorization.controller,
            id: authorization.capability.id
          });
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        should.exist(result);
        result.authorization.should.eql(authorization);
      });
    it(`properly gets an authorization with 'invocationTarget' and 'id'`,
      async () => {
        let err;
        let result;
        try {
          result = await brZcapStorage.authorizations.get({
            id: authorization.capability.id,
            invocationTarget: authorization.capability.invocationTarget
          });
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        should.exist(result);
        result.authorization.should.eql(authorization);
      });
    it(`properly gets an authorization with 'invocationTarget' an array of ` +
      `strings and 'id'`, async () => {
      let err;
      let result;
      try {
        result = await brZcapStorage.authorizations.get({
          id: authorization.capability.id,
          invocationTarget: [authorization.capability.invocationTarget]
        });
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.authorization.should.eql(authorization);
    });
    it(`returns AssertionError when 'invocationTarget' is not a string ` +
      'or array of strings', async () => {
      let err;
      let result;
      try {
        result = await brZcapStorage.authorizations.get({
          id: authorization.capability.id,
          invocationTarget: {}
        });
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
      err.name.should.equal('AssertionError');
    });
    it(`returns TypeError when no 'invocationTarget' or 'controller' ` +
      'is provided', async () => {
      let err;
      let result;
      try {
        result = await brZcapStorage.authorizations.get({
          id: authorization.capability.id
        });
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
      err.name.should.equal('TypeError');
    });
    it('returns NotFoundError when no authorization is found', async () => {
      let err;
      let result;
      try {
        result = await brZcapStorage.authorizations.get({
          controller: authorization.controller,
          id: '123456'
        });
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
      err.name.should.equal('NotFoundError');
    });
  });
  describe('find API', async () => {
    let authorization;
    beforeEach(async () => {
      const collectionName = 'zcap-storage-authorization';
      await helpers.removeCollection(collectionName);

      authorization = structuredClone(mockData.authorizations.alpha);
      await brZcapStorage.authorizations.insert({
        controller: authorization.controller,
        capability: authorization.capability
      });
    });
    it(`properly finds an authorization with a 'query'`,
      async () => {
        let err;
        let result;
        try {
          const query = {
            controller: helpers.hash(authorization.controller),
            id: helpers.hash(authorization.capability.id)
          };
          result = await brZcapStorage.authorizations.find({query});
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        should.exist(result);
        result[0].authorization.should.eql(authorization);
      });
  });
  describe('remove API', async () => {
    let authorization;
    beforeEach(async () => {
      const collectionName = 'zcap-storage-authorization';
      await helpers.removeCollection(collectionName);

      authorization = structuredClone(mockData.authorizations.alpha);
      await brZcapStorage.authorizations.insert({
        controller: authorization.controller,
        capability: authorization.capability
      });
    });
    it(`properly removes an authorization with a 'controller' and 'id'`,
      async () => {
        let err;
        let result;
        try {
          result = await brZcapStorage.authorizations.remove({
            controller: authorization.controller,
            id: authorization.capability.id
          });
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        should.exist(result);
        result.should.equal(true);
      });
  });
});
