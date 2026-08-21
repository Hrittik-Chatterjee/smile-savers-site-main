/**
 * Shared change-impact computation, used by both change-impact.mjs (CLI
 * report generator) and agent-context.mjs (packet assembly), so the two
 * never drift into inconsistent impact logic for the same token.
 */

export function impactForToken(tokenName, inv, lineage) {
  const token = inv.tokens.find((t) => t.name === tokenName);
  if (!token) {
    return {
      token: tokenName,
      status: 'UNKNOWN',
      reason: 'Token not found in token-inventory.json — cannot compute impact from evidence that does not exist.',
    };
  }

  const direct = token.consumers.filter((c) => c.classification === 'DIRECT').map((c) => c.file);
  const indirectFromUtility = token.consumers.filter((c) => c.classification === 'INDIRECT').map((c) => c.file);

  const aliasingTokens = lineage.edges.ALIASES.filter((e) => e.target === tokenName).map((e) => e.source);
  const aliasingConsumerFiles = aliasingTokens.flatMap((aliasName) => {
    const aliasToken = inv.tokens.find((t) => t.name === aliasName);
    return aliasToken ? aliasToken.consumers.map((c) => c.file) : [];
  });

  const sameDomainTokens = inv.tokens
    .filter((t) => t.domain === token.domain && t.name !== tokenName && !aliasingTokens.includes(t.name))
    .map((t) => t.name);

  const overriddenBy = lineage.edges.OVERRIDDEN_BY.filter((e) => e.source === tokenName);
  const variesBy = lineage.edges.VARIES_BY.filter((e) => e.source === tokenName);

  return {
    token: tokenName,
    status: 'COMPUTED',
    domain: token.domain,
    canonicalValue: token.canonicalValue,
    DIRECT: {
      consumerFiles: [...new Set(direct)],
      count: new Set(direct).size,
      confidence: 'HIGH',
      basis: 'literal var(--x) reference, grep-verified',
    },
    INDIRECT: {
      consumerFiles: [...new Set([...indirectFromUtility, ...aliasingConsumerFiles])],
      count: new Set([...indirectFromUtility, ...aliasingConsumerFiles]).size,
      confidence: 'MEDIUM',
      basis: 'Tailwind-utility-class usage (DERIVED) and consumers of tokens that ALIASES this one',
      aliasingTokens,
    },
    POSSIBLE: {
      relatedTokens: sameDomainTokens,
      count: sameDomainTokens.length,
      confidence: 'LOW',
      basis: 'same design domain, no direct graph edge — included so the impact net is not silently narrow; not itself evidence of a dependency',
    },
    cascadeAffected: {
      overriddenBy,
      variesBy,
    },
    staleEvidence: [],
    requiredValidation: [
      'npm run check',
      'npm run build',
      'manual visual check of routes rendered by DIRECT + INDIRECT consumer files listed above',
    ],
    limitations: [
      'POSSIBLE bucket is a coverage net (same domain), not a proven dependency — do not treat it as equivalent confidence to DIRECT/INDIRECT.',
      'No automated route-level mapping exists from consumer file to rendered URL for this static Astro site; "affected routes" must be inferred manually from the file paths listed.',
    ],
  };
}
