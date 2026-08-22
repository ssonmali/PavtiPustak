"use client";

/**
 * Replaces the root layout when it throws, so it cannot rely on providers,
 * fonts or globals.css. Text is bilingual because the locale cookie is not
 * readable from here.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="mr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#fafafa",
          color: "#0a0a0a",
        }}
      >
        <main style={{ maxWidth: 380, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>
            काहीतरी चूक झाली
          </h1>
          <p style={{ fontSize: 14, color: "#666", margin: "0 0 4px" }}>
            Something went wrong. Your receipts are safe.
          </p>
          {error.digest ? (
            <p style={{ fontSize: 12, color: "#999", fontFamily: "monospace" }}>
              {error.digest}
            </p>
          ) : null}
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              minHeight: 44,
              padding: "0 20px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#fff",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            पुन्हा प्रयत्न करा / Try again
          </button>
        </main>
      </body>
    </html>
  );
}
