/**
 * Replaceable DWG parser.
 *
 * The default implementation is LibreDWG (GPL-3.0) running in a Web Worker.
 * A later commercial parser can implement this interface and be registered
 * instead, without changing the viewer shell.
 */
export interface DwgParser {
  readonly id: string
  readonly license: string
  register(workerUrl: string): void
}
