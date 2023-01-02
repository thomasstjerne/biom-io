module.exports = (occCore, dnaExt) => {
const coreTerms = occCore.map((term, idx) => `<field index="${idx+1}" term="${term.qualName}"/>`).join(`
`);
const dnaTerms = dnaExt.map((term, idx) => `<field index="${idx+1}" term="${term.qualName}"/>`).join(`
`);

return `<archive
xmlns="http://rs.tdwg.org/dwc/text/" metadata="eml.xml">
<core encoding="utf-8" fieldsTerminatedBy="\\t" linesTerminatedBy="\\n" fieldsEnclosedBy="" ignoreHeaderLines="0" rowType="http://rs.tdwg.org/dwc/terms/Occurrence">
    <files>
        <location>occurrence.txt</location>
    </files>
    <id index="0" />
    <field index="0" term="http://rs.tdwg.org/dwc/terms/occurrenceID"/>
    ${coreTerms}
</core>

<extension encoding="UTF-8" fieldsTerminatedBy="\\t" linesTerminatedBy="\\n" fieldsEnclosedBy='' ignoreHeaderLines="0" rowType="http://rs.gbif.org/terms/1.0/DNADerivedData">
<files>
  <location>dna.txt</location>
</files>
<coreid index="0" />
    ${dnaTerms}
</extension>
</archive>
`
}

