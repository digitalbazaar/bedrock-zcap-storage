/*!
 * Copyright (c) 2019-2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const bedrock = require('bedrock');

const mocks = {};
module.exports = mocks;

const actors = mocks.actors = {};
const delegations = mocks.delegations = {};
const revocations = mocks.revocations = {};

actors.alpha = {
  id: 'urn:uuid:ec6bcc36-e7ab-46e9-aebb-ab57caee4fbe'
};

actors.beta = {
  id: 'urn:uuid:df29c22a-9c68-448c-a04b-345383aaf8ff'
};

delegations.alpha = {
  // this corresponds to the bedrock-account ID
  controller: 'urn:uuid:defa6262-6fa2-4eb4-a8a3-924580a47900',
  domain: 'https://example.com',
  // this is a profile ID, this is computed (eventually) by calling
  // did-veres-one.foo to derive the DID from the verificationMethod in the
  // proof.
  delegator: 'did:v1:123123', // verificationMethod.controller
  capability: {
    '@context': bedrock.config.constants.SECURITY_CONTEXT_V2_URL,
    // this is a unique ID
    id: `urn:zcap:056df9bc-93e2-4a0e-aa5a-d5217dcca018`,
    // this is typically a did:key: or did:v1:
    invoker: actors.beta.id,
    // parentCapability could be root capability (e.g. a key or an LD
    // document).
    parentCapability:
      'https://example.com/keys/c9dd4d64-f9b7-4ac2-968f-9416da723dca',
    allowedAction: 'sign',
    invocationTarget: {
      // this is a public identifier for a key
      verificationMethod: 'urn:uuid:c54a4a71-c6fb-43ea-b075-bf6abe67ebae',
      id: 'https://example.com/keys/c9dd4d64-f9b7-4ac2-968f-9416da723dca',
      type: 'Ed25519VerificationKey2018',
    },
    proof: {
      // ...,
      // deref verificationMethod to get its controller
      verificationMethod: 'did:v1:123123#123123'
    }
  }
};

revocations.alpha = {
  delegator: '51689f5c-a8ea-4924-8108-e7461a54989f',
  capability: {
    id: '5cef0111-04f3-4d6b-9a67-48d7013fea9a',
  }
};

revocations.beta = {
  delegator: '93ae803d-e753-4789-83a1-2b3e807abd7b',
  capability: {
    id: '8677f033-d4fd-44c6-afb2-a49688d68c21',
  }
};

revocations.gamma = {
  delegator: '3f1995e6-038b-41a2-9c87-70fd0458b74e',
  capability: {
    id: '2044302d-484b-4bfd-83c6-b7a8f988770d',
  }
};
