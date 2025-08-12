import * as shamir from "../src/shamir.js";
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

it("should reconstruct a key", () => {
  assert.strictEqual(
    Buffer.from(shamir.reconstruct([
      Buffer.from([0xef, 0x05, 0x70, 0x4a, 0xf2, 0xb2, 0xcd, 0x02]),
      Buffer.from([0x62, 0x1e, 0x41, 0x63, 0xfa, 0x5e, 0x0b, 0x1c]),
      Buffer.from([0xc4, 0xc8, 0x3c, 0x22, 0x53, 0x05, 0x62, 0x0a]),
    ])).toString("hex"),
    Buffer.from("caritat").toString("hex"),
  );
});

describe("should handle a key part being passed twice", () => {
  it("fail when there are not enough key parts", () => {
    assert.notStrictEqual(
      Buffer.from(shamir.reconstruct([
        Buffer.from([0xef, 0x05, 0x70, 0x4a, 0xf2, 0xb2, 0xcd, 0x02]),
        Buffer.from([0x62, 0x1e, 0x41, 0x63, 0xfa, 0x5e, 0x0b, 0x1c]),
        Buffer.from([0xef, 0x05, 0x70, 0x4a, 0xf2, 0xb2, 0xcd, 0x02]),
      ])).toString("hex"),
      Buffer.from("caritat").toString("hex"),
    );
  });
  it("throw if the are incompatible key parts", () => {
    assert.throws(
      () => shamir.reconstruct([
        Buffer.from([0xef, 0x05, 0x70, 0x4a, 0xf2, 0xb2, 0xcd, 0x02]),
        Buffer.from([0x62, 0x1e, 0x41, 0x63, 0xfa, 0x5e, 0x0b, 0x1c]),
        Buffer.from([0xc4, 0xc8, 0x3c, 0x22, 0x53, 0x05, 0x62, 0x02]),
      ]), /There are conflicting key shares/);
  });
  it("succeed when there are enough key parts", () => {
    assert.strictEqual(
      Buffer.from(shamir.reconstruct([
        Buffer.from([0xef, 0x05, 0x70, 0x4a, 0xf2, 0xb2, 0xcd, 0x02]),
        Buffer.from([0x62, 0x1e, 0x41, 0x63, 0xfa, 0x5e, 0x0b, 0x1c]),
        Buffer.from([0xef, 0x05, 0x70, 0x4a, 0xf2, 0xb2, 0xcd, 0x02]),
        Buffer.from([0xc4, 0xc8, 0x3c, 0x22, 0x53, 0x05, 0x62, 0x0a]),
        Buffer.from([0xef, 0x05, 0x70, 0x4a, 0xf2, 0xb2, 0xcd, 0x02]),
      ])).toString("hex"),
      Buffer.from("caritat").toString("hex"),
    );
  });
});

const key = crypto.getRandomValues(new Uint8Array(256));

describe("should reconstruct single byte with enough shareholders", () => {
  const byte = key[0];
  for (let shareHolders = 2; shareHolders < 256; shareHolders++) {
    for (let neededParts = 1; neededParts < shareHolders; neededParts++) {
      it(`Should destruct/reconstruct a key with ${shareHolders} share holders needing ${neededParts} parts`, () => {
        const points = Array.from(
          shamir.generatePoints(byte, shareHolders, neededParts),
        );
        const reconstructed = shamir.reconstructByte(points);
        assert.strictEqual(reconstructed, byte);
      });
    }
  }
});

const shareHolders = 36;
const neededParts = 3;

const parts = shamir.split(key.buffer, shareHolders, neededParts);

it("should not give the whole key to any shareholders", () => {
  const byte = key[0];

  const points = Array.from(
    shamir.generatePoints(byte, shareHolders, neededParts),
  );

  let coincidences = 0;

  for (let i = 0; i < shareHolders; i++) {
    try {
      assert.notStrictEqual(points[i].y, byte);
    } catch (err) {
      if (err?.operator === "notStrictEqual") coincidences++;
    }
  }
  assert.ok(coincidences < neededParts - 1);
});

it("should not generate keys if shareholders is greater than threshold", () => {
  const byte = key[0];

  assert.throws(
    () => {
      shamir.generatePoints(byte, 256, neededParts).next();
    },
    {
      message:
        "Expected 256 <= 255. Cannot have more than shareholders the size of the Gallois field",
    },
  );
});

it("should not generate keys if less shareholders than needed parts", () => {
  const byte = key[0];

  assert.throws(
    () => {
      shamir.generatePoints(byte, 10, 25).next();
    },
    {
      message:
        "Expected 10 < 25. Cannot have more less shareholders than needed parts",
    },
  );
});

it("should reconstruct key from enough shareholders", () => {
  const reconstructed = shamir.reconstruct([parts[1], parts[0], parts[5]]);
  assert.deepStrictEqual(reconstructed, key);
});

it("should fail reconstruct key from not enough shareholders", () => {
  const reconstructed = shamir.reconstruct([parts[1], parts[5]]);
  assert.notDeepStrictEqual(reconstructed, key);
});

it("should fail reconstruct key with duplicate shareholders", () => {
  const reconstructed = shamir.reconstruct([parts[1], parts[5], parts[1]]);
  assert.notDeepStrictEqual(reconstructed, key);
});

it("should still reconstruct key with too many shareholders", () => {
  const reconstructed = shamir.reconstruct(parts);
  assert.deepStrictEqual(reconstructed, key);
});

it(
  "should reconstruct key faster when specifying neededParts",
  { skip: (shareHolders as number) === (neededParts as number) },
  () => {
    const s1 = performance.now();
    const reconstructed1 = shamir.reconstruct(parts, neededParts);
    const t1 = performance.now() - s1;

    const s2 = performance.now();
    const reconstructed2 = shamir.reconstruct(parts);
    const t2 = performance.now() - s2;

    assert.deepStrictEqual(reconstructed1, key);
    assert.deepStrictEqual(reconstructed2, key);

    assert.ok(t2 >= t1);
  },
);
