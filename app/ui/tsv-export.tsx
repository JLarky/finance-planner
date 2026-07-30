import { clientEntry, css, on, type Handle } from "remix/ui";
import { button, muted } from "./styles.ts";

export const TsvExport = clientEntry(
  "/app/ui/tsv-export.tsx",
  function TsvExport(h: Handle<{ content: string; jsonContent: string }>) {
    let status = "";

    async function copy(content: string, successMessage: string) {
      try {
        await navigator.clipboard.writeText(content);
        status = successMessage;
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = content;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        status = copied ? successMessage : "Copy failed. Select the text below.";
      }
      void h.update();
    }

    function download(content: string, filename: string, type: string) {
      const url = URL.createObjectURL(new Blob([content], { type }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      status = `Downloaded ${filename}.`;
      void h.update();
    }

    return () => (
      <section
        mix={css({ borderTop: "1px solid #355744", marginTop: "32px", paddingTop: "32px" })}
        data-export-section
      >
        <p
          mix={css({
            color: "#b8e986",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontSize: "12px",
          })}
        >
          Take it with you
        </p>
        <h2 mix={css({ margin: "10px 0 8px", fontSize: "28px" })}>Export your portfolio</h2>
        <p mix={css({ ...muted, maxWidth: "720px" })}>
          Copy a tab-separated snapshot directly into Google Docs or Sheets, or download the same
          plain-text file for Excel.
        </p>
        <div mix={css({ display: "flex", flexWrap: "wrap", gap: "10px" })}>
          <button
            type="button"
            mix={[
              button({}),
              on(
                "click",
                () => void copy(h.props.content, "Copied — paste it into Google Docs or Sheets."),
              ),
            ]}
            data-copy-export
          >
            Copy tab-separated text
          </button>
          <button
            type="button"
            mix={[
              button({ secondary: true }),
              on("click", () => void copy(h.props.jsonContent, "Copied JSON backup.")),
            ]}
            data-copy-json
          >
            Copy JSON
          </button>
          <button
            type="button"
            mix={[
              button({ secondary: true }),
              on("click", () =>
                download(
                  h.props.content,
                  "finance-planner-export.tsv",
                  "text/tab-separated-values;charset=utf-8",
                ),
              ),
            ]}
            data-download-export
          >
            Download .tsv for Excel
          </button>
          <button
            type="button"
            mix={[
              button({ secondary: true }),
              on("click", () =>
                download(
                  h.props.jsonContent,
                  "finance-planner-backup.json",
                  "application/json;charset=utf-8",
                ),
              ),
            ]}
            data-download-json
          >
            Download JSON backup
          </button>
        </div>
        {status ? (
          <p role="status" mix={css({ color: "#b8e986", marginBottom: 0 })}>
            {status}
          </p>
        ) : null}
        <details mix={css({ marginTop: "20px" })}>
          <summary>Preview plain text</summary>
          <textarea
            readOnly
            value={h.props.content}
            aria-label="Tab-separated export preview"
            mix={css({
              width: "100%",
              minHeight: "180px",
              marginTop: "12px",
              boxSizing: "border-box",
              background: "#0b1b15",
              color: "#d4e1d8",
              border: "1px solid #527061",
              borderRadius: "10px",
              padding: "12px",
              font: "13px ui-monospace, SFMono-Regular, Menlo, monospace",
            })}
          />
        </details>
        <details mix={css({ marginTop: "12px" })}>
          <summary>Preview JSON backup</summary>
          <textarea
            readOnly
            value={h.props.jsonContent}
            aria-label="JSON backup preview"
            mix={css({
              width: "100%",
              minHeight: "180px",
              marginTop: "12px",
              boxSizing: "border-box",
              background: "#0b1b15",
              color: "#d4e1d8",
              border: "1px solid #527061",
              borderRadius: "10px",
              padding: "12px",
              font: "13px ui-monospace, SFMono-Regular, Menlo, monospace",
            })}
          />
        </details>
      </section>
    );
  },
);
