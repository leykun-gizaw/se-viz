/**
 * Sample data files for Python programs (Phase 35): a small synthetic farm dataset made up for this
 * repo (30 plots; region, crop, rainfall_mm, yield_kg, fertilized; a few values missing on
 * purpose). The worker writes each file into Pyodide's virtual file system, in the working
 * directory, before every run, so `pd.read_csv("farm.csv")` works offline. Only the worker imports
 * this module, so the text ships in the worker chunk, not the main one.
 *
 * @packageDocumentation
 */
import farmCsv from './farm.csv?raw';

export interface SampleFile {
  /** File name in the program's working directory (`/home/pyodide`). */
  path: string;
  text: string;
}

export const SAMPLE_FILES: readonly SampleFile[] = [{ path: 'farm.csv', text: farmCsv }];

/** The part of Pyodide's file system API this needs. */
interface WritableFs {
  FS: { writeFile(path: string, data: string): void; cwd(): string };
}

/**
 * Write (or restore) the sample files in the working directory. Called before every run, so a
 * program that overwrote `farm.csv` doesn't change the next run's data.
 */
export function installSampleFiles(pyodide: WritableFs): void {
  const dir = pyodide.FS.cwd();
  for (const f of SAMPLE_FILES) pyodide.FS.writeFile(`${dir}/${f.path}`, f.text);
}
