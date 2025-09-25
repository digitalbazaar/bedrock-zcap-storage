/*!
 * Copyright (c) 2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as brZcapStorage from '@bedrock/zcap-storage';
import * as helpers from './helpers.js';
import {mocks as mockData} from './mock-data.js';

describe('helpers API', () => {
  describe('inspectCapabilityChain', () => {
    let revocation;
    let revocation2;
    before(async () => {
      const collectionName = 'zcap-storage-revocation';
      await helpers.removeCollection(collectionName);

      revocation = structuredClone(mockData.revocations.alpha);
      revocation.capability.id = 'cdbadb6f-c4ca-4bba-8025-ad3ba4bf0fa0';
      await brZcapStorage.revocations.insert(revocation);

      revocation2 = structuredClone(mockData.revocations.alpha);
      revocation2.capability.id = 'cdbadb6f-c4ca-4bba-8025-ad3ba4bf0fa0' + '-2';
      await brZcapStorage.revocations.insert(revocation2);
    });
    it('returns valid=false on a matching revocation', async () => {
      const {
        capabilityChain, capabilityChainMeta
      } = _createMinimalCapabilityChainParams({revocation});

      let result;
      let err;
      try {
        result = await brZcapStorage.helpers.inspectCapabilityChain({
          capabilityChain, capabilityChainMeta
        });
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.valid.should.be.a('boolean');
      result.valid.should.be.false;
      result.error.message.should.equal(
        'One or more capabilities in the chain have been revoked.');
    });
    it('returns valid=true on unrevoked delegator', async () => {
      const {
        capabilityChain, capabilityChainMeta
      } = _createMinimalCapabilityChainParams({
        revocation: {
          ...revocation,
          // an unknown delegator
          delegator: '06d79b4d-0e0b-4552-b469-d3162f92b4ed'
        }
      });
      let result;
      let err;
      try {
        result = await brZcapStorage.helpers.inspectCapabilityChain({
          capabilityChain, capabilityChainMeta
        });
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.valid.should.be.a('boolean');
      result.valid.should.be.true;
    });
    it('returns valid=true on unrevoked id', async () => {
      const {
        capabilityChain, capabilityChainMeta
      } = _createMinimalCapabilityChainParams({
        revocation: {
          ...revocation,
          capability: {
            // an unknown id
            id: '83f6f7d5-2435-400f-837f-3a785e055dd9'
          }
        }
      });
      let result;
      let err;
      try {
        result = await brZcapStorage.helpers.inspectCapabilityChain({
          capabilityChain, capabilityChainMeta
        });
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.valid.should.be.a('boolean');
      result.valid.should.be.true;
    });
    it('returns valid=true on unrevoked id and delegator', async () => {
      const {
        capabilityChain, capabilityChainMeta
      } = _createMinimalCapabilityChainParams({
        revocation: {
          ...revocation,
          capability: {
            // an unknown id
            id: 'e240182e-fdbc-4868-8f52-d74011d5f27e'
          },
          // an unknown delegator
          delegator: 'cf88a50c-f171-48bb-89f9-558b850cfa3a'
        }
      });
      let result;
      let err;
      try {
        result = await brZcapStorage.helpers.inspectCapabilityChain({
          capabilityChain, capabilityChainMeta
        });
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result);
      result.valid.should.be.a('boolean');
      result.valid.should.be.true;
    });
    it('returns valid=false w/ a revocation amongst others', async () => {
      const {
        capabilityChain, capabilityChainMeta
      } = _createMinimalCapabilityChainParams({
        revocation: [
          revocation2,
          {
            ...revocation2,
            capability: {
              id: revocation2.capability.id + '-not-revoked-1'
            }
          },
          {
            ...revocation2,
            capability: {
              id: revocation2.capability.id + '-not-revoked-2'
            },
            delegator: revocation2.delegator + 'other'
          }
        ]
      });
      let result1;
      let result2;
      let err;
      try {
        // call twice, first should use database, second should include cache
        result1 = await brZcapStorage.helpers.inspectCapabilityChain({
          capabilityChain, capabilityChainMeta
        });
        result2 = await brZcapStorage.helpers.inspectCapabilityChain({
          capabilityChain, capabilityChainMeta
        });
      } catch(e) {
        err = e;
      }
      assertNoError(err);
      should.exist(result1);
      result1.valid.should.be.a('boolean');
      result1.valid.should.be.false;
      result1.error.message.should.equal(
        'One or more capabilities in the chain have been revoked.');
      should.exist(result2);
      result2.valid.should.be.a('boolean');
      result2.valid.should.be.false;
      result2.error.message.should.equal(
        'One or more capabilities in the chain have been revoked.');
    });
  });
});

function _createMinimalCapabilityChainParams({revocation}) {
  const revocations = Array.isArray(revocation) ? revocation : [revocation];

  const capabilityChain = [{
    // root zcap
    id: `urn:zcap:root:${encodeURIComponent(revocations[0].rootTarget)}`
  }];
  const capabilityChainMeta = [{
    // root zcap metadata
    verifyResult: null
  }];
  for(let i = 0; i < revocations.length; ++i) {
    capabilityChain.push({
      id: revocations[i].capability.id
    });
    // minimal delegated zcap metadata
    capabilityChainMeta.push({
      verifyResult: {
        results: [{
          purposeResult: {
            delegator: {
              id: revocations[i].delegator
            }
          }
        }]
      }
    });
  }
  return {capabilityChain, capabilityChainMeta};
}
