import * as THREE from "three";
import {saveString} from "./utils.js";

class Api {
    /**
     * An api object is included in the global scope so that it can be called
     * from the developer console.
     * @param {THREE.Camera} camera
     * @param {THREE.Scene} scene
     * @param {THREE.Renderer} renderer
     * @param {MapControls} controls
     * @param {PatchManager} patchManager
     */
    constructor(camera, scene, renderer, controls, data, params) {
        this.camera = camera;
        this.scene = scene;
        this.renderer = renderer;
        this.controls = controls;
        this.data = data;
        this.params = params;
    }

    /**
     * Scales the HTML canvas (used for higher resolution
     * in image and video export).
     * You are meant to scale it back again when the export
     * is done, otherwise things will look odd.
     * @param {number} scalingFactor Multiplier to scale the canvas with
     */
    scaleCanvas(scalingFactor=2) {
        const canvas = this.renderer.domElement;
        const width = canvas.width;
        const height = canvas.height;
        canvas.width = width*scalingFactor;
        canvas.height = height*scalingFactor;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(canvas.width, canvas.height);
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Export image of the current view
     * @param {number} scaleFactor Multiplier to for higher resolution
     */
    exportImage(scaleFactor = this.params.imageScaleFactor) {
        let saveImage = () => {
            this.renderer.domElement.toBlob(blob => {
                var a = document.createElement("a");
                var url = URL.createObjectURL(blob);
                a.href = url;
                a.download = this.volcanoName+".png";
                setTimeout(() => a.click(), 10);
            }, "image/png", 1.0);
        };

        // First scale the canvas with the provided factor, then scale it back.
        new Promise(resolve => {
            this.scaleCanvas(scaleFactor);
            resolve("success");
        }).then(() => {
            try {
                saveImage();
            } catch (error) {
                alert("Canvas is too large to save, please try a smaller scaling factor");
            }
            this.scaleCanvas(1/scaleFactor);
        });
    }

    /**
     * Export frames from processed data as csv files
     * @param {*[]} processedData 
     */
    exportProcessedData(processedData) {
        for (const frame of processedData) {
            let lines = [];
            lines.push(`grid_size1,grid_size2\n${frame.size1},${frame.size2}`);
            lines.push("lon (deg),lat (deg),alt (m),Concentration");
            for (const p of frame.points) {
                lines.push([p.lon, p.lat, p.altP, p.Concentration].join(","))
            }
            // TODO: This filename is not formatted the same way as the output of the Matlab script,
            // so if you try to load the files the date parsing will fail.
            // (but this took less time to implement)
            const filename = `tomography_${this.volcanoName}_${frame.date1.toISOString()}_${frame.date2.toISOString()}.csv`;
            saveString(lines.join("\n"), filename);
        }
    }
}

export {Api};