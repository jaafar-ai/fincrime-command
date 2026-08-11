# Collector plan

Priority live-source order:
1. IQTFS / Iraq AML-CFT Office
2. FATF
3. MENAFATF
4. OFAC
5. UN Security Council
6. EU / UK sanctions
7. Egmont Group
8. INTERPOL / Europol
9. Central banks / regulators
10. Reuters (licensed access only)

Normalized fields:
source, source_type, title, published_at, retrieved_at,
country/countries, category, original_url, source_text/metadata, content_hash.

Pipeline:
collector -> dedupe -> change detection -> database ->
AI summary/Arabic translation -> API -> frontend.
