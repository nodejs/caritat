#!/usr/bin/env node

// Usage: curl -L <url-to-vote.yml> | npx --package=@node-core/caritat extractEncryptedPrivateKey | gpg -d |\
//          npx --package=@node-core/caritat countBallotsFromGit -r <repo> -b <branch> -p <subpath> |\
//          gh pr comment <url-to-pr> --body-file -

import { stdout, argv } from "process";
import fs from "fs/promises";

import { load } from "js-yaml";
import readStdIn from "../utils/readStdin.js";
import type { VoteFileFormat } from "@node-core/caritat/parser.js";

const [, , yamlFile] = argv;

let data: string;
if (yamlFile === "--help" || yamlFile === "-h") {
  console.log("Usage: extractEncryptedPrivateKey <path-to-YAML-file>");
  console.log("or");
  console.log(
    "Usage: echo 'encryptedPrivateKey: …' | extractEncryptedPrivateKey",
  );
  process.exit();
} else if (yamlFile == null) {
  data = await readStdIn(true);
} else {
  data = await fs.readFile(yamlFile, "utf8");
}

stdout.write((load(data) as VoteFileFormat).encryptedPrivateKey);
