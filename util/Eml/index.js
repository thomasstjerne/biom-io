import licenseEnum from "../../enum/license.js"

const getBibliography = (biblioGraphicReferences) => {
    if(!biblioGraphicReferences){
        return ""
    } else {
      const refs = Object.keys(biblioGraphicReferences).map(k => `<citation identifier="DOI:${k}">${biblioGraphicReferences[k]}</citation>`)
      return `<bibliography>${refs.join("")}</bibliography>`
    }
}

const getMethodSteps = (methodSteps) => {
    if(!methodSteps || methodSteps?.length === 0){
        return null
    } else {
      return methodSteps.map(s => `<methodStep>
      <description>
          <para>${s}</para>
      </description>
  </methodStep>`).join("")
    }
}

const getKeywords = (keywords) => {
    if(!keywords || keywords?.length === 0){
        return ""
    } else {
      let kWords = keywords.map(s => `<keyword>${s}</keyword>`).join("")
      return `<keywordSet>${kWords}</keywordSet>`
    }
}

const getComplexType = (entity, attrs, atrrName) => {
    return attrs.find(key => entity.hasOwnProperty(key)) ? `<${atrrName}>` + 
        attrs.map(a => entity?.[a] ? `<${a}>${entity[a]}</${a}>` : "").join("")
        +  `</${atrrName}>`: "";
}

const getAgent = (agent, type) => {
    if(!agent){
        return ""
    } else {

        const individualName = getComplexType(agent, ['givenName', 'surName'], 'individualName')
        const address = getComplexType(agent, ['deliveryPoint', 'city', 'postalCode', 'administrativeArea', 'country'], 'address');
      return  `<${type}>
    ${individualName}
    ${agent?.organizationName ? `<organizationName>${agent?.organizationName}</organizationName>` : ""}
    ${agent?.positionName ? `<positionName>${agent?.positionName}</positionName>` : ""}
    ${address}
    ${agent?.phone ? `<phone>${agent?.phone}</phone>` : ""}
    ${agent?.electronicMailAddress ? `<electronicMailAddress>${agent?.electronicMailAddress}</electronicMailAddress>` : ""}
    ${agent?.userId ? `<userId directory="http://orcid.org/">${agent?.userId}</userId>` : ""}
    
    </${type}>`
    } 
}

export const getEml = ({id, license, title, description, contact, creator, methodSteps, doi, url, biblioGraphicReferences, keywords}) => {
    if(!licenseEnum[license]){
        throw "invalid or missing license"
    }
    const methods = getMethodSteps(methodSteps);
    return `
    <eml:eml
        xmlns:eml="eml://ecoinformatics.org/eml-2.1.1"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             xsi:schemaLocation="eml://ecoinformatics.org/eml-2.1.1 http://rs.gbif.org/schema/eml-gbif-profile/1.1/eml.xsd"
            packageId="${id}"  system="http://gbif.org" scope="system"
      xml:lang="en">
        <dataset>
            ${doi ? `<alternateIdentifier>https://doi.org/${doi}</alternateIdentifier>` : ""}
            <title>${title}</title>
            ${creator && creator?.length > 0 ? creator.map(c => getAgent(c, 'creator')).join("") : ""}
            <pubDate>
          ${new Date().toISOString().split("T")[0]}
          </pubDate>
            <language>ENGLISH</language>
            ${description ? `<abstract>
            <para>${description}</para>
        </abstract>` : "" }
            ${getKeywords(keywords)}
            <intellectualRights>
                <para>This work is licensed under a 
                    <ulink url="${licenseEnum[license].url}">
                        <citetitle>${licenseEnum[license].url}</citetitle>
                    </ulink>.
                </para>
            </intellectualRights>
            <maintenance>
                <maintenanceUpdateFrequency>unkown</maintenanceUpdateFrequency>
            </maintenance>
            ${getAgent(contact, 'contact')}
           ${methods ? `<methods>
            ${methods}
        </methods>` : ""}
        </dataset>
        <additionalMetadata>
            <metadata>
                <gbif>
                    ${getBibliography(biblioGraphicReferences)}
                </gbif>
            </metadata>
        </additionalMetadata>
    </eml:eml>`
} 