import { spawn } from "child_process";
import type { SpawnOptions } from "child_process";
import { createInterface } from "readline";

export default async function* streamChildProcessStdout(
  cmd: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[] | readonly string[],
  spawnArgs?: SpawnOptions,
) {
  const child = spawn(cmd, args, {
    stdio: ["inherit", "pipe", "inherit"],
    ...spawnArgs,
  });
  const promise = new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`${cmd} ${args} failed: ${code}`));
      }
      resolve();
    });
  });
  yield* createInterface({ input: child.stdout });
  return promise;
}
