import defaultValueterms from "../enum/defaultValueterms.js";

export const getGroupMetaDataAsJsonString = (termMapping) => {
  if(termMapping?.defaultValues && Object.keys(termMapping?.defaultValues).length > 0){
    let json = {};
    Object.keys(termMapping?.defaultValues).forEach(key => {
        const term = defaultValueterms.find(t => t?.name === key);
        if(!json[term.biomGroup]){
            json[term.biomGroup] = { [key]: termMapping?.defaultValues[key]}
        } else {
            json[term.biomGroup][key] = termMapping?.defaultValues[key]
        }
    })
    return JSON.stringify({defaultValues: json})
  } else {
    return ""
  }

}