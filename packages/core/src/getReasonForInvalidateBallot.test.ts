import { it } from "node:test";
import * as assert from "node:assert";

import { getReasonForInvalidateBallot } from "./getReasonForInvalidateBallot.js";
import type { BallotFileFormat, VoteFileFormat } from "./parser.js";

const dummyVote: VoteFileFormat = {
  checksum: "/sjnc/rMa4Ux6zRgl3a/DvDpWp+hLwiAR6E2Nj34bUWzkojmy96uw7KkCV1FpKqU28rS3trF1AvKFOOwnDdxOg==",
  candidates: ["a", "b", "c", "d", "e", "f", "g"],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

it("should return null for valid ballots", () => {
  assert.strictEqual(
    getReasonForInvalidateBallot({
      author: "John Smith",
      preferences: [
        { title: "a", score: 0 },
        { title: "b", score: 1 },
        { title: "c", score: 1 },
        { title: "d", score: -0 },
        { title: "e", score: -2 },
        { title: "f", score: -1 },
        { title: "g", score: 0 },
      ],
      poolChecksum: "/sjnc/rMa4Ux6zRgl3a/DvDpWp+hLwiAR6E2Nj34bUWzkojmy96uw7KkCV1FpKqU28rS3trF1AvKFOOwnDdxOg==",
    }, dummyVote),
    null,
  );
});
it("should report missing author", () => {
  assert.deepStrictEqual(
    getReasonForInvalidateBallot({
      preferences: [
        { title: "a", score: 0 },
        { title: "b", score: 1 },
        { title: "c", score: 1 },
        { title: "d", score: -0 },
        { title: "e", score: -2 },
        { title: "f", score: -1 },
        { title: "g", score: 0 },
      ],
      poolChecksum: "/sjnc/rMa4Ux6zRgl3a/DvDpWp+hLwiAR6E2Nj34bUWzkojmy96uw7KkCV1FpKqU28rS3trF1AvKFOOwnDdxOg==",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } satisfies Omit<BallotFileFormat, "author"> as any, dummyVote),
    {
      missingAuthor: true,
    },
  );
});
it("should report empty author", () => {
  assert.deepStrictEqual(
    getReasonForInvalidateBallot({
      author: "",
      preferences: [
        { title: "a", score: 0 },
        { title: "b", score: 1 },
        { title: "c", score: 1 },
        { title: "d", score: -0 },
        { title: "e", score: -2 },
        { title: "f", score: -1 },
        { title: "g", score: 0 },
      ],
      poolChecksum: "/sjnc/rMa4Ux6zRgl3a/DvDpWp+hLwiAR6E2Nj34bUWzkojmy96uw7KkCV1FpKqU28rS3trF1AvKFOOwnDdxOg==",
    }, dummyVote),
    {
      missingAuthor: true,
    },
  );
});
it("should not report additional candidates", () => {
  assert.strictEqual(
    getReasonForInvalidateBallot({
      author: "John Smith",
      preferences: [
        { title: "a", score: 0 },
        { title: "b", score: 1 },
        { title: "c", score: 1 },
        { title: "d", score: -0 },
        { title: "e", score: -2 },
        { title: "f", score: -1 },
        { title: "g", score: 0 },
        { title: "h", score: 0 },
      ],
      poolChecksum: "/sjnc/rMa4Ux6zRgl3a/DvDpWp+hLwiAR6E2Nj34bUWzkojmy96uw7KkCV1FpKqU28rS3trF1AvKFOOwnDdxOg==",
    }, dummyVote),
    null,
  );
});
it("should report missing candidates", () => {
  assert.deepStrictEqual(
    getReasonForInvalidateBallot({
      author: "John Smith",
      preferences: [
        { title: "a", score: 0 },
        { title: "bb", score: 1 },
        { title: "c", score: -0 },
        { title: "e", score: -2 },
        { title: "f", score: -1 },
        { title: "g", score: 0 },
      ],
      poolChecksum: "/sjnc/rMa4Ux6zRgl3a/DvDpWp+hLwiAR6E2Nj34bUWzkojmy96uw7KkCV1FpKqU28rS3trF1AvKFOOwnDdxOg==",
    }, dummyVote),
    {
      missingCandidates: ["b", "d"],
    },
  );
});
it("should report overflow integer scores", () => {
  assert.deepStrictEqual(
    getReasonForInvalidateBallot({
      author: "John Smith",
      preferences: [
        {
          title: "a",
          score: Number.MAX_SAFE_INTEGER + 1,
        },
        { title: "b", score: Number.MAX_SAFE_INTEGER },
        { title: "c", score: Number.MIN_SAFE_INTEGER },
        { title: "d", score: Number.MIN_SAFE_INTEGER - 1 },
        { title: "e", score: Number.MIN_VALUE },
        { title: "f", score: Number.MAX_VALUE },
        { title: "g", score: 0 },
      ],
      poolChecksum: "/sjnc/rMa4Ux6zRgl3a/DvDpWp+hLwiAR6E2Nj34bUWzkojmy96uw7KkCV1FpKqU28rS3trF1AvKFOOwnDdxOg==",
    }, dummyVote),
    {
      candidatesWithInvalidScores: [{
        score: 9007199254740992,
        title: "a",
      },
      {
        score: -9007199254740992,
        title: "d",
      },
      {
        score: 5e-324,
        title: "e",
      },
      {
        score: 1.7976931348623157e+308,
        title: "f",
      }],
    },
  );
});
it("should report non-integer scores", () => {
  assert.deepStrictEqual(
    getReasonForInvalidateBallot({
      author: "John Smith",
      preferences: [
        {
          title: "a",
          // @ts-expect-error score is purposefully mistyped
          score: "1",
        },
        { title: "b", score: 1.1 },
        { title: "c", score: 1.0 },
        // @ts-expect-error score is purposefully mistyped
        { title: "d", score: [0] },
        // @ts-expect-error score is purposefully mistyped
        { title: "e", score: { value: 1 } },
        // @ts-expect-error score is purposefully mistyped
        { title: "f", score: 1n },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { title: "g" } as any as { title: string; score: number },
      ],
      poolChecksum: "/sjnc/rMa4Ux6zRgl3a/DvDpWp+hLwiAR6E2Nj34bUWzkojmy96uw7KkCV1FpKqU28rS3trF1AvKFOOwnDdxOg==",
    }, dummyVote),
    {
      candidatesWithInvalidScores: [
        {
          score: "1",
          title: "a",
        },
        {
          score: 1.1,
          title: "b",
        },
        {
          score: [0],
          title: "d",
        },
        {
          score: { value: 1 },
          title: "e",
        },
        {
          score: 1n,
          title: "f",
        },
        { title: "g" },
      ],
    },
  );
});

it("should report multiple errors at once", () => {
  assert.deepStrictEqual(
    getReasonForInvalidateBallot({
      author: "",
      preferences: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { title: "a" } as any as { title: string; score: number },
        { title: "d", score: 1.1 },
        { title: "c", score: -1.0 },
        { title: "e", score: Infinity },
        { title: "ff", score: 1 },
        { title: "g", score: 0 },
        { title: "h", score: 1 },
      ],
      poolChecksum: "invalid",
    }, {
      checksum: "expected",
      candidates: ["a", "b", "c", "d", "e", "f", "g"],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any),
    {
      missingAuthor: true,
      missingCandidates: ["b", "f"],
      invalidChecksum: {
        actual: "invalid",
        expected: "expected",
      },
      candidatesWithInvalidScores: [
        { title: "a" },
        {
          score: 1.1,
          title: "d",
        },
        {
          score: Infinity,
          title: "e",
        },
      ],
    },
  );
});
