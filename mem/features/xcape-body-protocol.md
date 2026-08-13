---
name: XCAPE body protocol (derived)
description: Health-score direction, dose tiers, and the derived body protocol rules (serum pigmentation path, Body Milk 5x elasticity)
type: feature
---
The four XCAPE values are HEALTH scores: 100 = healthiest, 0 = most compromised. Lower score = higher treatment priority everywhere (ranking, labels, copy, tests).

Face dose tiers by health score: 75-100 = 0.5 ml maintenance, 50-74 = 1.0, 25-49 = 1.5, 0-24 = 2.0.

"Your XCAPE Body Protocol" is DERIVED from facial findings (body is never scanned). Two pathways only, each activating below health score 75:
- pigmentation_stability < 75 -> XCAPE Advanced Serum body pathway at the same tier dose (customized on the body path only, never on the face).
- firmness_skin_support < 75 -> XCAPE Body Milk weak-elasticity line at EXACTLY 5x the Face Cream anti-aging amount (supersedes the old "body = 3x face" rule).
Oil/congestion and dehydration have no derived body pathway.

Every body line carries a `derivation` record (rule, source concern, source score, base face dose, multiplier) shown to practitioners and persisted in the immutable snapshot.
