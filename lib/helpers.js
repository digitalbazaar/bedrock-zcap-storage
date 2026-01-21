/*!
 * Copyright (c) 2019-2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import {logger} from './logger.js';
import {revocations} from './storage.js';

export async function inspectCapabilityChain({
  capabilityChain, capabilityChainMeta
} = {}) {
  // check expiration status of each delegated capability in the chain and log
  // if configured; this runs before the revocation check so that expiration
  // issues are logged even if the zcap is also revoked
  _logCapabilityChainExpiration({capabilityChain});

  // if capability chain has only root, there's nothing to check as root
  // zcaps cannot be revoked
  if(capabilityChain.length === 1) {
    return {valid: true};
  }

  // collect capability IDs and delegators for all delegated capabilities in
  // chain (skip root) so they can be checked for revocation
  const capabilities = [];
  for(const [i, capability] of capabilityChain.entries()) {
    // skip root zcap, it cannot be revoked
    if(i === 0) {
      continue;
    }
    const [{purposeResult}] = capabilityChainMeta[i].verifyResult.results;
    if(purposeResult && purposeResult.delegator) {
      capabilities.push({
        capabilityId: capability.id,
        delegator: purposeResult.delegator.id,
      });
    }
  }

  // FIXME: concurrently check for any revocation policy for any
  // controller/delegator in the capability chain
  // FIXME: skip (either always or by flag / option) checking capabilities
  // that are shortlived (TTLs that are, e.g., within the clockskew period
  // or within some value provided via an option)

  const revoked = await revocations.isRevoked({capabilities});
  if(revoked) {
    return {
      valid: false,
      error: new Error(
        'One or more capabilities in the chain have been revoked.')
    };
  }

  return {valid: true};
}

// logs expiration events for capabilities in the chain based on config
function _logCapabilityChainExpiration({capabilityChain}) {
  const {logging: {zcapExpiration}} = bedrock.config['zcap-storage'];

  // skip if both logging options are disabled
  if(!zcapExpiration.logNearExpiration && !zcapExpiration.logExpired) {
    return;
  }

  const now = Date.now();
  const {logName} = zcapExpiration;

  // check each capability in the chain (skip index 0, the root zcap, which
  // does not have an expiration)
  for(let i = 1; i < capabilityChain.length; ++i) {
    const capability = capabilityChain[i];
    const {expires, id: capabilityId, invocationTarget} = capability;

    // skip if no expiration set
    if(!expires) {
      continue;
    }

    const expiresDate = new Date(expires);
    const expiresMs = expiresDate.getTime();
    const timeUntilExpiration = expiresMs - now;

    // build common log data for consistent structured logging / metric filters
    const logData = {
      logName,
      capabilityId,
      invocationTarget,
      expires,
      expiresMs,
      chainDepth: i,
      chainLength: capabilityChain.length
    };

    // check if already expired
    if(timeUntilExpiration <= 0 && zcapExpiration.logExpired) {
      logger.error('Zcap has expired.', {
        ...logData,
        event: 'zcap-expired',
        expiredAgoMs: Math.abs(timeUntilExpiration)
      });
      continue;
    }

    // check if near expiration
    if(zcapExpiration.logNearExpiration) {
      const {threshold} = zcapExpiration.logNearExpiration;
      if(timeUntilExpiration <= threshold) {
        logger.warning('Zcap is near expiration.', {
          ...logData,
          event: 'zcap-near-expiration',
          timeUntilExpirationMs: timeUntilExpiration,
          thresholdMs: threshold
        });
      }
    }
  }
}
