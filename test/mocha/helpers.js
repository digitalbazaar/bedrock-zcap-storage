/*!
 * Copyright (c) 2021-2022 Digital Bazaar, Inc. All rights reserved.
 */
import * as database from '@bedrock/mongodb';

export async function removeCollection(collectionName) {
  await database.collections[collectionName].deleteMany({});
}

export function hash(string) {
  return database.hash(string);
}
