/**
 * XCAPE intelligent recommendation reasoning engine.
 *
 * The implementation lives inside `protocol.ts` because that file is copied
 * byte-for-byte to `supabase/functions/_shared/xcapeProtocol.ts` (parity is
 * enforced by a test), and the reasoning pass must behave identically in the
 * browser, the edge runtime and the snapshot builder.
 *
 * This module is the named import surface for the reasoning layer.
 */

export {
  RECOMMENDATION_CONFIG_VERSION,
  DEFAULT_RECOMMENDATION_CONFIG,
  FALLBACK_ACTIVATION,
  severityFromScore,
  bandForSeverity,
  rankConcerns,
  reasonProtocol,
} from './protocol';

export type {
  SeverityBandCode,
  SeverityBand,
  ActivationRule,
  InteractionRule,
  CompatibilityStatus,
  CompatibilityRule,
  RecommendationConfig,
  ConcernPriority,
  PriorityTier,
  InteractionFinding,
  DecisionCode,
  ProductDecision,
  CompanionDecision,
  ReasoningResult,
  ReasonProtocolInput,
} from './protocol';
