
const dwcTerms = require('./dwcTerms')
const metaXml = require('./metaXml')
const streamReader = require('./streamReader')
// Function to swap key value pairs
const objectSwap = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [v, k]))




module.exports = {
    metaXml,
    dwcTerms,
    objectSwap,
    streamReader
}
