/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const brZcapStorage = require('bedrock-zcap-storage');
const mockData = require('./mock-data');
const helpers = require('./helpers.js');
const {util: {uuid}} = require('bedrock');

describe('Authorizations Database Tests', () => {
  describe('Indexes', async () => {
    beforeEach(async () => {
      const collectionName = 'zcap-storage-authorization';
      await helpers.removeCollection(collectionName);

      // two authorizations are inserted here in order to do proper assertions
      // for 'nReturned', 'totalKeysExamined' and 'totalDocsExamined'.
      await brZcapStorage.authorizations.insert({
        controller: mockData.authorizations.alpha.controller,
        capability: mockData.authorizations.alpha.capability
      });
      await brZcapStorage.authorizations.insert({
        controller: mockData.authorizations.beta.controller,
        capability: mockData.authorizations.beta.capability
      });
    });
    it(`is properly indexed for 'id' and 'invocationTarget' in get()`,
      async () => {
        const {capability} = mockData.authorizations.alpha;
        const {executionStats} = await brZcapStorage.authorizations.get({
          id: capability.id,
          invocationTarget: capability.invocationTarget,
          explain: true
        });
        executionStats.nReturned.should.equal(1);
        executionStats.totalKeysExamined.should.equal(1);
        executionStats.totalDocsExamined.should.equal(1);
        executionStats.executionStages.inputStage.inputStage.inputStage.stage
          .should.equal('IXSCAN');
        executionStats.executionStages.inputStage.inputStage.inputStage
          .keyPattern.should.eql({invocationTarget: 1, id: 1});
      });
    it(`is properly indexed for 'id' and 'controller' in get()`,
      async () => {
        const {controller, capability} = mockData.authorizations.alpha;
        const {executionStats} = await brZcapStorage.authorizations.get({
          id: capability.id,
          controller,
          explain: true
        });
        executionStats.nReturned.should.equal(1);
        executionStats.totalKeysExamined.should.equal(1);
        executionStats.totalDocsExamined.should.equal(1);
        executionStats.executionStages.inputStage.inputStage.inputStage.stage
          .should.equal('IXSCAN');
        executionStats.executionStages.inputStage.inputStage.inputStage
          .keyPattern.should.eql({controller: 1, id: 1});
      });
    it(`is properly indexed for 'id' and 'invocationTarget' in find()`,
      async () => {
        const {capability} = mockData.authorizations.alpha;
        const query = {
          invocationTarget: helpers.hash(capability.invocationTarget),
          id: helpers.hash(capability.id)
        };
        const {executionStats} = await brZcapStorage.authorizations.find({
          query,
          explain: true
        });
        executionStats.nReturned.should.equal(1);
        executionStats.totalKeysExamined.should.equal(1);
        executionStats.totalDocsExamined.should.equal(1);
        executionStats.executionStages.inputStage.stage.should.equal('IXSCAN');
        executionStats.executionStages.inputStage.keyPattern.should.eql({
          invocationTarget: 1, id: 1});
      });
    it(`is properly indexed for 'id' and 'controller' in find()`,
      async () => {
        const {controller, capability} = mockData.authorizations.alpha;
        const query = {
          controller: helpers.hash(controller),
          id: helpers.hash(capability.id)
        };
        const {executionStats} = await brZcapStorage.authorizations.find({
          query,
          explain: true
        });
        executionStats.nReturned.should.equal(1);
        executionStats.totalKeysExamined.should.equal(1);
        executionStats.totalDocsExamined.should.equal(1);
        executionStats.executionStages.inputStage.stage.should.equal('IXSCAN');
        executionStats.executionStages.inputStage.keyPattern.should.eql({
          controller: 1, id: 1});
      });
    it(`is properly indexed for 'id' and 'controller' in remove()`,
      async () => {
        const {controller, capability} = mockData.authorizations.alpha;
        const {executionStats} = await brZcapStorage.authorizations.remove({
          id: capability.id,
          controller,
          explain: true
        });
        executionStats.nReturned.should.equal(1);
        executionStats.totalKeysExamined.should.equal(1);
        executionStats.totalDocsExamined.should.equal(1);
        executionStats.executionStages.inputStage.stage.should.equal('IXSCAN');
        executionStats.executionStages.inputStage.keyPattern.should.eql({
          controller: 1, id: 1});
      });
  });
});

describe('ZCaps Database Tests', () => {
  describe('Indexes', async () => {
    before(async () => {
      const collectionName = 'zcap-storage-zcap';
      await helpers.removeCollection(collectionName);

      // multiple zcaps are inserted here in order to do proper assertions
      // for 'nReturned', 'totalKeysExamined' and 'totalDocsExamined'.
      await brZcapStorage.zcaps.insert({
        controller: mockData.zcaps.alpha.controller,
        referenceId: mockData.zcaps.alpha.referenceId,
        capability: mockData.zcaps.alpha.capability
      });
      // the large amount of test records are needed here in order to ensure
      // a consistent index is used via the winning query plan.
      for(let i = 0; i < 1000; i++) {
        await brZcapStorage.zcaps.insert({
          controller: mockData.zcaps.alpha.controller,
          referenceId: uuid(),
          capability: {
            id: uuid(),
            invoker: uuid(),
            invocationTarget: uuid()
          }});
      }
    });
    it(`is properly indexed for 'controller' and 'referenceId' in get()`,
      async () => {
        const {controller, referenceId} = mockData.zcaps.alpha;
        const {executionStats} = await brZcapStorage.zcaps.get({
          controller,
          referenceId,
          explain: true
        });
        executionStats.nReturned.should.equal(1);
        executionStats.totalKeysExamined.should.equal(1);
        executionStats.totalDocsExamined.should.equal(1);
        executionStats.executionStages.inputStage.inputStage.inputStage.stage
          .should.equal('IXSCAN');
        executionStats.executionStages.inputStage.inputStage.inputStage
          .keyPattern.should.eql({controller: 1, referenceId: 1});
      });
    it(`is properly indexed for 'controller' and 'id' in get()`,
      async () => {
        const {capability, controller} = mockData.zcaps.alpha;
        const {executionStats} = await brZcapStorage.zcaps.get({
          controller,
          id: capability.id,
          explain: true
        });
        executionStats.nReturned.should.equal(1);
        executionStats.totalKeysExamined.should.equal(1);
        executionStats.totalDocsExamined.should.equal(1);
        executionStats.executionStages.inputStage.inputStage.inputStage.stage
          .should.equal('IXSCAN');
        // winning query plan is {controller: 1, referenceId: 1} in this case.
        executionStats.executionStages.inputStage.inputStage.inputStage
          .keyPattern.should.eql({controller: 1, id: 1});
      });
    it(`is properly indexed for 'controller' and 'referenceId' in find()`,
      async () => {
        const {controller, referenceId} = mockData.zcaps.alpha;
        const query = {
          controller: helpers.hash(controller),
          referenceId: helpers.hash(referenceId)
        };
        const {executionStats} = await brZcapStorage.zcaps.find({
          query,
          explain: true
        });
        executionStats.nReturned.should.equal(1);
        executionStats.totalKeysExamined.should.equal(1);
        executionStats.totalDocsExamined.should.equal(1);
        executionStats.executionStages.inputStage.stage.should.equal('IXSCAN');
        executionStats.executionStages.inputStage.keyPattern.should.eql({
          controller: 1, referenceId: 1});
      });
    it(`is properly indexed for 'controller' and 'id' in find()`,
      async () => {
        const {capability, controller} = mockData.zcaps.alpha;
        const query = {
          controller: helpers.hash(controller),
          id: helpers.hash(capability.id)
        };
        const {executionStats} = await brZcapStorage.zcaps.find({
          query,
          explain: true
        });
        executionStats.nReturned.should.equal(1);
        executionStats.totalKeysExamined.should.equal(1);
        executionStats.totalDocsExamined.should.equal(1);
        executionStats.executionStages.inputStage.stage.should.equal('IXSCAN');
        // winning query plan is {controller: 1, referenceId: 1} in this case.
        executionStats.executionStages.inputStage.keyPattern.should.eql({
          controller: 1, id: 1});
      });
    it(`is properly indexed for 'controller' and 'invoker' in find()`,
      async () => {
        const {capability, controller} = mockData.zcaps.alpha;
        const query = {
          controller: helpers.hash(controller),
          invoker: helpers.hash(capability.invoker)
        };
        const {executionStats} = await brZcapStorage.zcaps.find({
          query,
          explain: true
        });
        executionStats.nReturned.should.equal(1);
        executionStats.totalKeysExamined.should.equal(1);
        executionStats.totalDocsExamined.should.equal(1);
        executionStats.executionStages.inputStage.stage.should.equal('IXSCAN');
        // winning query plan is {controller: 1, referenceId: 1} in this case.
        executionStats.executionStages.inputStage.keyPattern.should.eql({
          controller: 1, invoker: 1});
      });
    it(`is properly indexed for 'controller' and 'referenceId' in remove()`,
      async () => {
        const {controller, referenceId} = mockData.zcaps.alpha;
        const {executionStats} = await brZcapStorage.zcaps.remove({
          controller,
          referenceId,
          explain: true
        });
        executionStats.nReturned.should.equal(1);
        executionStats.totalKeysExamined.should.equal(1);
        executionStats.totalDocsExamined.should.equal(1);
        executionStats.executionStages.inputStage.stage.should.equal('IXSCAN');
        executionStats.executionStages.inputStage.keyPattern.should.eql({
          controller: 1, referenceId: 1});
      });
    it(`is properly indexed for 'controller' and 'id' in remove()`,
      async () => {
        const {capability, controller} = mockData.zcaps.alpha;
        const {executionStats} = await brZcapStorage.zcaps.remove({
          controller,
          id: capability.id,
          explain: true
        });
        executionStats.nReturned.should.equal(1);
        executionStats.totalKeysExamined.should.equal(1);
        executionStats.totalDocsExamined.should.equal(1);
        executionStats.executionStages.inputStage.stage.should.equal('IXSCAN');
        // winning query plan is {controller: 1, referenceId: 1} in this case.
        executionStats.executionStages.inputStage.keyPattern.should.eql({
          controller: 1, id: 1});
      });
  });
});

describe('Revocation Database Tests', () => {
  describe('Indexes', async () => {
    beforeEach(async () => {
      const collectionName = 'zcap-storage-revocation';
      await helpers.removeCollection(collectionName);

      // two revocations are inserted here in order to do proper assertions
      // for 'nReturned', 'totalKeysExamined' and 'totalDocsExamined'.
      await brZcapStorage.revocations.insert(mockData.revocations.alpha);
      await brZcapStorage.revocations.insert(mockData.revocations.beta);
    });
    it(`is properly indexed for 'meta.rootTarget' in count()`, async () => {
      const {rootTarget} = mockData.revocations.alpha;
      const {executionStats} = await brZcapStorage.revocations.count({
        rootTarget,
        explain: true
      });
      executionStats.nReturned.should.equal(1);
      executionStats.totalKeysExamined.should.equal(1);
      executionStats.totalDocsExamined.should.equal(1);
      executionStats.executionStages.inputStage.stage.should.equal('IXSCAN');
      executionStats.executionStages.inputStage.keyPattern
        .should.eql({'meta.rootTarget': 1});
    });
    it(`is properly indexed for 'capability.id' and 'meta.delegator' in ` +
      'isRevoked()', async () => {
      const capabilities = [{
        capabilityId: mockData.revocations.alpha.capability.id,
        delegator: mockData.revocations.alpha.delegator
      }];
      const {executionStats} = await brZcapStorage.revocations.isRevoked({
        capabilities,
        explain: true
      });
      executionStats.nReturned.should.equal(1);
      executionStats.totalKeysExamined.should.equal(1);
      executionStats.totalDocsExamined.should.equal(1);
      executionStats.executionStages.inputStage.inputStage.inputStage.stage
        .should.equal('IXSCAN');
      executionStats.executionStages.inputStage.inputStage.inputStage
        .keyPattern.should.eql({'meta.delegator': 1, 'capability.id': 1});
    });
  });
});
