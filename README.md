# 4D Tomography of volcanic clouds
## Try it out
Go to [https:/akodiat.github.io/volcanicClouds/](https://akodiat.github.io/volcanicClouds/) to load the visualisation.

Files required are Evaluation logs and csv output from Matlab, which can be found in the `./matlab/tomoInverse/` directories.

## Running locally
If you have python 3, you can type:
`python -m http.server 8000`

A full list of oneliners is available here:
https://gist.github.com/willurd/5720255

Once the static server is running, go to http://localhost:8000

## Volcano terrain meshes
The 3D terrain is created using the [three-geo](https://github.com/w3reality/three-geo) geographic visualisation library. To avoid repeated calls to the Mapbox API, ready-made meshes for the volcanos on the [volcano list](../main/src/volcanoList.js) are provided in the [resources/terrainMeshes](../main/resources/terrainMeshes) directory.

To add a new volcano, first append it to [src/volcanoList.js](../main/src/volcanoList.js).
If no terrain mesh can be found when loading data for a volcano in the list, the program will prompt you for a [Mapbox GL JS](https://www.mapbox.com/mapbox-gljs) API access token. At the time of writing, you can get a token for free (up to a number of API calls), by registering on the [Mapbox website](https://www.mapbox.com/mapbox-gljs). After providing your token, a `glb` mesh containing the 3D terrain will be downloaded. Save it to the [resources/terrainMeshes](../main/resources/terrainMeshes) directory and you will not have to repeat the process.

To update the terrain mesh for a volcano, remove the corresponding `glb` file from [resources/terrainMeshes](../main/resources/terrainMeshes) and follow the process above to download a new mesh.

## Collaboration agreement for research projects

Terms of agreement for collaborating with Digital Research Engineers at e-commons

---------------------------------------------------------------------------------

We share programming code and results with the understanding that:

1. It will be used for non-commercial research purposes only, unless agreed upon in a separate agreement.
2. It won't be made publicly available without formally seeking everyone's consent.
3. If one uses it for some scientific article/report, or similar, we will be part of the authors/contributors list and formally included in the process of writing and presenting the results. Resulting publications follow the Chalmers Open Access policy (<https://www.chalmers.se/en/about-chalmers/organisation-and-governance/how-chalmers-is-steered/general-policy-documents/open-access-policy/>).
4. A data management plan will be developed and updated.

Complying with the above authorizes you to use, copy, modify, and publish project code and results.

---------------------------------------------------------------------------------
# Further help 

## Basics
HTML is used to design the skeleton of a webpage.
CSS is used to change the appearance of the webpage.
JavaScript is used to add interactive elements to the webpage.

## Structure
Resources contain geographical data in terrainMeshes
Src contains help files for tomography inversion etc
main.js executes the program

## SO2 concentration frames
The SO2 concentrations are calculated in a vertical plane between two stations. 
When updateFrame runs the next frame appears and the old one is moved in the wind direction

## Algoritm
The concentrations are found by:
1. Projecting the slant column densities, SCD, to a vertical plane between the two stations. 
2. Constructing a grid of rays from each station
3. Calculating the path lengths between intersecting points 
4. Solving Ax=b where A contain path lengths, x the column density in grid cells and b are the SCDs
