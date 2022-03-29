/*!
 * Copyright (c) 2019-2022 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from 'bedrock';
import * as database from 'bedrock-mongodb';

export * as authorizations from './authorizations.js';
export * as revocations from './revocations.js';
export * as zcaps from './zcaps.js';

bedrock.events.on('bedrock-mongodb.ready', async () => {
  /* Note: There are two capability collections:

  1. The `zcap-storage-authorization` collection is used to store capabilities
  that are actively authorized for use. The authorizing party (stored as the
  `controller`) writes these capabilities to this collection after an
  application ensures they are permitted to do so for a given
  `invocationTarget`. Typically, the delegator for a given authorization
  capability is the same party that writes the capability to the
  `authorization` collection. An application may later check storage for these
  active capabilities to get them for potential revocation by querying for
  the capability by its ID and invocationTarget.

  2. The `zcap-storage-zcap` collection is used to store capabilities for an
  invoker to later invoke.

  */
  await database.openCollections([
    'zcap-storage-authorization',
    'zcap-storage-zcap'
  ]);

  await database.createIndexes([{
    // cover queries by invocationTarget and id; as this is a unique index and
    // IDs are controlled by the capability creator, we scope the index to the
    // invocationTarget to prevent squatting on IDs and assume applications
    // will ensure authorizations written to storage were written by parties
    // authorized to delegate the zcap for the invocationTarget
    collection: 'zcap-storage-authorization',
    fields: {invocationTarget: 1, id: 1},
    options: {unique: true, background: false}
  }, {
    // cover queries by controller of the authorization and id; allows for
    // controllers to see all of the zcaps they have authorized via storage
    collection: 'zcap-storage-authorization',
    fields: {controller: 1, id: 1},
    options: {unique: true, background: false}
  }, {
    // enable queries by controller and reference ID (reference IDs are
    // scoped to controllers)
    collection: 'zcap-storage-zcap',
    fields: {controller: 1, referenceId: 1},
    options: {unique: true, background: false}
  }, {
    // enable queries by controller and id; as this is a unique index and IDs
    // are controlled by the zcap creator, we scope the index to the controller
    // to prevent entities from squatting on IDs
    collection: 'zcap-storage-zcap',
    fields: {controller: 1, id: 1},
    options: {unique: true, background: false}
  }, {
    // enable queries by controller and invoker
    collection: 'zcap-storage-zcap',
    fields: {controller: 1, invoker: 1},
    options: {unique: false, background: false}
  }]);
});
