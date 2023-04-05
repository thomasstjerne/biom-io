
import {processWorkBookFromFile} from '../converters/excel.js'




const testExcel = () => {
    processWorkBookFromFile('4f529d9b-4d3f-4a85-a835-64ed71768ec4', `Danish_Reefs_eDNA_tsj.xlsx`, 1, {samples: {}, taxa: {}})
}

//biowideToBiomToDwc('_min')
testExcel()

