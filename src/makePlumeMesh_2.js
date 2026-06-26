/*
Create plumes in sections between summit-concentration plane and between concentration planes.

*/
import * as THREE from "three";

let smokeTexture = null;

function getSmokeTexture() {
    if (smokeTexture) return smokeTexture;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = size / 2;
    const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
    gradient.addColorStop(0,   'rgba(255,255,255,1)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.4)');
    gradient.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    smokeTexture = new THREE.CanvasTexture(canvas);
    return smokeTexture;
}

/**
 * @param {[]} processedData
 * @param {THREE.Vector3} summitPos Position of summit
 * @param {number} velocity Assumed velocity in units per millisecond
 * @param {THREE.Vector3} dir Assumed plume direction
 * @param {number} currentFrame
 * @param {number} concentrationThreshold
 * @param {number} maxTimeDiff Max time since current frame to include in geometry
 */
function makePlumeMesh(processedData, summitPos, velocity, dir, currentFrame, concentrationThreshold=0, maxTimeDiff=30) {
    const filteredPoints = [summitPos];
    const planeDepths = [];
    const dirNorm = dir.clone().normalize();
    const margin = 1.001;
    const maxDt = maxTimeDiff * 1000 * 60;
    processedData.forEach((d, di) => {
        if (currentFrame >= di) {
            const dt = processedData[currentFrame].time - d.time;
            if (dt <= maxDt) {
                const drift = dir.clone().multiplyScalar(dt * velocity);
                let depthSum = 0, count = 0;
                d.points.forEach((p, i) => {
                    if (p.Concentration >= concentrationThreshold) {
                        const pos = d.coordinates[i].clone().add(drift);
                        pos.multiplyScalar(margin);
                        filteredPoints.push(pos);
                        depthSum += pos.dot(dirNorm);
                        count++;
                    }
                });
                if (count > 0) planeDepths.push(depthSum / count);
            }
        }
    });

    const group = new THREE.Group();
    if (filteredPoints.length < 2) return group;

    // summitPos appears once but frames contribute many points — repeat it so
    // random pairs include the summit enough to fill the summit→plane gap.
    const summitCopies = Math.max(1, Math.round((filteredPoints.length - 1) / 10));
    for (let k = 0; k < summitCopies; k++) filteredPoints.push(summitPos);

    const n = filteredPoints.length;
    // Scale sprite count with dataset size so sparse datasets don't produce streaks.
    // Each point gets ~8 sprites on average, capped to avoid performance issues.
    const numSprites = Math.min(2000, Math.max(400, n * 8));
    const baseSize = 0.07;

    const numMats = 6;
    const materials = Array.from({length: numMats}, (_, k) => new THREE.SpriteMaterial({
        map: getSmokeTexture(),
        color: 0xffffff,
        opacity: 0.07,
        transparent: true,
        depthWrite: false,
        rotation: (k / numMats) * Math.PI,
    }));

    const slabThickness = baseSize * 0.15; // thin clear zone on each side of a plane

    let placed = 0;
    const maxAttempts = numSprites * 4;
    for (let attempt = 0; attempt < maxAttempts && placed < numSprites; attempt++) {
        const p1 = filteredPoints[Math.floor(Math.random() * n)];
        const p2 = filteredPoints[Math.floor(Math.random() * n)];
        const p3 = filteredPoints[Math.floor(Math.random() * n)];
        const w1 = Math.random(), w2 = Math.random(), w3 = Math.random();
        const wSum = w1 + w2 + w3;
        const pos = new THREE.Vector3()
            .addScaledVector(p1, w1 / wSum)
            .addScaledVector(p2, w2 / wSum)
            .addScaledVector(p3, w3 / wSum);

        const depth = pos.dot(dirNorm);
        if (planeDepths.some(pd => Math.abs(depth - pd) < slabThickness)) continue;

        const sprite = new THREE.Sprite(materials[Math.floor(Math.random() * numMats)]);
        sprite.position.copy(pos);
        const s = baseSize * (0.6 + Math.random() * 0.6);
        sprite.scale.set(s, s, 1);
        group.add(sprite);
        placed++;
    }

    return group;
}

export {makePlumeMesh};
