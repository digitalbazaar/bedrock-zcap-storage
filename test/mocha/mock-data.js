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
const authorizations = mocks.authorizations = {};
const zcaps = mocks.zcaps = {};

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

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
    invoker: actors.alpha.id,
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
  // this is for a service object ID such as the ID of a keystore/EDV/etc.
  rootTarget: 'https://example.com/edvs/123',
  delegator: '51689f5c-a8ea-4924-8108-e7461a54989f',
  capability: {
    id: '5cef0111-04f3-4d6b-9a67-48d7013fea9a',
  }
};

revocations.beta = {
  // this is for a service object ID such as the ID of a keystore/EDV/etc.
  rootTarget: 'https://example.com/keystores/abc',
  delegator: '93ae803d-e753-4789-83a1-2b3e807abd7b',
  capability: {
    id: '8677f033-d4fd-44c6-afb2-a49688d68c21',
  }
};

revocations.gamma = {
  // this is for a service object ID such as the ID of a keystore/EDV/etc.
  rootTarget: 'https://example.com/verifiers/xyz',
  delegator: '3f1995e6-038b-41a2-9c87-70fd0458b74e',
  capability: {
    id: '2044302d-484b-4bfd-83c6-b7a8f988770d',
    expires: tomorrow
  }
};

authorizations.alpha = {
  controller: 'urn:e6aa448c-8242-4dbd-a5a9-68d62862db6e',
  capability: {
    '@context': bedrock.config.constants.SECURITY_CONTEXT_V2_URL,
    id: 'urn:zcap:3b175c87-09ee-44a4-9c97-dc2ffb329b22',
    invoker: actors.alpha.id,
    parentCapability:
      'https://example.com/keys/c2ed35fd-d8fe-4180-a5f5-a2eec739036b',
    allowedAction: 'sign',
    invocationTarget: 'urn:uuid:e30d372c-7ab2-429c-91b0-03dc3bcc6289',
    proof: {
      verificationMethod: 'did:v1:123123#123123'
    }
  }
};

authorizations.beta = {
  controller: 'urn:4b32fae0-ac64-4d14-82b8-b99c4687140d',
  capability: {
    '@context': bedrock.config.constants.SECURITY_CONTEXT_V2_URL,
    id: 'urn:zcap:8bd184b4-a7bd-4ca3-a450-9f7d1e10eedd',
    invoker: actors.alpha.id,
    parentCapability:
      'https://example.com/keys/8b02af9e-abcb-4337-967a-987ed80329e7',
    allowedAction: 'sign',
    invocationTarget: 'urn:uuid:0181875b-2a82-42ab-819f-93f2b729d9e4',
    proof: {
      verificationMethod: 'did:v1:234234#234234'
    }
  }
};

zcaps.alpha = {
  referenceId: 'urn:uuid:eefa5a82-4a1a-40fd-b54c-e43d17d5d2fa',
  controller: 'urn:120a128e-b057-404b-ad14-0254c5ccb998',
  capability: {
    '@context': bedrock.config.constants.SECURITY_CONTEXT_V2_URL,
    id: 'urn:zcap:c10e705a-9921-4517-98ca-f776bcb6e39b',
    invoker: actors.alpha.id,
    parentCapability:
      'https://example.com/keys/d6de2aef-d4ed-4d89-a794-d43cc185844b',
    allowedAction: 'sign',
    invocationTarget: 'urn:uuid:ec56e8c0-3d0d-4d8b-afa4-035237f86d2b',
    proof: {
      verificationMethod: 'did:v1:345345#345345'
    }
  }
};
