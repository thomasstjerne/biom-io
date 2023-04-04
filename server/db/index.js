
import dbImplementation from './duckDbImpl.js'



export const createUserDataset = dbImplementation.createUserDataset;

export const getUserDatasets = dbImplementation.getUserDatasets;

export default {
    createUserDataset,
    getUserDatasets
}