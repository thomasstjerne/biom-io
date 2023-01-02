# biom-io

In order to run large datasets (e.g. Global soil), increase heap space
`export NODE_OPTIONS="--max-old-space-size=6144" # Increase to 6 GB`


Test result, Global soil:
````
Reading Global Soil dataset to Biom
Taxa: 722682 samples: 3200
toBiom: 11:55.952 (m:ss.mmm)
addReadCounts: 1:00.674 (m:ss.mmm)
````