/**
 * Lets `node --test` run the repo's TypeScript directly.
 *
 * Node strips types natively, but its ESM resolver insists on file extensions
 * while the codebase imports `./cycle-phase` without one, the way the Next
 * bundler expects. This hook tries `.ts` and `.tsx` for a relative specifier
 * that does not resolve as written, and maps the `@/` alias to `src/`. It is
 * the whole test toolchain: no runner, transpiler, or config to keep in step
 * with the app's own TypeScript.
 *
 * Usage:  node --import ./scripts/node-ts-resolve.mjs --test "src/**\/*.test.ts"
 */
import { dirname, resolve as resolvePath } from "node:path";
import { register } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");

register(
  new URL(
    `data:text/javascript,${encodeURIComponent(`
      import { existsSync } from "node:fs";
      import { resolve as resolvePath } from "node:path";
      import { fileURLToPath, pathToFileURL } from "node:url";
      const ROOT = ${JSON.stringify(ROOT)};
      const EXTENSIONS = [".ts", ".tsx", "/index.ts"];
      export async function resolve(specifier, context, next) {
        let candidate = specifier;
        if (specifier.startsWith("@/")) {
          candidate = pathToFileURL(resolvePath(ROOT, "src", specifier.slice(2))).href;
        }
        try {
          return await next(candidate, context);
        } catch (error) {
          if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
          const base = candidate.startsWith("file:")
            ? fileURLToPath(candidate)
            : context.parentURL && (candidate.startsWith("./") || candidate.startsWith("../"))
              ? resolvePath(fileURLToPath(context.parentURL), "..", candidate)
              : null;
          if (base) {
            for (const extension of EXTENSIONS) {
              if (existsSync(base + extension)) {
                return next(pathToFileURL(base + extension).href, context);
              }
            }
          }
          throw error;
        }
      }
    `)}`
  )
);
