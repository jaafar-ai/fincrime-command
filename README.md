# FINCRIME COMMAND V10 — IQTFS Integration Prototype

Adds a permanent priority source for IQTFS / Iraq AML-CFT Office:
- Dedicated IQTFS layer.
- Dedicated IQTFS regional/source filter.
- Permanent Iraq Sanctions Watch card.
- Sample local sanctions/freezing event.
- Sample international / UN sanctions event.
- IQTFS added to source-health panel.
- IQTFS added to timeline filter.
- Default view keeps IQTFS enabled.

Production design:
The live collector should monitor the official Iraqi AML/CFT Office / IQTFS sanctions platform for:
- local Iraqi sanctions/designations
- freezing decisions and related notices
- appeals / removals / amendments where published
- international and UN-related sanctions material made available through the Iraqi platform
- change detection between current and previous list versions

This prototype still uses sample records; it does not yet scrape or automatically ingest the live site.
