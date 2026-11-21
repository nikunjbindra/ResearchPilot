# ResearchPilot

ResearchPilot helps you answer a question across research papers and trace each finding to the passage behind it. Upload searchable PDFs or text files, ask a question, and click a citation to read the evidence in context.

**Live Prototype:** [https://researchpilot-six.vercel.app/](https://researchpilot-six.vercel.app/)

## Prompt engineering workflows

| Version | Purpose | How it works |
| --- | --- | --- |
| V1 | Baseline | Generates a cited draft in one model call. |
| V2 | Structured answer | Plans the search, extracts notes, organizes evidence around the question, and writes findings under descriptive headings. |
| V3 | Citation review | Checks draft claims against their cited passages and the question. If no finding survives and more passages are available, it tries a second set. |

V3 is the default. Open **Experiment workspace** to compare versions on the same inputs, revisit saved reports, or export run history as JSON. Citation review is model-assisted and can miss evidence. Open the cited passages to check important findings.

## Run locally

Use Node.js 22.13 or newer. Open a terminal in the folder containing `package.json`.

On Windows (PowerShell):
```powershell
npm.cmd install
Copy-Item .env.example .env
```

On macOS / Linux:
```bash
npm install
cp .env.example .env
```

Open `.env` and set `GROQ_API_KEY` to your own key. The example selects Groq and the model `openai/gpt-oss-120b`. Then start the server:

```powershell
npm.cmd start
```

Open **http://localhost:3737** or the address printed in the terminal if you changed `PORT`. The Node server handles document processing and model requests. Publishing the source on GitHub does not start that server.

## Use the workspace

1. Select **Start research**, enter your question, and add up to eight files (16 MB combined). Scanned PDFs need OCR before upload.
2. Generate the report. Select a citation to inspect its source passage. Original PDF links are available during the upload session.
3. Select **Download report as PDF** to export the findings, review status, coverage and cited passages. Exported pages contain rendered images.
4. If Groq pauses a run for quota, wait for the limit to reset and select **Resume research** using the same browser, port and project folder.

## Project files and data

- `public/` contains the browser interface and PDF export.
- `code/` contains the Node server, retrieval and review workflow, and automated tests.
- `prompts/` contains the active prompt templates and revision history.
- `.env.example` documents the configuration. Keep the actual API key in the ignored `.env` file.

With Groq selected, the server sends the question and selected excerpts to Groq. Report history uses browser storage. Paused runs use local checkpoints under `runs/`; failed or dismissed runs can leave checkpoints there.

## Tests

Run `npm test` (Windows PowerShell: `npm.cmd test`). The workflow tests use simulated model responses and run without an API key.
