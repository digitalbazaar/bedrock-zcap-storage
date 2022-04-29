/*!
 * Copyright (c) 2021-2022 Digital Bazaar, Inc. All rights reserved.
 */
import * as brZcapStorage from '@bedrock/zcap-storage';
import * as database from '@bedrock/mongodb';
import * as helpers from './helpers.js';
import {klona} from 'klona';
import {mocks as mockData} from './mock-data.js';

describe('zcaps API', () => {
  describe('insert API', async () => {
    beforeEach(async () => {
      const collectionName = 'zcap-storage-zcap';
      await helpers.removeCollection(collectionName);
    });
    it('properly inserts a zcap', async () => {
      let err;
      let result;
      const zcap = klona(mockData.zcaps.alpha);
      const {controller, referenceId, capability} = zcap;
      try {
        result = await brZcapStorage.zcaps.insert({
          controller,
          referenceId,
          capability
        });
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.controller.should.equal(helpers.hash(controller));
      result.id.should.eql(helpers.hash(capability.id));

      const collection = database.collections['zcap-storage-zcap'];
      const findResult = await collection.find({
        controller: helpers.hash(controller),
        id: helpers.hash(capability.id),
      }).toArray();
      findResult.should.have.length(1);
      findResult[0].controller.should.eql(helpers.hash(controller));
      findResult[0].id.should.eql(helpers.hash(capability.id));
    });
    it(`returns DuplicateError on same 'controller', 'referenceId' and ` +
      `'capability'`, async () => {
      const zcap = klona(mockData.zcaps.alpha);
      const {controller, referenceId, capability} = zcap;

      // insert alpha zcap
      await brZcapStorage.zcaps.insert({
        controller,
        referenceId,
        capability
      });

      // attempt to insert same zcap again
      let err;
      let result;
      try {
        result = await brZcapStorage.zcaps.insert({
          controller,
          referenceId,
          capability
        });
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
      err.name.should.equal('DuplicateError');
    });
  });
  describe('get API', async () => {
    let zcap;
    beforeEach(async () => {
      const collectionName = 'zcap-storage-zcap';
      await helpers.removeCollection(collectionName);

      zcap = klona(mockData.zcaps.alpha);
      const {controller, referenceId, capability} = zcap;
      await brZcapStorage.zcaps.insert({
        controller,
        referenceId,
        capability
      });
    });
    it(`properly gets a zcap with 'controller' and 'id'`,
      async () => {
        const {controller, capability} = zcap;
        let err;
        let result;
        try {
          result = await brZcapStorage.zcaps.get({
            controller,
            id: capability.id
          });
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        should.exist(result);
        result.capability.should.eql(capability);
      });
    it(`properly gets a zcap with 'controller' and 'referenceId'`,
      async () => {
        const {controller, referenceId, capability} = zcap;
        let err;
        let result;
        try {
          result = await brZcapStorage.zcaps.get({
            controller,
            referenceId
          });
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        should.exist(result);
        result.capability.should.eql(capability);
      });
    it(`returns TypeError when no 'id' or 'referenceId' is provided`,
      async () => {
        const {controller} = zcap;
        let err;
        let result;
        try {
          result = await brZcapStorage.zcaps.get({
            controller
          });
        } catch(e) {
          err = e;
        }
        should.not.exist(result);
        should.exist(err);
        err.name.should.equal('TypeError');
      });
    it('returns NotFoundError when no zcap is found', async () => {
      const {capability} = zcap;
      let err;
      let result;
      try {
        result = await brZcapStorage.zcaps.get({
          controller: '123456',
          id: capability.id
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
    let zcap;
    beforeEach(async () => {
      const collectionName = 'zcap-storage-zcap';
      await helpers.removeCollection(collectionName);

      zcap = klona(mockData.zcaps.alpha);
      const {controller, referenceId, capability} = zcap;
      await brZcapStorage.zcaps.insert({
        controller,
        referenceId,
        capability
      });
    });
    it(`properly finds a zcap with a 'query'`,
      async () => {
        const {controller, capability} = zcap;
        let err;
        let result;
        try {
          const query = {
            controller: helpers.hash(controller),
            id: helpers.hash(capability.id)
          };
          result = await brZcapStorage.zcaps.find({query});
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        should.exist(result);
        result[0].controller.should.eql(helpers.hash(controller));
        result[0].id.should.eql(helpers.hash(capability.id));
      });
  });
  describe('remove API', async () => {
    let zcap;
    beforeEach(async () => {
      const collectionName = 'zcap-storage-zcap';
      await helpers.removeCollection(collectionName);

      zcap = klona(mockData.zcaps.alpha);
      const {controller, referenceId, capability} = zcap;
      await brZcapStorage.zcaps.insert({
        controller,
        referenceId,
        capability
      });
    });
    it(`properly removes a zcap with a 'controller' and 'id'`,
      async () => {
        // first get zcap to prime cache
        const {controller, capability} = zcap;
        await brZcapStorage.zcaps.get({controller, id: capability.id});

        // now delete zcap
        let err;
        let result;
        try {
          result = await brZcapStorage.zcaps.remove({
            controller,
            id: capability.id
          });
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        should.exist(result);
        result.should.equal(true);

        // get with `cache = false` should return not found
        try {
          await brZcapStorage.zcaps.get({
            controller,
            id: capability.id,
            useCache: false
          });
        } catch(e) {
          err = e;
        }
        should.exist(err);
        err.name.should.equal('NotFoundError');
      });
    it(`properly removes a zcap with a 'controller' and 'referenceId'`,
      async () => {
        const {controller, referenceId} = zcap;
        let err;
        let result;
        try {
          result = await brZcapStorage.zcaps.remove({
            controller,
            referenceId
          });
        } catch(e) {
          err = e;
        }
        assertNoError(err);
        should.exist(result);
        result.should.equal(true);
      });
    it(`returns TypeError when no 'id' or 'referenceId' is provided`,
      async () => {
        const {controller} = zcap;
        let err;
        let result;
        try {
          result = await brZcapStorage.zcaps.remove({
            controller
          });
        } catch(e) {
          err = e;
        }
        should.not.exist(result);
        should.exist(err);
        err.name.should.equal('TypeError');
      });
  });
});
