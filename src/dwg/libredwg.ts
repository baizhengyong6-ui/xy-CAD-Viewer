import { AcDbDatabaseConverterManager, AcDbFileType } from '@mlightcad/data-model'
import { AcDbLibreDwgConverter } from '@mlightcad/libredwg-converter'
import type { DwgParser } from './types'

export function createLibreDwgParser(): DwgParser {
  return {
    id: 'libredwg',
    license: 'GPL-3.0-only',
    register(workerUrl: string) {
      AcDbDatabaseConverterManager.instance.register(
        AcDbFileType.DWG,
        new AcDbLibreDwgConverter({
          convertByEntityType: false,
          useWorker: true,
          parserWorkerUrl: workerUrl,
        }),
      )
    },
  }
}
