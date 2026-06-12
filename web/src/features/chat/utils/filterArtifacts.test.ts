import { describe, expect, it } from "vitest";

import type { ArtifactRecord } from "@/types/mediaViewer";
import {
  artifactsForPicker,
  filterArtifacts,
  truncateDisplayName,
} from "@media-viewer/utils/filterArtifacts";

function makeArtifact(
  overrides: Partial<ArtifactRecord> & Pick<ArtifactRecord, "id" | "filename" | "kind">,
): ArtifactRecord {
  return {
    mime_type: "application/octet-stream",
    size_bytes: 100,
    created_at: "2026-06-12T00:00:00Z",
    source: "manual",
    source_chat_session_id: null,
    source_message_id: null,
    metadata: {
      width: null,
      height: null,
      duration_seconds: null,
      page_count: null,
      language: null,
      checksum_sha256: null,
    },
    ...overrides,
  };
}

const SAMPLE_ARTIFACTS: ArtifactRecord[] = [
  makeArtifact({ id: "1", filename: "notes.md", kind: "markdown" }),
  makeArtifact({ id: "2", filename: "diagram.png", kind: "image" }),
  makeArtifact({ id: "3", filename: "clip.mp4", kind: "video" }),
  makeArtifact({ id: "4", filename: "report.PDF", kind: "pdf" }),
  makeArtifact({ id: "5", filename: "deploy.sh", kind: "text" }),
];

describe("filterArtifacts", () => {
  it("returns all artifacts when query and filter are empty", () => {
    expect(filterArtifacts(SAMPLE_ARTIFACTS)).toHaveLength(5);
  });

  it("filters by case-insensitive title substring", () => {
    expect(
      filterArtifacts(SAMPLE_ARTIFACTS, { query: "report" }).map((a) => a.id),
    ).toEqual(["4"]);
    expect(
      filterArtifacts(SAMPLE_ARTIFACTS, { query: ".MD" }).map((a) => a.id),
    ).toEqual(["1"]);
  });

  it("filters documents by kind", () => {
    expect(
      filterArtifacts(SAMPLE_ARTIFACTS, { typeFilter: "documents" }).map(
        (a) => a.id,
      ),
    ).toEqual(["1", "4", "5"]);
  });

  it("filters images and videos by kind", () => {
    expect(
      filterArtifacts(SAMPLE_ARTIFACTS, { typeFilter: "images" }).map(
        (a) => a.id,
      ),
    ).toEqual(["2"]);
    expect(
      filterArtifacts(SAMPLE_ARTIFACTS, { typeFilter: "videos" }).map(
        (a) => a.id,
      ),
    ).toEqual(["3"]);
  });

  it("combines title search with type filter", () => {
    expect(
      filterArtifacts(SAMPLE_ARTIFACTS, {
        query: "deploy",
        typeFilter: "documents",
      }).map((a) => a.id),
    ).toEqual(["5"]);
    expect(
      filterArtifacts(SAMPLE_ARTIFACTS, {
        query: "deploy",
        typeFilter: "images",
      }),
    ).toHaveLength(0);
  });
});

describe("truncateDisplayName", () => {
  it("returns the original name when within the limit", () => {
    expect(truncateDisplayName("short-name.md")).toBe("short-name.md");
  });

  it("truncates long names with an ellipsis", () => {
    const longName = "a".repeat(40);
    expect(truncateDisplayName(longName)).toHaveLength(35);
    expect(truncateDisplayName(longName).endsWith("…")).toBe(true);
  });
});

describe("artifactsForPicker", () => {
  it("returns the most recent artifacts when not searching", () => {
    const artifacts = [
      makeArtifact({
        id: "old",
        filename: "old.txt",
        kind: "text",
        created_at: "2026-06-10T00:00:00Z",
      }),
      makeArtifact({
        id: "new",
        filename: "new.txt",
        kind: "text",
        created_at: "2026-06-12T00:00:00Z",
      }),
    ];

    expect(artifactsForPicker(artifacts).map((artifact) => artifact.id)).toEqual(
      ["new", "old"],
    );
  });

  it("limits results to ten artifacts", () => {
    const artifacts = Array.from({ length: 12 }, (_, index) =>
      makeArtifact({
        id: String(index),
        filename: `file-${index}.txt`,
        kind: "text",
        created_at: `2026-06-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
      }),
    );

    expect(artifactsForPicker(artifacts)).toHaveLength(10);
  });

  it("returns the most relevant matches when searching", () => {
    const artifacts = [
      makeArtifact({ id: "1", filename: "report-final.pdf", kind: "pdf" }),
      makeArtifact({ id: "2", filename: "report.pdf", kind: "pdf" }),
      makeArtifact({ id: "3", filename: "my-report-notes.pdf", kind: "pdf" }),
    ];

    expect(
      artifactsForPicker(artifacts, { query: "report" }).map(
        (artifact) => artifact.id,
      ),
    ).toEqual(["2", "1", "3"]);
  });
});
