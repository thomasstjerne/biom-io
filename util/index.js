
/* const dwcTerms = require('./dwcTerms')
const metaXml = require('./metaXml')
const streamReader = require('./streamReader') */
import dwcTerms from './dwcTerms.js';
import metaXml from './metaXml.js';
import sr from './streamReader.js';
// Function to swap key value pairs
const objectSwap = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [v, k]))


export const streamReader = sr ;

export default {
    metaXml,
    dwcTerms,
    objectSwap,
    streamReader
}
