---
name: XCAPE product visuals in recommendations
description: Official myxcape.com packshots stored on products.image_url and rendered in protocol recommendation cards
type: feature
---
Recommended XCAPE product images come from the catalogue row (`products.image_url`), never from
hardcoded product-name conditionals. Admins replace them in Products & Ingredients → product editor → Media.

The official packshots (bronze silk background, "Custom …" badge) were imported from myxcape.com and
uploaded as CDN assets under `src/assets/products/*.asset.json`. Never invent product artwork or use
generic placeholders; if a real image is missing the card simply renders without one.

Plumbing: `ProtocolAlignment.product_image_url` → `ProtocolProduct` → `ProtocolFormulaLine` →
public snapshot / report payload → `ProtocolRecommendations` and `CustomizationFormulaCard`.
All image URLs pass `sanitizeProductImageUrl` (same-origin path or https only).
