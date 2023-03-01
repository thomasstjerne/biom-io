
######################################
############### README ###############
######################################

# this script contains the following parts, 
# Dada2 workflow with cutadapt primer removal, cleaning, and denoising. Taxonomic annotation of the cleaned ASVs and some formatting to create output files for  genetic and ecological analysis.
# this script refers to analysis of the 12S markers with regard to filenames, primer sequences and reference libraries. Otherwise its similar to the other markers used in this anlysis (18S, COI).

##################
## installation ##
##################

install.packages("dada2")
packageVersion("dada2")
# alternatively 
if (!requireNamespace("BiocManager", quietly = TRUE))
  install.packages("BiocManager")
BiocManager::install("dada2", version = "3.13")
BiocManager::install("ShortRead")
BiocManager::install("Biostrings")
install.packages("devtools")
install.packages("tidyverse")
install.packages("dplyr")                                         
install.packages("plyr")                                         
install.packages("readr")                                        

library(dada2)
library(ShortRead)
library(Biostrings)
library ("devtools")
library("tidyverse")
library("dplyr")                                                 
library("plyr")                                                  
library("readr")                                                 

################################################################################
##### Dada2 workflow with cutadapt primer removal, cleaning, and denoising #####
################################################################################

# link for a specific cutadapt tutorial: https://benjjneb.github.io/dada2/COI_workflow.html
# link for a general DADA2 workflow tutorial: https://benjjneb.github.io/dada2/tutorial.html
# To save intensive computation output (e.g. to continue at a later point in time), save R sessions as:
# setwd("C:/Users/...") to set directory the session is supposed to be stored in
# save.image(file="Analysis.RData")
# Load a session in R: load("your_session_name.RData") (make sure directory path is still valid)
# Alternatively, save RDS-files of particular objects (tables, algorithm calculations, etc.). Check below in the workflow.
# Load RDS-files into R with readRDS()
# Avoid spaces in folder names in the entire path of input data (e.g. fastq.gz files). This can cause issues with reading in data in the downstream analysis process

# directory containing the fastq.gz files
path <- "/Users/...<folderName>"
# check 
list.files(path)

# generate matched lists of the forward and reverse read files, as well as parsing out the sample name
fnFs <- sort(list.files(path, pattern = "_R1_001.fastq.gz", full.names = TRUE))
fnRs <- sort(list.files(path, pattern = "_R2_001.fastq.gz", full.names = TRUE))

# Designate sequences [including ambiguous nucleotides (base = N, Y, W, etc.) if present) of the primers used
# These "I" bases are not part of IUPAC convention and are not recognized by the packages used here. Change "I"s to "N"s.

FWD <- "GTCGGTAAAACTCGTGCCAGC"  ## forward primer sequence
REV <- "CATAGTGGGGTATCTAATCCCAGTTTG" ## reverse primer

# Verify the presence and orientation of these primers in the data
allOrients <- function(primer) {
  # Create all orientations of the input sequence
  require(Biostrings)
  dna <- DNAString(primer)  # The Biostrings works w/ DNAString objects rather than character vectors
  orients <- c(Forward = dna, Complement = complement(dna), Reverse = reverse(dna), 
               RevComp = reverseComplement(dna))
  return(sapply(orients, toString))  # Convert back to character vector
}
FWD.orients <- allOrients(FWD)
REV.orients <- allOrients(REV)
FWD.orients
REV.orients

# Calculate number of reads where forward and reverse primers appear (Considering all possible primer orientations. Only exact matches are found.).
# This is is sufficient, assuming all the files were created using the same library preparation.

numbers <- seq(from = 1, to = 61, by = 1)
for(i in numbers) 
{
  primerHits <- function(primer, fn) {
    # Counts number of reads in which the primer is found
    nhits <- vcountPattern(primer, sread(readFastq(fn)), fixed = FALSE)
    return(sum(nhits > 0)) 
  }
  tab <- rbind(FWD.ForwardReads = sapply(FWD.orients, primerHits, fn = fnFs[[i]]), 
               FWD.ReverseReads = sapply(FWD.orients, primerHits, fn = fnRs[[i]]), 
               REV.ForwardReads = sapply(REV.orients, primerHits, fn = fnFs[[i]]), 
               REV.ReverseReads = sapply(REV.orients, primerHits, fn = fnRs[[i]]))
  write.table(tab,  file = paste(i, ".csv"), row.names=F,  sep = ",")
}

# Output interpretation if primers occur in the raw reads correctly:
# FWD primer is found in the forward reads in its forward orientation
# FWD primer is also found in some of the reverse reads in its reverse-complement orientation (due to read-through when the COI region is short)
# REV primer is also found with its expected orientations

# Use cutadapt for primer removal (prior installation of cutadapt on your machine via python, anaconda, etc. required)
# Tell R the path to cutadapt.
# Check installed version of cutadapt.

# find ~ -name "cutadapt" #if you write this cmd in the terminal you get all paths to cudadapt, try them to find the righ one
cutadapt <- "<add path to cutadapt>"
system2(cutadapt, args = "--version") # see if R recognizes cutadapt and shows its version

# Create output filenames for the cutadapt-ed files.
# Define the parameters for the cutadapt command.
# See here for a detailed explanation of paramter settings: https://cutadapt.readthedocs.io/en/stable/guide.html#

path.cut <- file.path(path, "cutadapt")
if(!dir.exists(path.cut)) dir.create(path.cut)
fnFs.cut <- file.path(path.cut, basename(fnFs))
fnRs.cut <- file.path(path.cut, basename(fnRs))

FWD.RC <- dada2:::rc(FWD)
REV.RC <- dada2:::rc(REV)
# Trim FWD and the reverse-complement of REV off of R1 (forward reads)
R1.flags <- paste("-g", FWD, "-a", REV.RC) 
# Trim REV and the reverse-complement of FWD off of R2 (reverse reads)
R2.flags <- paste("-G", REV, "-A", FWD.RC) 
# Run Cutadapt
for(i in seq_along(fnFs)) {
  system2(cutadapt, args = c(R1.flags, R2.flags, "-m",1, # -e sets the allowed error, -m 1 discards sequences of length zero after cutadapting
                             "-n", 2, # -n 2 required to remove FWD and REV from reads
                             "-o", fnFs.cut[i], "-p", fnRs.cut[i], # output files
                             fnFs[i], fnRs[i])) # input files
}

# see here for a detailed explanation of the output:
# https://cutadapt.readthedocs.io/en/stable/guide.html#cutadapt-s-output
# Count the presence of primers in the first cutadapt-ed sample as a check if cutadapt worked:

rbind(FWD.ForwardReads = sapply(FWD.orients, primerHits, fn = fnFs.cut[[1]]), 
      FWD.ReverseReads = sapply(FWD.orients, primerHits, fn = fnRs.cut[[1]]), 
      REV.ForwardReads = sapply(REV.orients, primerHits, fn = fnFs.cut[[1]]), 
      REV.ReverseReads = sapply(REV.orients, primerHits, fn = fnRs.cut[[1]]))

# The primer-free sequence files are now ready to be analyzed.
# Forward and reverse fastq filenames have the format:
cutFs <- sort(list.files(path.cut, pattern = "_R1_001.fastq.gz", full.names = TRUE))
cutRs <- sort(list.files(path.cut, pattern = "_R2_001.fastq.gz", full.names = TRUE))

# Check if forward and reverse files match:
if(length(cutFs) == length(cutRs)) print("Forward and reverse files match. Go forth and explore")
if (length(cutFs) != length(cutRs)) stop("Forward and reverse files do not match. Better go back and have a check")

# Extract sample names, assuming filenames have format:
get.sample.name <- function(fname) strsplit(basename(fname), "_")[[1]][2]
sample.names <- unname(sapply(cutFs, get.sample.name))
head(sample.names)

# Inspect read quality profile

# forward reads of all samples 
plotQualityProfile(cutFs) # adjust sample selection cutFs[...] accordingly

# reverse reads of all samples 
plotQualityProfile(cutRs) # adjust sample selection cutRs[...] accordingly

# Reverse reads will most likely show a quality drop "earlier" (so not just towards the end of the reads) compared to forward reads. This is common.

# Save the quality profile plots:
forward_qual_plots<-plotQualityProfile(cutFs)
jpeg(file="Quality_Plot_forward.jpg",res=300, width=15, height=8, unCOI="in")
forward_qual_plots
dev.off()

reverse_qual_plots<-plotQualityProfile(cutRs)
jpeg(file="Quality_Plot_reverse.jpg",res=300, width=15, height=8, unCOI="in")
reverse_qual_plots
dev.off()

## Filter and trim ##

# Assigning the filenames for the output of the filtered reads to be stored as fastq.gz files.
filtFs <- file.path(path.cut, "filtered", basename(cutFs))
filtRs <- file.path(path.cut, "filtered", basename(cutRs))

# Set filtering parameters #
# See https://benjjneb.github.io/dada2/COI_workflow.html for detailed description of the parameters to be set.
out <- filterAndTrim(cutFs, filtFs, cutRs, filtRs, maxN = 0, maxEE = 2, 
                     truncQ = 2, minLen = 50, rm.phix = TRUE, compress = TRUE, multithread = FALSE) 

# Save this output as RDS file:
saveRDS(out, "<add path>")

# check how many reads remain after filtering
out

# Check that files names match
sample.names <- sapply(strsplit(basename(filtFs), "_"), `[`, 1) # Assumes filename = samplename_XXX.fastq.gz
sample.namesR <- sapply(strsplit(basename(filtRs), "_"), `[`, 1) # Assumes filename = samplename_XXX.fastq.gz
if(identical(sample.names, sample.namesR)) {print("Files are still matching.....congratulations")
} else {stop("Forward and reverse files do not match.")}
names(filtFs) <- sample.names
names(filtRs) <- sample.namesR

# calculate parametric error model 
set.seed(100) # set seed to ensure that randomized steps are replicatable
errF <- learnErrors(filtFs, multithread=F)
errR <- learnErrors(filtRs, multithread=F)

# -> Define filtFs and filtRs and sample.names again:
path_new<-"<add path>"
Fs <- sort(list.files(path_new, pattern = "_R1_001.fastq.gz", full.names = TRUE))
Rs <- sort(list.files(path_new, pattern = "_R2_001.fastq.gz", full.names = TRUE))
filtFs <- file.path(path_new, basename(Fs))
filtRs <- file.path(path_new, basename(Rs))
sample.names <- sapply(strsplit(basename(filtFs), "_"), `[`, 2) # Assumes filename = samplename_XXX.fastq.gz
sample.namesR <- sapply(strsplit(basename(filtRs), "_"), `[`, 2) # Assumes filename = samplename_XXX.fastq.gz
if(identical(sample.names, sample.namesR)) {print("Files are still matching.....congratulations")
} else {stop("Forward and reverse files do not match.")}
names(filtFs) <- sample.names
names(filtRs) <- sample.namesR
errF <- learnErrors(filtFs, multithread=F)
errR <- learnErrors(filtRs, multithread=F)

# save error calculation as RDS files:
saveRDS(errF, "<add path>/12S_errF.rds")
saveRDS(errR, "<add path>/12S_errR.rds")

# As a sanity check, visualize the estimated error rates:
plotErrors(errF, nominalQ = TRUE)
plotErrors(errR, nominalQ = TRUE)

# Apply the dada2's core sequence-variant inference algorithm:
# Set pool = TRUE to allow information to be shared across samples.
# This makes it easier to resolve rare variants that were seen just once or twice in one sample but many times across samples.
# This will increase computation time (most likely only problematic once large sample sets are analyzed).
# Check here for an explanation of pooling: https://benjjneb.github.io/dada2/pool.html
# An alternative is pseudo-pooling, an intermediate solution with medium computation time: https://benjjneb.github.io/dada2/pseudo.html
# This might be a good compromise for us (although computation time should not be a huge issue in our case), as pooling may also lead to more false positives. We can discuss this further.

dadaFs <- dada(filtFs, err=errF, multithread=F,pool="pseudo")
dadaRs <- dada(filtRs, err=errR, multithread=F,pool="pseudo")

# Apply the sample names extracted earlier (see above) to remove the long fastq file names
names(dadaFs) <- sample.names
names(dadaRs) <- sample.names

# Save sequence-variant inference as RDS files which may be uploaded in case R crashes (or save session, see above): 

saveRDS(dadaFs, "<add path>//12S_dadaFs.rds")
saveRDS(dadaRs, "<add path>//12S_dadaRs.rds")

# Inspecting the returned dada-class object of the first sample:

dadaFs[[1]]

# Merge the forward and reverse reads together to obtain the full denoised sequences.
# Adjust the minimum overlap (default = 12) and maximum mismatch allowed (e.g. = 1) if necessary.

mergers <- mergePairs(dadaFs, filtFs, dadaRs,filtRs,verbose=TRUE)

# See here for output explanation: https://www.rdocumentation.org/packages/dada2/versions/1.0.3/topics/mergePairs
# Inspect the merger data.frame of the first sample

head(mergers[[2]])
saveRDS(mergers,"<add path>/12S_mergers.rds")

# Construct an amplicon sequence variant table (ASV) table
# If maxMismatch > 0 has been allowed in the mergePairs step,
# "Duplicate sequences detected and merged" may appear as output during the sequence table creation. This is not a problem, just ignore it.

seqtab <- makeSequenceTable(mergers)

# How many sequence variants were inferred?
dim(seqtab)

# Save sequence table
saveRDS(seqtab, "/Users/matthiasobst/Documents/Data/manuscripts/Danish_ms/Analysis/PeterS/fastq_12S/12S_seqtab.rds")

# There will be a problem creating this table if we have a sample with zero reads after filter and trim in our out object from above,
# but omitted this sample during the rest of the analysis.
# We create a new out object by subsetting all rows that contain no zeros.
# Later on, we have to add the omitted samples manually to our track table.
row_sub = apply(out, 1, function(row) all(row !=0 ))
out<-out[row_sub,]

getN <- function(x) sum(getUniques(x))
track <- cbind(out, sapply(dadaFs, getN), sapply(dadaRs, getN), sapply(mergers,getN))
colnames(track) <- c("input", "filtered", "denoisedF", "denoisedR", "merged")
rownames(track) <- sample.names
track
write.table(track,"<add path>//12S_track.txt",sep="\t",col.names = NA)

# Inspect distribution of sequence lengths
table(nchar(getSequences(seqtab)))
hist(nchar(getSequences(seqtab)), main="Distribution of sequence lengths")

# Therefore, we will only keep sequence reads with a length of 312-314 bp (COI), 150-300 (12S).

seqtab.filtered <- seqtab[,nchar(colnames(seqtab)) %in% seq(150,300)]

# Remove chimeras #
# Chimeric sequences are identified if they can be exactly reconstructed by
# combining a left-segment and a right-segment from two more abundant "parent" sequences.
# If pooling was used during the sequence variant inference step above, method = "pool" should be specified here.
# In this case, the default setting minFoldParentOverabundance = 2 may be too stringent for pooled chimera removal, consider setting this to 8 (or maybe 4, 6, etc.).
seqtab.nochim <- removeBimeraDenovo(seqtab.filtered, multithread=F, verbose=TRUE)

# Save table with the non-chimeric sequences as rds-file:
saveRDS(seqtab.nochim, "<add path>/12S_seqtab_nochim.rds")

# It is possible that a large fraction of the total number of UNIQUE SEQUENCES will be chimeras.
# However, this is usually not the case for the majority of the READS.
# Calculate percentage of the reads that were non-chimeric:
sum(seqtab.nochim)/sum(seqtab)

# Track reads through the pipeline #
# Look at the number of reads that made it through each step in the pipeline:
# If you are processing a single sample only, remove the sapply calls: e.g. replace sapply(dadaFs, getN) with getN(dadaFs).

getN <- function(x) sum(getUniques(x))
track <- cbind(out, sapply(dadaFs, getN), sapply(dadaRs, getN), sapply(mergers,getN), rowSums(seqtab.nochim))
colnames(track) <- c("input", "filtered", "denoisedF", "denoisedR", "merged", "nonchim")
rownames(track) <- sample.names
track
write.table(track,"<add path>//12S_track.txt",sep="\t",col.names = NA)

# Assign taxonomy #
# For COI, no pre-arranged reference database in dada2 format exists.
# A customized database has to be created from BOLD, GenBank, MIDORI etc. and formatted for use in dada2.
# Subsequently, the RDP classifier has to be trained on every customized database.
# Path of the customized COI database training fasta file
mito.ref <- "<add path>//fastq_12S/mitoFISH/mitofish.fa"

# Set minBoot according to the Bootstrap value you prefer. Default is 50, 80 might be better.
# We should assign taxonomy with the default tryRC = T, but this will result in a much longer computation time.
# tryRC = TRUE will use the reverse-complement of each sequences for classification if it is a better match to the reference sequences than the forward sequence.

#Fasta to Table to Fasta Conversion in R
#https://rstudio-pubs-static.s3.amazonaws.com/518943_a6bb21f87f594e6fb2aaa9ca2ef79cc0.html
library (devtools)
library (tidyverse)
source_url("https://raw.githubusercontent.com/lrjoshi/FastaTabular/master/fasta_and_tabular.R")
TabularToFasta("nochim_ASVs.csv")
FastaToTabular("nochim_ASVs.fasta")

set.seed(100) # Initialize random number generator for reproducibility
mito.ref <- "/Users/matthiasobst/Documents/Data/manuscripts/Danish_ms/Analysis/AnneW/fastq_12S/mitofish_prep.fa" 
ASV <- "12S_nochim_ASVs.fa"

taxa <- assignTaxonomy("mitofish_prep.fa", "nochim_ASVs_mini.fa", multithread = F, tryRC = T, taxLevels = c("Superkingdom","Phylum","Class","Order","Family","Genus","Species", "ID"))
taxa <- assignTaxonomy("mitofish.fasta", seqtab.nochim, multithread = F, tryRC = T)

## success !!!
taxa <- assignTaxonomy(seqtab.nochim, mito.ref, multithread = T, tryRC = F)

# If you do not have a custom fasta with reference sequences on which the classifier has been trained, 
# then create a fasta file with all your non-chimeric sequences and assign taxonomy e.g. using the MIDORI web interface.
# http://reference-midori.info/server.php

# Make a sequence fasta
asv_seqs <- colnames(seqtab.nochim)
asv_headers <- vector(dim(seqtab.nochim)[2], mode="character")
for (i in 1:dim(seqtab.nochim)[2]) {
  asv_headers[i] <- paste(">ASV", i, sep="_")
}

# making and writing out a fasta of our final ASV seqs:
asv_fasta <- c(rbind(asv_headers, asv_seqs))
write(asv_fasta, "<add path>/12S_nochim_ASVs.fa")

# Inspecting the taxonomic assignments:
taxa.print <- taxa  

# Removing sequence rownames for display only
rownames(taxa.print) <- NULL
head(taxa.print)

#save tax table with complete sequences
saveRDS(taxa, "<add path>/taxa.rds")

# Make sequence table with short "ASV_..."-names instead of complete sequences.
# Make sure the complete sequences have been saved before, though (in case you need to check them). We just did this by saving the taxa table with sequences.
colnames(seqtab.nochim) <- paste0("ASV_", seq(ncol(seqtab.nochim)))

# Save a tab delimited txt-file of the ASV count table for phyloseq analysis:
ASV_counts<-t(seqtab.nochim) # transposing table

#setwd("C:/<add path>")
write.table(ASV_counts,file="ASV_counts.txt",sep="\t", quote=F,col.names=NA)

# Make and taxa table with short "ASV_..."-names instead of complete sequences.
# Make sure the taxa table with complete sequences have been saved before, though (in case you need to check them)
rownames(taxa) <- paste0("ASV_", seq(nrow(taxa)))

# Save a tab delimited txt-file of the taxa table for phyloseq analysis:
# Remove the k__, p__, etc. prefixes in the taxa table:
taxa <- gsub("[A-z]__","",taxa)
write.table(taxa,file="tax_table.txt",sep="\t", quote=F,col.names=NA)


############################################################################
### prepare table for submission and for ecological and genetic analysis ###
############################################################################

#input
#file with ASV identifications (ASV_list_identifiedFromBOLD.txt)
#file with ASV distribution across samples (ASV_read_counts.txt)
#file with fast sequences (COI_nochim_ASVs.fasta)
#file with sample names and ENA numbers (metadata.xls and Runs.csv)

# turn fasta file into tabular file
source_url("https://raw.githubusercontent.com/lrjoshi/FastaTabular/master/fasta_and_tabular.R")
FastaToTabular("12S_nochim_ASVs.fasta")
# the output is autogenerated and named "dna_table.csv", you can manually remove ">"

#fuse these 3 files
# dna_table.csv
# ASV_list_identifiedFromBOLD.txt
# ASV_read_counts.txt
# => COI_submission.txt
# change ASV columns names to "ID"
# fuse tables by ASV number 
IDfile <- read.table("tax_table.txt",header=T,sep="\t")
ASVcounts <- read.table("12S_ASV_counts.txt",header=T,sep="\t")
DNAtable <- read.table("dna_table.csv",header=T,sep=",")
submission <- merge(IDfile, ASVcounts, by.x = "ID", by.y = "ID")
submission <- merge(DNAtable, submission, by.x = "ID", by.y = "ID")
write.table(submission, file = "12S_submission.csv", row.names=F,  sep = ",")

# modify columns and add all headers 
# add taxonomic assignment details under "Remarks", incl Reflib_Process.ID_Similarity, e.g. BOLD_NSECH003-13_99.35%similiarity
# modify sample names in headers (simply copy over from ITS_submission file)
#add one columns called "Run"
sub <- read.table("submission.csv",header=T,sep=",")

# finalise the headers
# check for contaminations by comparing to negative ctrl and mock communities and correct if neccessary

# reload file
sub <- read.table("12S_submission.txt",header=T,sep="\t")

# generate a file for ecological analysis (ecol.csv) where species observations from several ASVs are collapsed and reads are tunrned into presence/absence values
# remove ASVs from same species 
meta <- sub[1:12]
meta <- meta[!duplicated(meta$Species), ]

# collapse the ASVs so only have one row per species
fst <- aggregate(sub,
                 by = list(sub$Species),
                 function(x)length(x[x>0]))
write.table(fst, file = "fst.csv", row.names=F,  sep = ",")

#delete columns and modify headers, and upload again
fst <- read.table("fst.csv",header=T,sep=",")

# reduce all values in each cell that indicate the number of ASVs per sample and location to binaries because the previous aggregation step indicating if the species was observed or not
# OBS: for closley related species or species complexes there are double assignments of e.g. ASV_1052 is assigned to A. improvisus and A. eburneus. During the duplication removal one of the assignments dissapears and hence reduces the ASV-div, but in fact the ASV-dv should be lumped for these species complexes

tabA <- fst[1:1]
tabB <- fst[2:62]
tabB[tabB > 0] <- 1
binary <- cbind(tabA, tabB) 

# introduce the taxonomy and other metadata again

FINAL <- merge(binary, meta, by.x = "Species", by.y = "Species")
write.table(FINAL, file = "12S_ecol.csv", row.names=F,  sep = ",")

# manually clear blank columns, contamination (H.sapiens), funny species, etc
# move and rename headers
# remove columns on ID, sequence, similarity, ref-database, acession nos (because these are aggregated values now so these columns don't apply anymore)