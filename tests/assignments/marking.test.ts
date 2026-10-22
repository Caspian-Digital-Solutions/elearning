import { describe, expect, it } from "vitest";
import {
  assignDoubleMarkSample,
  assignmentMarkPassed,
  differenceRequiresFinalReview,
  doubleMarkSampleSize,
  selectReleasedReviewTotal,
} from "@/lib/assignments/validators";

describe("doubleMarkSampleSize", () => {
  it("uses ceil of percentage with minimum 1 when pool ≥ 1", () => {
    expect(doubleMarkSampleSize(5, 20)).toBe(1);
    expect(doubleMarkSampleSize(10, 20)).toBe(2);
    expect(doubleMarkSampleSize(0, 20)).toBe(0);
  });
});

describe("assignDoubleMarkSample", () => {
  it("samples per department and never assigns the learner as reviewer", () => {
    const report = assignDoubleMarkSample(
      [
        { id: "s1", learnerId: "u1", departmentId: "d1" },
        { id: "s2", learnerId: "u2", departmentId: "d1" },
        { id: "s3", learnerId: "u3", departmentId: "d2" },
      ],
      [
        { departmentId: "d1", championUserIds: ["c1", "u1"] },
        { departmentId: "d2", championUserIds: ["c2"] },
      ],
      50,
      () => 0,
    );
    expect(report.assignments.length).toBeGreaterThan(0);
    for (const row of report.assignments) {
      const submission = ["s1", "s2", "s3"].find((id) => id === row.submissionId);
      expect(submission).toBeTruthy();
      expect(row.reviewerId).not.toBe(
        row.submissionId === "s1" ? "u1" : row.submissionId === "s2" ? "u2" : "u3",
      );
    }
    expect(report.skippedDepartments).toEqual([]);
  });

  it("reports departments without a champion", () => {
    const report = assignDoubleMarkSample(
      [{ id: "s1", learnerId: "u1", departmentId: "d9" }],
      [],
      20,
    );
    expect(report.assignments).toEqual([]);
    expect(report.skippedDepartments).toEqual([
      { departmentId: "d9", reason: "No active champion in this department." },
    ]);
  });
});

describe("differenceRequiresFinalReview", () => {
  const maxTotal = 20;

  it("does not require final below the threshold", () => {
    expect(differenceRequiresFinalReview(14, 12, maxTotal, 15)).toBe(false);
  });

  it("requires final at exactly the threshold", () => {
    expect(differenceRequiresFinalReview(17, 14, maxTotal, 15)).toBe(true);
  });
});

describe("selectReleasedReviewTotal", () => {
  it("prefers final over primary", () => {
    const total = selectReleasedReviewTotal([
      { kind: "primary", total: 14 },
      { kind: "double_mark", total: 16 },
      { kind: "final", total: 15 },
    ]);
    expect(total).toBe(15);
  });

  it("falls back to primary when no final exists", () => {
    expect(
      selectReleasedReviewTotal([
        { kind: "primary", total: 12 },
        { kind: "double_mark", total: 11 },
      ]),
    ).toBe(12);
  });
});

describe("assignmentMarkPassed", () => {
  it("passes at the pass mark boundary", () => {
    expect(assignmentMarkPassed(12, 20, 60)).toBe(true);
    expect(assignmentMarkPassed(11, 20, 60)).toBe(false);
  });
});
