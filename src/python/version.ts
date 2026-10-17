/**
 * The pinned Pyodide version. Must equal the exact version in `package.json` (a test checks it):
 * the worker bundles that package's loader, and the loader refuses a runtime of another version.
 * Runtime assets (wasm, stdlib, wheels) come from jsDelivr at this same version.
 */
export const PYODIDE_VERSION = '314.0.7';

/** jsDelivr's Pyodide distribution for {@link PYODIDE_VERSION}. The only network origin used. */
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
