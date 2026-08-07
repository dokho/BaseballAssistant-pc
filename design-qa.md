# Scoreboard Theme Design QA

## Evidence

- Source visual truth: `C:\Users\tiger\AppData\Local\Temp\codex-clipboard-92e3dfec-7e7c-47f8-8a0d-3c85eda94abe.png`
- Rendered implementation: `C:\Users\tiger\AppData\Local\Temp\scorebug-bso-840x280-long-names.png`
- Full-view comparison: `C:\Users\tiger\AppData\Local\Temp\scorebug-bso-size-comparison.png`
- Source size: 1374 × 504 pixels. The scorebug content region was cropped to 1354 × 438 before comparison because the supplied screenshot includes the controller preview padding.
- Implementation: BSO Focus overlay at 840 × 280 CSS pixels, device scale factor 1, solid background, top of the 1st, B=2/S=1/O=1, long Chinese team names, score 0–0, bases empty.
- Normalization: the cropped source was scaled to 840 × 280 for side-by-side comparison with the actual overlay. This introduces a small vertical normalization because the source is a controller-preview capture rather than the overlay window itself.

## Findings

- [P2, fixed] BSO Focus inherited the default 680 × 280 window size, which compressed the wide team-name layout and caused truncation in the supplied preview.
  - Evidence: the supplied preview clips both team names.
  - Fix: added theme-owned overlay presentations. BSO Focus now opens, resets, and keeps a 3:1 aspect ratio at 840 × 280, with a 600 × 200 minimum. Default, modern broadcast, and heritage retain 680 × 280.

No actionable P0, P1, or P2 findings remain.

## Full-view Comparison

- BSO Focus now uses the intended wider hierarchy: long team-name rows dominate the left, inning and bases remain compact in the center, and the vertical B/S/O rail stays legible on the right.
- Both `北京海淀青少年棒球队` and `上海浦东未来之星队` fit on one line at the actual recommended window size.
- BSO still uses letters and lamp states only, with no numeric BSO counter.
- The source layout remains the visual reference; the implementation intentionally keeps the product's existing interactive three-base representation rather than adding decorative home-plate connectors.

No separate focused crop was required: the normalized full-view comparison clearly shows the title, both long names, scores, inning state, base diamond, and every B/S/O lamp.

## Required Fidelity Surfaces

- Fonts and typography: passed. The full team names remain single-line and readable at 840 × 280; B/S/O uses an unambiguous bold sans-serif letterform.
- Spacing and layout rhythm: passed. The BSO Focus grid uses the 3:1 presentation without crowding the team names or state rail. The selected theme owns its own width, height, minimum size, and locked aspect ratio.
- Colors and visual tokens: passed. The charcoal/cream/gold framework and blue/red team rows retain high contrast; B/S/O lamps remain green, amber, and red.
- Image quality and asset fidelity: passed. No required raster assets or logos are present. Existing base and lamp state elements remain sharp at the target size.
- Copy and content: passed. The controller reports the active theme's recommended output size and the reset action updates from `恢复 680×280` to `恢复 840×280` for BSO Focus.
- Accessibility and behavior: passed. Theme selection remains button-based with `aria-pressed`; selecting a new theme applies its recommended minimum size, aspect ratio, and bounds.

## Primary Interactions Tested

- Loaded BSO Focus from persisted settings and confirmed the created overlay window is exactly 840 × 280 with a 3.0 aspect ratio.
- Confirmed the long-name rendering uses team full names in BSO Focus.
- Confirmed B=2/S=1/O=1 displays two green, one amber, and one red active lamps without numeric BSO values.
- Ran JavaScript syntax checks, the complete automated test suite, and whitespace validation.

## Comparison History

- Initial comparison found the default 680 × 280 frame was a P2 mismatch for the BSO Focus information density.
- Added per-theme presentation metadata and recaptured the BSO Focus window at 840 × 280. The long-name truncation is resolved in the final implementation screenshot and comparison.

## Follow-up Polish

- P3: future themes can add their own `overlay` presentation entry without changing window-management code; choose that size from each selected visual direction rather than inheriting the default.

## Base-panel reference refinement

- Source visual truth: `C:\Users\tiger\AppData\Local\Temp\codex-clipboard-7b480fe8-5b60-4548-ac95-b4ec21c4e14a.png`
- Rendered implementation: `C:\Users\tiger\AppData\Local\Temp\scorebug-bso-base-spacing-final.png`
- Focused comparison: `C:\Users\tiger\AppData\Local\Temp\scorebug-bso-base-comparison.png` (source at left; implementation at right).
- Same-state conditions: BSO Focus theme at 840 x 280 CSS pixels, solid background, bases empty. The implementation crop was normalized to the supplied 294 x 356 reference panel for direct visual comparison.

### Findings and resolution

- [P2, fixed] The first BSO Focus version used bases that were too large and too tightly grouped.
- [P2, fixed] The first spacing correction reduced the bases too much and spread first and third base too far apart.
- Final adjustment: the live overlay now uses a 71% diamond container and `clamp(34px, 5.35vw, 56px)` bases. The settings-preview sample uses 39px bases in its 118px diamond, preserving the same compact proportion.

### Fidelity surfaces

- Typography: passed. This focused reference contains no text; surrounding scoreboard typography was visually unchanged.
- Spacing and geometry: passed. The final base size, horizontal gap, and vertical rhythm align closely with the supplied reference crop.
- Colors and tokens: passed. Cream fills, gold borders, dark panel, and crisp state styling remain unchanged.
- Asset quality: passed. The vector-like CSS bases remain sharp at the actual overlay resolution.
- Copy and behavior: passed. No copy or interaction behavior changed; base toggles retain their original functionality.

No actionable P0, P1, or P2 findings remain for the base-panel refinement.

final result: passed
