# ResearchPilot — System Architecture & Workflow Diagrams

This document contains the core diagrams for **ResearchPilot** as required by Milestone 2 guidelines:
1. **System Architecture Diagram** (App & Deployment flow)
2. **RAG Pipeline & Prompt Workflow Diagram** (Retrieval & Multi-stage model execution)
3. **Task Decomposition Diagram** (Modular stages of research generation)
4. **Input–Output Flow Diagram** (Data transformation pipeline)

---

## 1. System Architecture Diagram

```mermaid
flowchart TD
    subgraph Client ["Client Browser (Frontend)"]
        UI["Web Interface (HTML5 / Vanilla JS / CSS)"]
        PDF_PARSER["Client-side PDF.js (In-browser Text Extraction)"]
        STORAGE["Local Storage (Runs, Checkpoints & Session Data)"]
    end

    subgraph Hosting ["Hosting & Edge Gateway"]
        VERCEL_EDGE["Vercel Edge Gateway (Rewrites / Routing)"]
        STATIC_CDN["Static Asset CDN (index.html, app.js, style.css)"]
    end

    subgraph Backend ["Backend Processing"]
        API["Serverless Function (api/research.js) / Node.js Server"]
        CHUNKER["Text Chunking & Tokenizer (passages)"]
        RETRIEVER["Relevance-based Keyword Retrieval (retrieve)"]
        STATE_MGR["Run Checkpoint & State Manager (/tmp runs)"]
    end

    subgraph LLM ["Inference Provider"]
        GROQ["Groq API / OpenAI (openai/gpt-oss-120b)"]
    end

    UI -->|"Uploads PDF/TXT"| PDF_PARSER
    PDF_PARSER -->|"Extracted page texts + Question"| UI
    UI -->|"Static asset request"| VERCEL_EDGE
    VERCEL_EDGE --> STATIC_CDN
    UI -->|"POST /research (JSON payload)"| VERCEL_EDGE
    VERCEL_EDGE --> API
    API --> CHUNKER
    CHUNKER --> RETRIEVER
    RETRIEVER --> API
    API <-->|"State persistence & resume checkpoints"| STATE_MGR
    API -->|"Prompts (System + User data + Format)"| GROQ
    GROQ -->|"Structured JSON responses"| API
    API -->|"Validated cited report"| UI
    UI -->|"Caches report history"| STORAGE
```

---

## 2. RAG Pipeline & Prompt Workflow Diagram

```mermaid
flowchart LR
    subgraph Ingestion ["1. Document Ingestion"]
        DOCS["1–8 Research Papers (PDF/TXT)"] --> EXTRACT["Extract Page Texts"]
        EXTRACT --> CHUNK["Sliding Window Chunking (180 tokens, step 150)"]
        CHUNK --> IDS["Attach Unique Passage IDs (e.g., D1-p2-3)"]
    end

    subgraph Retrieval ["2. Evidence Retrieval"]
        QUERY["Research Question"] --> RETRIEVE["Keyword & Overlap Scoring"]
        IDS --> RETRIEVE
        RETRIEVE --> SELECTION["Top Relevant Passages (Ranked per paper)"]
    end

    subgraph Execution ["3. Workflow Execution"]
        SELECTION --> ROUTER{"Workflow Version"}
        
        ROUTER -->|"V1 Baseline"| V1_STAGE["v1/baseline: Single-call Report Generation"]
        
        ROUTER -->|"V2 Structured"| V2_PLAN["v2/plan: Sub-query Planning"]
        V2_PLAN --> V2_NOTES["v2/notes: Per-paper Evidence Extraction"]
        V2_NOTES --> V2_COMPARE["v2/compare: Cross-paper Comparison"]
        V2_COMPARE --> V2_REPORT["v2/report: Structured Synthesis"]

        ROUTER -->|"V3 Citation Review"| V2_REPORT
        V2_REPORT --> V3_VERIFY["v3/verify: Automated Claim Verification"]
        V3_VERIFY -->|"Evidence Check"| CHECK{"Passages support claims?"}
        CHECK -->|"Supported"| FINAL["Final Verified Report"]
        CHECK -->|"Unsupported & more passages available"| RETRY["Fetch secondary passages & re-verify"]
        RETRY --> V3_VERIFY
    end
```

---

## 3. Task Decomposition Flow

```mermaid
flowchart TD
    START(["Start User Request"]) --> INPUT["Receive Research Question & Up to 8 Papers"]
    
    subgraph Stage1 ["Stage 1: Ingestion & Indexing"]
        INPUT --> P1["Parse PDF text per page"]
        P1 --> P2["Chunk into tagged passages (Dx-py-z)"]
    end

    subgraph Stage2 ["Stage 2: Targeted Retrieval"]
        P2 --> P3["Score passage overlap against question terms"]
        P3 --> P4["Select balanced subset across all uploaded papers"]
    end

    subgraph Stage3 ["Stage 3: Multi-step Reasoning (V2/V3)"]
        P4 --> P5["Plan: Generate targeted queries"]
        P5 --> P6["Notes: Extract findings per paper with citations"]
        P6 --> P7["Compare: Identify agreements, contrasts, and independent findings"]
        P7 --> P8["Draft: Compose report organized by themes"]
    end

    subgraph Stage4 ["Stage 4: Verification & Output"]
        P8 --> P9["Verify: Check every sentence against its cited passage IDs"]
        P9 --> P10["Filter out unsupported or unfaithful claims"]
        P10 --> OUTPUT["Interactive Web Report & Exportable PDF"]
    end
```

---

## 4. Input–Output Flow Diagram

```mermaid
flowchart LR
    IN_Q["User Question (text)"] & IN_FILES["Research Papers (PDF/TXT)"] --> PREPROC["Client Preprocessor"]
    PREPROC --> PAYLOAD["JSON Payload: { question, files: [{name, pages}], version }"]
    PAYLOAD --> BACKEND["Backend Engine (/research)"]
    BACKEND --> PASSAGES["Passage Array: [{ id: 'D1-p1-1', text: '...' }]"]
    PASSAGES --> PROMPTS["Structured Model Prompts"]
    PROMPTS --> LLM_CALLS["LLM Responses (JSON Schema Enforced)"]
    LLM_CALLS --> REPORT_OBJ["Report Object: { question, claims: [{text, citations}], sources, checks }"]
    REPORT_OBJ --> RENDER["Interactive UI + In-context Citation Inspector + Downloadable PDF"]
```
