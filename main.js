import * as THREE from "three";
import {MapControls} from "./libs/threeAddons/MapControls.js";
import {Lut} from "./libs/threeAddons/Lut.js";
import ThreeGeo from "./libs/three-geo-esm.js";
import {tomoInverse} from "./src/tomoInverse.js";
import {locateVolcano} from "./src/locateVolcano.js";
import {drawParticles} from "./libs/draw.js";
import {TomographicPlaneGeometry} from "./src/tomographicPlaneGeometry.js";
import {GLTFLoader} from "./libs/threeAddons/GLTFLoader.js";
import {GLTFExporter} from "./libs/threeAddons/GLTFExporter.js";
import {RGBELoader} from './libs/threeAddons/RGBELoader.js';
import {makePlumeMesh} from "./src/makePlumeMesh.js";
import {GUI} from "./libs/threeAddons/lil-gui.module.min.js"
import {Api} from "./src/api.js";
import {saveArrayBuffer} from "./src/utils.js";
import {exportDomeVideo} from "./src/domeExport.js";


// GUI parameters
let params	= {
    assumedVelocity: 10, // Velocity in m/s
    maxTimeDiff: 30, // Max time since current frame to include in geometry
    concentrationThreshold: 0.0005,
    plumeVisible: true,
    pointsVisible: true,
    planeVisible: true,
    backgroundVisible: true,
    imageScaleFactor: 1,
    exportImage: ()=>{window.api.exportImage()}
};

let camera, scene, renderer, controls, backgroundTexture;
let plumeMesh = new THREE.Object3D();
let frames = [];
init();
render();

// configure the raycaster
const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 0.001;


// Initialise scene
function init() {

    // Setup renderer
    renderer = new THREE.WebGLRenderer({
        alpha: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const container = document.getElementById("container");
    container.appendChild(renderer.domElement);

    // Setup scene and camera
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.01, 1e4);

    // Setup lights
    const pointLight = new THREE.PointLight(0xff0000, 100);
    pointLight.position.set(1, 1, 1);
    scene.add(pointLight);

    // Setup background
    setBackgroundVisibility(true);

    // Add x-y-z axis indicator
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    // And camera controls
    controls = new MapControls(camera, renderer.domElement);
    controls.maxPolarAngle = Math.PI/2;
    controls.zoomToCursor = true;
    controls.addEventListener("change", render);

    // Load data when file is uploaded
    const fileInput = document.getElementById("fileInput");
    const loadFromFiles = async () => {
        const data = [];
        let alreadyProcessedData = [];
        for (const file of fileInput.files) {
            const text = await file.text();
            // We might have multiple dots in the name
            const splitName = file.name.split(".");
            const suffix = splitName.pop();
            const filename = splitName.join("");
            if (suffix === "csv") {
                // CSV means we have data from matlab
                const frame = parseProcessedData(text, filename);
                alreadyProcessedData.push(frame);
            } else {
                // Otherwise we should have the txt evaluation logs
                const scans = parseScans(text);
                data.push(scans);
            }
        }
        // Hide file upload container
        document.getElementById("fileUploadContainer").style.display = "none";

        // Create api and make it a global variable in the web console
        window.api = new Api(camera, scene, renderer, controls, data, params);
        window.THREE = THREE;

        // Handle the loaded data
        onDataLoaded(data, alreadyProcessedData);
    };

    fileInput.onchange = loadFromFiles;

    document.getElementById("sabancayaExample").onclick = () => {
        loadDataFromUrl([
            "matlab/sabancaya/EvaluationLog_D2J2819_2024.01.28.txt",
            "matlab/sabancaya/EvaluationLog_D2J2833_2024.01.28.txt",
            "matlab/sabancaya/tomography_D2J2819_20240128_1213_D2J2833_20240128_1200.csv",
            "matlab/sabancaya/tomography_D2J2819_20240128_1213_D2J2833_20240128_1215.csv",
            "matlab/sabancaya/tomography_D2J2819_20240128_1230_D2J2833_20240128_1215.csv"
        ]);
    };

    document.getElementById("turrialbaExample").onclick = () => {
        loadDataFromUrl([
            "matlab/turrialba/EvaluationLog_Turrialba_1.txt",
            "matlab/turrialba/EvaluationLog_Turrialba_2.txt",
            "matlab/turrialba/tomography_2108111M1_20231013_1413_D2J3042_20231013_1422.csv",
            "matlab/turrialba/tomography_2108111M1_20231013_1433_D2J3042_20231013_1422.csv",
            "matlab/turrialba/tomography_2108111M1_20231015_1433_D2J3042_20231015_1423.csv",
            "matlab/turrialba/tomography_2108111M1_20231013_1427_D2J3042_20231013_1422.csv",
            "matlab/turrialba/tomography_2108111M1_20231015_1423_D2J3042_20231015_1423.csv",
            "matlab/turrialba/tomography_2108111M1_20231026_1436_D2J3042_20231026_1441.csv"
        ]);
    };


    // Firefox might cashe the last files selected,
    // so this is a shorthand to press Enter to
    // load the directly.
    window.addEventListener("keydown", (event) => {
        switch (event.code) {
        case "Enter":
            if (fileInput.files.length > 0) {
                loadFromFiles();
            }
            break;
        }
    });

    // Update camera aspect ratio on window resize
    window.addEventListener("resize", onWindowResize);

    render();
}

async function loadDataFromUrl(filePaths) {
        const data = [];
        let alreadyProcessedData = [];
        for (const path of filePaths) {
            // Load text from path
            const res = await fetch(path);
            const text = await res.text();

            const filename = path.split("/").splice(-1)[0];

            // We might have multiple dots in the name
            const splitName = filename.split(".");
            const suffix = splitName.pop();
            if (suffix === "csv") {
                // CSV means we have data from matlab
                const frame = parseProcessedData(text, filename);
                alreadyProcessedData.push(frame);
            } else {
                // Otherwise we should have the txt evaluation logs
                const scans = parseScans(text);
                data.push(scans);
            }
        }
        // Hide file upload container
        document.getElementById("fileUploadContainer").style.display = "none";

        // Create api and make it a global variable in the web console
        window.api = new Api(camera, scene, renderer, controls, data, params);
        window.THREE = THREE;

        // Handle the loaded data
        onDataLoaded(data, alreadyProcessedData);
}

function setBackgroundVisibility(visible, url="resources/citrus_orchard_road_puresky_4k.hdr") {
    if (!visible) {
        scene.background = undefined;
        scene.environment = undefined;
    } else {
        if (backgroundTexture === undefined) {
            new RGBELoader().load(url, texture => {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                backgroundTexture = texture;
                scene.background = backgroundTexture;
                scene.environment = backgroundTexture;
            });
        } else {
            scene.background = backgroundTexture;
            scene.environment = backgroundTexture;
        }
    }
    render();
}

/**
 * Parse data processed by Matlab script
 * @param {string} text CSV data string
 * @param {string} filename File name
 * @returns {{points: any[]}}
 */
function parseProcessedData(text, filename) {
    const frame = {points: [], filename: filename};

    // Parse date from filename format
    const parseDate = (d, t) => new Date(
        `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T${t.slice(0,2)}:${t.slice(2,4)}`
    );
    // eslint-disable-next-line no-unused-vars
    const [_0, _1, day1, time1, _2, day2, time2] = filename.split("_");
    frame.date1 = parseDate(day1, time1);
    frame.date2 = parseDate(day2, time2);

    // Calc average time
    frame.time = new Date((
        frame.date1.getTime() +
        frame.date2.getTime()
    ) / 2);

    // Parse points
    for (let line of text.split("\n")) {
        line = line.trim("\r");
        if (line === "") {
            continue;
        }
        const values = line.split(",").map(v=>parseFloat(v));
        if (values.length == 2) {
            [frame.size1, frame.size2] = values;
        } else {
            const [lonPutm, latPutm, altP, Concentration] = values;
            frame.points.push({lonPutm, latPutm, altP, Concentration});
        }
    }
    return frame;
}

/**
 * Parse evaluation logs
 * @param {string} text Evaluation logs
 * @returns {{points: any[]}}
 */
function parseScans(text) {
    // Match spectral header and data
    const rInfo = /<scaninformation>(?<info>([\s\S])*?)<\/scaninformation>/gm;
    const scans = [];
    for (const match of text.matchAll(rInfo)) {
        const scanInfo = {};
        const info = match.groups.info.split("\n");
        info.forEach(d=>{
            d = d.trim("\r");
            if (d !== "") {
                const [k, v] = d.split("=");
                scanInfo[k] = isNaN(v) ? v : Number(v);
            }
        });
        scans.push({
            scanInfo: scanInfo
        });
    }

    // Match spectral header and data
    const rData = /#(?<header>[\s\S]+?)<spectraldata>(?<data>([\s\S])*?)<\/spectraldata>/gm;
    //const scans = [];
    let i = 0;
    for (const match of text.matchAll(rData)) {
        const spectralData = [];
        // Header names are not consistent across different stations
        // So let's assume that the order is at least the same
        //const header = match.groups.header.split("\t");
        const header = [
            "scanangle", "starttime", "stoptime", "name", "specsaturation",
            "fitsaturation", "counts_ms", "delta", "chisquare", "exposuretime",
            "numspec", "column_SO2", "columnerror_SO2", "shift_SO2",
            "shifterror_SO2", "squeeze_SO2", "squeezeerror_SO2", "column_O3",
            "columnerror_O3", "shift_O3", "shifterror_O3", "squeeze_O3",
            "squeezeerror_O3", "column_RING", "columnerror_RING", "shift_RING",
            "shifterror_RING", "squeeze_RING", "squeezeerror_RING",
            "isgoodpoint", "offset", "flag"
        ];
        const data = match.groups.data.split("\n");
        data.forEach(d=>{
            d = d.trim("\r");
            if (d !== "") {
                const linedata = {};
                d.split("\t").forEach((v, i) => {
                    linedata[header[i].trim()] = isNaN(v) ? v : Number(v);
                });
                spectralData.push(linedata);
            }
        });
        scans[i].spectralData = spectralData;
        i++;
    }
    return scans;
}

/**
 * Called when data has been loaded from the input files
 * @param {any[]} data Evaluation log data
 * @param {any[]} processedData (optional) Already processed concentration data
 */
function onDataLoaded(data, processedData) {
    console.log(data);

    let tgeo = new ThreeGeo();

    const [nameVol, latVol, lonVol, altVol] = locateVolcano(data);
    const summitLatLng = new THREE.Vector2(latVol, lonVol);
    window.api.volcanoName = nameVol;

    const radius = 6.0;
    const loader = new GLTFLoader().setPath("resources/terrainMeshes/");
    const filename = `${nameVol}.glb`;
    loader.load(filename, gltf => {
        const model = gltf.scene;
        scene.add(model);
        render();
    }, undefined, ()=>{
        // On error (file not found)
        const tokenMapbox = prompt(`The terrain for the volcano ${nameVol} is not saved. Input a mapbox token to download. To avoid this in the future, save the downloaded file to ./resources/terrainMeshes/`);
        tgeo = new ThreeGeo({
            tokenMapbox: tokenMapbox,
        });
        tgeo.getTerrainRgb(
            summitLatLng.toArray(),  // [lat, lng]
            radius,            // radius of bounding circle (km)
            13                 // zoom resolution
        ).then(terrain => {
            terrain.rotation.x = - Math.PI/2;
            scene.add(terrain);
            render();

            const gltfExporter = new GLTFExporter();
            gltfExporter.parse(
                terrain,
                function (result) {
                    saveArrayBuffer(result, filename);
                },
                error => console.log("An error happened during parsing", error),
                {binary: true}
            );
        });
    } );

    // Get projection from latitude, longitude to scene coordinates
    const {proj, unitsPerMeter} = tgeo.getProjection(summitLatLng.toArray(), radius);
    const toSceneCoords = (latLng, altitude) => {
        const pos2D = new THREE.Vector2(...proj(latLng));
        return new THREE.Vector3(pos2D.x, altitude * unitsPerMeter, -pos2D.y);
    };

    const summitPos = toSceneCoords(summitLatLng, altVol, proj);

    // Setup camera controls
    controls.minDistance = unitsPerMeter;
    controls.target.copy(summitPos);
    controls.update();

    // Visualise the instruments
    const instPos = [];
    for (const instrumentData of data) {
        const scanInfo = instrumentData[0].scanInfo; // Use first datapoint
        const instrumentLatLng = new THREE.Vector2(
            scanInfo.lat,
            scanInfo.long
        );
        const instrumentPos = toSceneCoords(instrumentLatLng, scanInfo.alt, proj);
        instPos.push(instrumentPos);

        // Add a cuboid to mark the instrument position
        const instrumentGeometry = new THREE.BoxGeometry(1.5, 1, 3);
        const instrumentMaterial = new THREE.MeshStandardMaterial({color: 0xffffff});
        const cube = new THREE.Mesh(instrumentGeometry, instrumentMaterial);
        cube.scale.multiplyScalar(50 * unitsPerMeter);
        cube.position.copy(instrumentPos);
        cube.lookAt(summitPos);
        scene.add(cube);

        // Add a cone to mark the instrument scanning volume
        const height = 1;
        const radius = height * Math.tan(2 * scanInfo.coneangle / 180 * Math.PI);
        const nScanValues = instrumentData[0].spectralData.length;
        const coneGeometry = new THREE.ConeGeometry(radius, height, nScanValues-1, 1, true, 1.5*Math.PI, -Math.PI);
        coneGeometry.translate(0, -height/2, 0);
        coneGeometry.rotateX(-Math.PI/2);
        const coneEdges = new THREE.EdgesGeometry(coneGeometry);
        const line = new THREE.LineSegments(coneEdges, new THREE.LineBasicMaterial({
            color: 0xffffff,
            opacity: 0.3,
            transparent: true
        }));
        line.scale.multiplyScalar(instrumentPos.distanceTo(summitPos));
        line.position.copy(instrumentPos);
        line.lookAt(new THREE.Vector3(0, instrumentPos.y, 0));
        scene.add(line);
    }

    // If we don't have any preloaded processed data, calculate it
    // using tomoInverse
    if (processedData.length === 0) {
        const deg2utm = (lat, long) => {
            const [x,y] = proj([lat, long]); // TODO this seems wrong. The deg2utm function is much bigger than just dividing by unitsPerMeter!
            return [x/unitsPerMeter, y/unitsPerMeter];
        };
        processedData = tomoInverse(data, deg2utm);
        for (const frame of processedData) {
            frame.coordinates = frame.points.map(d=>new THREE.Vector3(
                d.latPutm * unitsPerMeter,
                d.altP * unitsPerMeter,
                d.lonPutm * unitsPerMeter,
                proj
            ));
        }

    } else {
        for (const frame of processedData) {
            frame.coordinates = frame.points.map(d=>toSceneCoords(
                new THREE.Vector2(
                    d.latPutm, d.lonPutm
                ), d.altP, proj
            ));
        }
    }

    // Sort frames chronologically
    processedData.sort((a,b)=>a.time - b.time);

    // Find line between instruments
    const line = instPos[0].clone().sub(instPos[1]);
    // Find direction away from volcano.
    // The volcano is at the origin,
    // so length gets the distance to it
    let dir = line.clone().cross(new THREE.Object3D().up);
    if ((instPos[0].lengthSq() > instPos[0].clone().add(dir).lengthSq())) {
        dir.negate();
    }

    // Draw concentration visualisations for each frame
    let t = 0;
    for (const frame of processedData) {
        const concentrations = frame.points.map(d=>d.Concentration);
        const lut = new Lut("ylOrRd", 512);
        lut.minV = Math.min(...concentrations);
        lut.maxV = Math.max(...concentrations);

        // If min and max is the same, lut returns undefined
        if (lut.minV === lut.maxV) {
            lut.minV--;
            lut.maxV++;
        }

        const colors = concentrations.map(c=>{
            const color = lut.getColor(c);
            return color;
        });
        const ps = frame.coordinates;

        // Particles
        const pointMesh = drawParticles(ps, colors, [{
            name: "concentration",
            itemSize: 1,
            flattenedItems: concentrations
        }], 0.005);

        window.addEventListener("mousemove", event => {
            const mouse = new THREE.Vector2();
            mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
            mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObject(pointMesh, false);
            if (intersects.length) {
                const index = intersects[0].index;
                const concentration = pointMesh.geometry.attributes.concentration.array[index];
                console.log(concentration);
            }
        });

        // Tomographic plane
        const texture = new THREE.CanvasTexture(
            generateTexture(concentrations, frame.size1, frame.size2)
        );
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.colorSpace = THREE.SRGBColorSpace;

        const material = new THREE.MeshBasicMaterial({
            side: THREE.DoubleSide,
            map: texture,
            transparent: true
        });

        const planeGeometry = new TomographicPlaneGeometry(ps, dir, frame.size1-1, frame.size2-1);
        const planeMesh = new THREE.Mesh(planeGeometry, material);

        const frameGroup = new THREE.Group();
        frameGroup.add(pointMesh);
        frameGroup.add(planeMesh);
        frames.push(frameGroup);
        scene.add(frameGroup);
        t++;
    }
    api.currentFrame = 0;

    // Velocity in units per millisecond
    api.updateFrame = (steps=20, automatic=true) => {
        const velocity = (params.assumedVelocity * unitsPerMeter) / 1000;
        frames.forEach((f,i) => {
            // Time difference in milliseconds
            const dt = processedData[api.currentFrame].time - processedData[i].time;
            const newPos = dir.clone().multiplyScalar(dt * velocity);
            f.position.lerp(newPos, Math.sqrt(1/steps));
            f.visible = api.currentFrame >= i;
        });
        if (automatic && steps > 1) {
            requestAnimationFrame(()=>{
                scene.remove(plumeMesh);
                render();
                api.updateFrame(steps-1);
            });
        } else {
            setStatus(processedData[api.currentFrame].time.toLocaleString());
            scene.remove(plumeMesh);
            if (params.plumeVisible) {
                plumeMesh = makePlumeMesh(
                    processedData, summitPos, velocity, dir, api.currentFrame,
                    params.concentrationThreshold, params.maxTimeDiff
                );
                scene.add(plumeMesh);
            }
            frames.forEach(f => {
                const [pointMesh, planeMesh] = f.children;
                pointMesh.visible = params.pointsVisible;
                planeMesh.visible = params.planeVisible;
            });
        }
        render();
    };
    api.updateFrame();

    // Setup visualisation parameters
    const gui = new GUI();
    gui.add(params, 'pointsVisible').onChange(()=>api.updateFrame());
    gui.add(params, 'planeVisible').onChange(()=>api.updateFrame());
    gui.add(params, 'backgroundVisible').onChange(e=>setBackgroundVisibility(e));
    const plumeFolder = gui.addFolder('Plume');
    plumeFolder.add(params, 'plumeVisible').onChange(()=>api.updateFrame());
    plumeFolder.add(params, 'assumedVelocity').onChange(()=>api.updateFrame());
    plumeFolder.add(params, 'maxTimeDiff').onChange(()=>api.updateFrame());
    plumeFolder.add(params, 'concentrationThreshold').min(0).onChange(()=>api.updateFrame());

    const exportFolder = gui.addFolder("Export");
    exportFolder.add(params, "imageScaleFactor").min(1);
    exportFolder.add(params, "exportImage");

    params.exportData = ()=>{window.api.exportProcessedData(processedData)}
    exportFolder.add(params, "exportData");

    // Setup keybindings
    window.addEventListener("keydown", (event) => {
        switch (event.code) {
        case "ArrowRight":
            api.currentFrame = Math.min(api.currentFrame+1, frames.length-1);
            api.updateFrame();
            break;
        case "ArrowLeft":
            api.currentFrame = Math.max(api.currentFrame-1, 0);
            api.updateFrame();
            break;
        }
    });

    // Setup buttons
    document.getElementById("prevFrame").onclick = () => {
        api.currentFrame = Math.max(api.currentFrame-1, 0);
        api.updateFrame();
    };
    document.getElementById("nextFrame").onclick = () => {
        api.currentFrame = Math.min(api.currentFrame+1, frames.length-1);
        api.updateFrame();
    };

    // Dome export
    api.exportDomeVideo = (
        resolution=800, duration=5, revolutionTime = 30, framerate=60, eyeSep=0.064, tilt=27, span=165,
    ) => {
        exportDomeVideo(
            resolution, duration, revolutionTime, framerate, eyeSep, tilt, span, renderer, scene,
            summitPos, unitsPerMeter, processedData.length, api
        )
    };

}

/**
 * Update status container content (used to display the date)
 * @param {string} s Text to display
 */
function setStatus(s) {
    const container = document.getElementById("statusContainer");
    const text = document.getElementById("statusText");
    container.style.display = "block";
    text.textContent = s;
}

/**
 * Generate texture from concentration data
 * @param {number[]} data Flattened (height x width) matrix of concentrations
 * @param {*} height Texture height
 * @param {*} width  Texture width
 * @returns {HTMLCanvasElement}
 */
function generateTexture(data, height, width) {
    console.assert(
        data.length === height * width,
        `Length of data ${data.length} not agreeing with height ${height} and width ${width}`
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    context.fillStyle = "#000";
    context.fillRect(0, 0, width, height);

    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const imageData = image.data;

    // Load colour scheme and set min and max values
    const lut = new Lut("ylOrRd", 512);
    lut.minV = Math.min(...data);
    lut.maxV = Math.max(...data);

    for (let i = 0, j = 0, l = imageData.length; i < l; i += 4, j++) {
        const color = lut.getColor(data[j]);
        imageData[i] = color.r * 255;       // R
        imageData[i + 1] = color.g * 255;   // G
        imageData[i + 2] = color.b * 255;   // B
        // Also make plane opacity depend on concentration data
        imageData[i + 3] = (data[j]/lut.maxV) * 255 * 0.75;   // A
    }

    context.putImageData(image, 0, 0);

    return canvas;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    render();
}

function render() {
    renderer.render(scene, camera);
}