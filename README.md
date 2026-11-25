# Fatalities dataset assistant

A local chatbot translates questions into SQLite queries against the supplied CSV using node-llama-cpp and Qwen2.5-Coder. It shows the generated SQL and actual query results, not an AI-generated legal conclusion. The local model can misinterpret questions or generate incorrect queries. It cannot reliably answer every question.

## Start

1. Install Node.js 24 or later. In this directory, run `npm install`.
2. Download [Qwen2.5-Coder-3B-Instruct Q4_K_M](https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct-GGUF) (about 2.1 GB) and save it as `%LOCALAPPDATA%\fatalities-dataset-assistant\models\qwen2.5-coder-3b-instruct-q4_k_m.gguf`. On other platforms, the default is `~/.local/share/fatalities-dataset-assistant/models/` with the same filename. Alternatively, set `MODEL_PATH` to an existing compatible GGUF model.
3. Run `node server.js` in this directory.
4. Open `http://127.0.0.1:3000` and ask a question. Open the app through this local server, not by opening the HTML file directly. The server loads the CSV next to it automatically. Set the `PORT` environment variable before starting to change the port. The first question loads the model and can take longer. Only one question is processed at a time.

The model and runtime are downloaded during setup, but inference runs in the application process, not through an external AI service. Questions and up to four previous successful question/query pairs are given to the local model. Review the machine and local setup before using confidential or privileged material. No authentication is provided; this is a single-user local tool, not a deployment for a shared machine.

## Interpretation and limitations

- The CSV is loaded read-only into an in-memory database for each query. Its SHA-256 fingerprint is displayed, and a changed file requires a server restart. Preserve the original and document provenance separately.
- `record_id` is the 1-based CSV record number, including the header. Quoted multiline fields mean it may not match the physical line number. The CSV's original sources, completeness, accuracy, and chain of custody are not established by this tool.
- Empty fields become SQL NULL; `Unknown` and other stated classifications remain distinct. Dates and classifications reflect the source file. Do not infer legal responsibility, criminality, or verified facts from a category or model output.
- Examine the SQL and compare relevant records and notes with the original CSV and independent evidence. Aggregate results do not automatically identify their supporting records; ask a separate listing question and verify its filters. Listings should include `record_id`, but verify that the generated SQL does so.
- The result display stops at 100 rows and explicitly marks truncation. Ask for narrower results when needed. Queries are read-only, time-limited, and cannot use comments or semicolons. Complex or ambiguous questions may need to be broken down; query errors are reported rather than silently replaced.
- Prior successful questions and queries provide limited follow-up context; clearing the conversation removes it from the page. A model's interpretation and generated SQL are unverified, and this tool is not legal advice.

Run focused checks with `node --test test.js`.
