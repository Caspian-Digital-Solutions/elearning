# R&D security review checklist

**Project:** CDS AI Academy (`ailearning.devteam-cds.tech` dev deployment)  
**Pack:** Prompt 11a

| # | Check | Pass? | Findings | Owner | Date |
|---|-------|-------|----------|-------|------|
| 1 | Architecture matches SECURITY_OVERVIEW.md | | | | |
| 2 | ACCESS_MATRIX.md matches automated sweep | | | | |
| 3 | Headers present on Production (Network tab) | | | | |
| 4 | Google OAuth Internal + domain lock | | | | |
| 5 | RLS enabled on all public tables | | | | |
| 6 | Secret key not exposed to client | | | | |
| 7 | Rate limits on auth and submissions | | | | |
| 8 | Privacy notice draft acceptable for D2 | | | | |
| 9 | PRODUCTION_CUTOVER.md reviewed before 11b | | | | |
| 10 | npm audit exceptions documented | | | | |

**Sign-off:** _________________________ Date: __________
