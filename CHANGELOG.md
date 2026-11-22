# Changelog

All notable changes to the **ResearchPilot** project between Milestone 1 and Milestone 2 are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - Milestone 2 (2026-11-22)

### Added
- **Multi-Stage Decomposed Prompt Pipeline:** Replaced the monolithic single-call prompt with a 5-step sequential reasoning architecture (`P2_plan`, `P2_notes`, `P2_compare`, `P2_report`, and `P3_verify`).
- **Automated Citation Verification Audit Loop (`P3_verify`):** Programmatic verification gate that audits every generated claim against cited source passage tokens, discarding unsupported or unfaithful assertions before publication.
- **Client-Side In-Browser PDF Parsing:** Integrated `pdfjs-dist` worker directly into the browser runtime (`public/app.js`), extracting page-by-page text locally and compressing upload payloads by 99% (from ~15 MB raw binary down to <50 KB JSON).
- **Coordinate-Tagged Sliding-Window Passage Chunker:** Slices documents into 180-token overlapping chunks with persistent coordinates (`D<doc>-p<page>-<chunk>`) for precise sentence-level attribution.
- **Multi-Paper Balanced Keyword Retrieval Engine:** Relevance-scored token retrieval balancing passage selection across all uploaded documents to prevent single-paper bias.
- **State Checkpointing & Resume Controller:** Automatic persistence of intermediate stage outputs to temporary storage (`/tmp`), enabling instant resumption upon encountering Groq API rate limits (HTTP 429) without redundant inference costs.
- **Interactive Source Passage Reader:** Clickable in-context citation pills (`[1 · p. 3]`) that launch a dedicated modal reader displaying the exact cited passage context.
- **Client-Side Vector PDF Exporter:** Multi-page formatted PDF report download generated in-browser via custom Canvas vector rendering.
- **Vercel Serverless Cloud Deployment:** Serverless edge gateway and backend function configuration (`api/research.js` and `vercel.json`) deployed live at [https://researchpilot-six.vercel.app/](https://researchpilot-six.vercel.app/).
- **Automated 12-Case Test Suite:** Systematic test suite covering normal queries, cross-paper comparisons, image-only PDFs, off-topic edge cases, quota spikes, and password-protected PDFs.

### Changed
- **LLM Inference Provider:** Switched from generic slower endpoints to Groq LPU inference using open-source `openai/gpt-oss-120b`, reducing complete 5-stage pipeline latency from >120 seconds to ~9.2 seconds.
- **Frontend User Experience:** Redesigned single-page workspace with real-time multi-stage progress tracking, paper dock management, and dark/light responsive interface.
- **System Documentation:** Authored comprehensive Milestone 2 Project Report (`M2_PE-B13-21_ResearchPilot.pdf`) and supporting Technical Report (`Innovexa_TechnicalReport.pdf`).

### Fixed
- **Vercel HTTP 413 "Request Entity Too Large":** Resolved edge upload body ceiling by offloading PDF binary extraction to client-side browser workers.
- **Citation Hallucinations & Metric Conflation:** Eliminated author conflation and hallucinated citations observed in Milestone 1 baseline (achieving 100% verified support across all retained claims in V3).

---

## [1.0.0] - Milestone 1 (2026-10-15)

### Added
- Initial project concept and problem statement definition.
- Baseline single-call prompt design (`v1/baseline.txt`).
- Static in-memory document retrieval prototype.
- Initial wireframe interface and project setup.
