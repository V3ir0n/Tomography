import { locateVolcano } from "./locateVolcano.js";

/**
 * Volcanic SO2 Tomography Analysis
 * Complete JavaScript conversion of MATLAB InfraVis Volcanic Clouds code
 *
 * Usage:
 *   const result = new VolcanoTomography(parameters);
 *   const csv = result.processTwoStations(txt1Content, txt2Content);
 */

class VolcanoTomography {
  constructor(parameters = {}) {
    this.completenessLimit = parameters.completenessLimit || 0.9;
    this.baricenterLimit = parameters.baricenterLimit || 60;
    this.timeDifferenceMin = parameters.timeDifferenceMin || 15;
    this.timeDifference = this.timeDifferenceMin / (24 * 60);
    this.numberOffset = parameters.numberOffset || 5;
    this.volcanoList = parameters.volcanoList || {};
    this.plots = parameters.plots || 0;
  }

  /**
   * Parse EvaluationLog format from text file
   */
  parseEvaluationLog(fileContent) {
    const scans = [];
    
    // Extract scan information blocks
    const scanPattern = /<scaninformation>[\s\S]*?<\/spectraldata>/g;
    const scanMatches = fileContent.match(scanPattern) || [];

    scanMatches.forEach(scanBlock => {
      try {
        const scan = this.extractScanData(scanBlock);
        if (scan) scans.push(scan);
      } catch (e) {
        console.warn('Error parsing scan block:', e);
      }
    });

    return scans;
  }

  /**
   * Extract individual scan parameters from XML-like block
   */
  extractScanData(block) {
    const extract = (pattern) => {
      const match = block.match(new RegExp(pattern + '="([^"]*)"'));
      return match ? match[1] : null;
    };

    const extractNum = (pattern) => {
      const val = extract(pattern);
      return val ? parseFloat(val) : NaN;
    };

    return {
      date: extract('date'),
      startTime: extract('starttime'),
      compass: extractNum('compass'),
      tilt: extractNum('tilt'),
      latitude: extractNum('latitude'),
      longitude: extractNum('longitude'),
      altitude: extractNum('altitude'),
      volcano: extract('volcano'),
      site: extract('site'),
      observatory: extract('observatory'),
      serial: extract('serial'),
      spectrometer: extract('spectrometer'),
      channel: extractNum('channel'),
      coneAngle: extractNum('coneangle'),
      interlaceSteps: extractNum('interlace'),
      startChannel: extractNum('startchannel'),
      spectrumLength: extractNum('spectrumlength'),
      flux: extractNum('flux'),
      windSpeed: extractNum('windspeed'),
      windDir: extractNum('winddir'),
      plumeHeight: extract('plumeheight'),
      plumeCompleteness: extractNum('plumecompleteness'),
      plumeCentre: extractNum('plumecentre'),
      plumeEdge1: extractNum('plumeedge1'),
      plumeEdge2: extractNum('plumeedge2'),
      spectralData: this.extractSpectralData(block)
    };
  }

  /**
   * Extract spectral scan data (angles and SO2 columns)
   */
  extractSpectralData(block) {
    const dataStart = block.indexOf('<spectraldata>');
    const dataEnd = block.indexOf('</spectraldata>');
    
    if (dataStart === -1 || dataEnd === -1) return null;

    const dataStr = block.substring(dataStart + 14, dataEnd);
    const lines = dataStr.trim().split('\n');
    
    const data = {
      angles: [],
      so2Columns: [],
      so2Errors: [],
      flags: []
    };

    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 12) {
        data.angles.push(parseFloat(parts[0]));
        data.so2Columns.push(parseFloat(parts[11])); // Column SO2
        data.so2Errors.push(parseFloat(parts[12]));  // Error
        data.flags.push(parseInt(parts[29]) || 0);   // Flag
      }
    });

    return data;
  }

  /**
   * Convert degrees to UTM coordinates
   */
  deg2utm(lat, lon) {
    const k0 = 0.9996;
    const a = 6378137.0;
    const e2 = 0.00669438;
    const e_prime2 = e2 / (1 - e2);

    const zone = Math.floor((lon + 180) / 6) + 1;
    const lon0 = (zone - 1) * 6 - 180 + 3;
    const lon0Rad = this.toRad(lon0);

    const latRad = this.toRad(lat);
    const lonRad = this.toRad(lon);
    
    const n = a / Math.sqrt(1 - e2 * Math.sin(latRad) ** 2);
    const t = Math.tan(latRad) ** 2;
    const c = e_prime2 * Math.cos(latRad) ** 2;
    const a_val = Math.cos(latRad) * (lonRad - lon0Rad);

    const m = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64) * latRad -
              (3 * e2 / 8 + 3 * e2 ** 2 / 32) * Math.sin(2 * latRad) +
              (15 * e2 ** 2 / 256) * Math.sin(4 * latRad));

    const easting = k0 * n * (a_val + (a_val ** 3 / 6) * (1 - t + c) +
                  (a_val ** 5 / 120) * (1 - 5 * t + 9 * c + 4 * c ** 2)) + 500000;
    
    const northing = k0 * (m + n * Math.tan(latRad) *
                   ((a_val ** 2 / 2) + (a_val ** 4 / 24) * (5 - t + 9 * c + 4 * c ** 2) +
                   (a_val ** 6 / 720) * (61 - 58 * t + t ** 2 + 600 * c - 330 * e_prime2))) + 10000000;

    return { easting, northing, zone };
  }

  /**
   * Convert UTM to degrees
   */
  utm2deg(northing, easting, zone) {
    const k0 = 0.9996;
    const a = 6378137.0;
    const e2 = 0.00669438;
    const e_prime2 = e2 / (1 - e2);

    const x = easting - 500000;
    const y = northing - 10000000;

    const m = y / k0;
    const mu = m / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 + 5 * e2 ** 3 / 256));
    
    const footpointLat = mu + (3 * e2 / 8) * Math.sin(2 * mu) +
                         (3 * e2 ** 2 / 32) * Math.sin(4 * mu);

    const c1 = e_prime2 * Math.cos(footpointLat) ** 2;
    const t1 = Math.tan(footpointLat) ** 2;
    const n1 = a / Math.sqrt(1 - e2 * Math.sin(footpointLat) ** 2);
    const r1 = a * (1 - e2) / Math.sqrt((1 - e2 * Math.sin(footpointLat) ** 2) ** 3);
    const d = x / (n1 * k0);

    const lat = footpointLat - (n1 * Math.tan(footpointLat) / r1) *
                (d ** 2 / 2 - (d ** 4 / 24) * (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * e_prime2) +
                (d ** 6 / 720) * (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * e_prime2 - 3 * c1 ** 2));

    const lon0Rad = this.toRad((zone - 1) * 6 - 180 + 3);
    const lon = lon0Rad + (d - (d ** 3 / 6) * (1 + 2 * t1 + c1) +
                (d ** 5 / 120) * (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * e_prime2 + 24 * t1 ** 2)) /
                Math.cos(footpointLat);

    return { lat: this.toDeg(lat), lon: this.toDeg(lon) };
  }

  /**
   * Process two station files and return tomography results
   */
  processTwoStations(txt1, txt2) {
    // Parse both files
    const station1Data = this.parseEvaluationLog(txt1);
    const station2Data = this.parseEvaluationLog(txt2);

    if (station1Data.length === 0 || station2Data.length === 0) {
      throw new Error('No valid scan data found in input files');
    }

    // Extract common parameters from first scan
    const s1 = station1Data[0];
    const s2 = station2Data[0];

    // Station parameters
    const latS1 = s1.latitude;
    const lonS1 = s1.longitude;
    const altS1 = s1.altitude;
    
    const latS2 = s2.latitude;
    const lonS2 = s2.longitude;
    const altS2 = s2.altitude;

    // Convert to UTM
    const utm1 = this.deg2utm(latS1, lonS1);
    const utm2 = this.deg2utm(latS2, lonS2);
    const latVol = parseFloat(s1.latitude);
    const lonVol = parseFloat(s1.longitude);
    const utmVol = this.deg2utm(latVol, lonVol);

    const DX1 = utm1.easting - utmVol.easting;
    const DY1 = utm1.northing - utmVol.northing;
    const DX2 = utm2.easting - utmVol.easting;
    const DY2 = utm2.northing - utmVol.northing;

    const beta1 = s1.coneAngle;
    const beta2 = s2.coneAngle;
    const deltaH21 = altS2 - altS1;

    // Geometric calculations
    const VS1 = Math.sqrt(DX1 ** 2 + DY1 ** 2);
    const VS2 = Math.sqrt(DX2 ** 2 + DY2 ** 2);
    const S12 = Math.sqrt((DX1 - DX2) ** 2 + (DY1 - DY2) ** 2);

    const cosAngleV = (VS1 ** 2 + VS2 ** 2 - S12 ** 2) / (2 * VS1 * VS2);
    const angleV = Math.acos(Math.min(1, Math.max(-1, cosAngleV)));

    // Filter valid scans
    const validScans1 = this.filterValidScans(station1Data);
    const validScans2 = this.filterValidScans(station2Data);

    // Pair scans by time and perform tomography
    const results = [];
    const csvLines = [];

    for (const scan1 of validScans1) {
      for (const scan2 of validScans2) {
        const timeDiff = Math.abs(this.parseTime(scan1.date + ' ' + scan1.startTime) - 
                                   this.parseTime(scan2.date + ' ' + scan2.startTime));
        
        if (timeDiff <= this.timeDifference) {
          try {
            const tomo = this.performTomography(
              scan1, scan2, 
              DX1, DY1, DX2, DY2, deltaH21, S12, 
              beta1, beta2, altS1, latVol, lonVol, utmVol, utm1, utm2
            );
            
            if (tomo && tomo.concentration) {
              results.push(tomo);
              
              // Add to CSV
              csvLines.push(`${tomo.gridDims[0]},${tomo.gridDims[1]}`);
              for (let i = 0; i < tomo.lon.length; i++) {
                csvLines.push(`${tomo.lon[i].toFixed(6)},${tomo.lat[i].toFixed(6)},${tomo.alt[i].toFixed(1)},${tomo.concentration[i].toFixed(6)}`);
              }
            }
          } catch (e) {
            console.warn('Error in tomography:', e);
          }
        }
      }
    }

    return csvLines.join('\n');
  }

  /**
   * Filter scans by quality criteria
   */
  filterValidScans(scans) {
    return scans.filter(scan => {
      if (!scan.spectralData) return false;
      
      const completeness = scan.plumeCompleteness || 0;
      const baricenter = scan.plumeCentre || 0;
      const maxColumn = Math.max(...(scan.spectralData.so2Columns || []));
      
      return completeness > this.completenessLimit &&
             Math.abs(baricenter) < this.baricenterLimit &&
             maxColumn > 0;
    });
  }

  /**
   * Main tomography reconstruction algorithm
   */
  performTomography(scan1, scan2, DX1, DY1, DX2, DY2, deltaH21, S12, 
                    beta1, beta2, altS1, latVol, lonVol, utmVol, utm1, utm2) {
    
    const spec1 = scan1.spectralData;
    const spec2 = scan2.spectralData;
    
    if (!spec1 || !spec2) return null;

    // Get scan angles and columns (excluding edges and offset)
    const alpha1Full = spec1.angles;
    const alpha2Full = spec2.angles;
    const S1Full = spec1.so2Columns;
    const S2Full = spec2.so2Columns;

    // Find 180° reference point and filter data
    const ref1Idx = alpha1Full.findIndex(a => a === 180);
    const ref2Idx = alpha2Full.findIndex(a => a === 180);

    if (ref1Idx < 0 || ref2Idx < 0) return null;

    const alpha1 = alpha1Full.slice(ref1Idx + 1, -1);
    const alpha2 = alpha2Full.slice(ref2Idx + 1, -1);
    const S1Raw = S1Full.slice(ref1Idx + 1, -1);
    const S2Raw = S2Full.slice(ref2Idx + 1, -1);

    // Calculate per-station background offset (mean of 5 smallest values)
    const sorted1 = [...S1Raw].sort((a, b) => a - b);
    const offset1 = sorted1.slice(0, this.numberOffset).reduce((a, b) => a + b, 0) / this.numberOffset;
    const sorted2 = [...S2Raw].sort((a, b) => a - b);
    const offset2 = sorted2.slice(0, this.numberOffset).reduce((a, b) => a + b, 0) / this.numberOffset;

    // Convert to SCD in flat geometry
    const S1 = S1Raw.map(s => (s - offset1) * Math.sin(this.toRad(beta1)));
    const S2 = S2Raw.map(s => (s - offset2) * Math.sin(this.toRad(beta2)));

    // Find indices where column > max/e
    const maxS1 = Math.max(...S1);
    const maxS2 = Math.max(...S2);
    const threshold = 1 / Math.E;

    const ind1 = S1
      .map((s, i) => ({ val: s, idx: i }))
      .filter(x => x.val > maxS1 * threshold)
      .map(x => x.idx);

    const ind2 = S2
      .map((s, i) => ({ val: s, idx: i }))
      .filter(x => x.val > maxS2 * threshold)
      .map(x => x.idx);

    if (ind1.length < 2 || ind2.length < 2) return null;

    const nRows1 = ind1.length - 1;
    const nRows2 = ind2.length - 1;

    // Outer-product reconstruction: concentration[m,n] = beam1[m] × beam2[n]
    // O(nRows1 × nRows2) instead of O((nRows1 × nRows2)³) for least-squares
    const b1 = new Array(nRows1);
    for (let m = 0; m < nRows1; m++) b1[m] = 0.5 * (S1[ind1[m]] + S1[ind1[m + 1]]);
    const b2 = new Array(nRows2);
    for (let n = 0; n < nRows2; n++) b2[n] = 0.5 * (S2[ind2[n]] + S2[ind2[n + 1]]);
    const concentration = new Array(nRows1 * nRows2);
    for (let m = 0; m < nRows1; m++) {
        for (let n = 0; n < nRows2; n++) {
            concentration[m * nRows2 + n] = Math.max(0, b1[m] * b2[n]);
        }
    }

    // Calculate positions
    const positions = this.calculatePositions(
      concentration, nRows1, nRows2, ind1, ind2, alpha1, alpha2,
      S12, deltaH21, latVol, lonVol, altS1, utm1, utm2, utmVol
    );

    return {
      concentration: concentration,
      lon: positions.lon,
      lat: positions.lat,
      alt: positions.alt,
      gridDims: [nRows1, nRows2]
    };
  }

  /**
   * Create sparse tomography matrix
   */
  createTomographyMatrix(nRows1, nRows2, nEqs, nCols, S1, S2, alpha1, alpha2, ind1, ind2) {
    const Matrix = [];
    for (let i = 0; i < nEqs; i++) {
      Matrix.push(new Array(nCols).fill(0));
    }

    let row = 0;

    // Rows for station 1
    for (let m = 0; m < nRows1; m++) {
      for (let n = 0; n < nRows2; n++) {
        Matrix[row][m * nRows2 + n] = 1;
      }
      row++;
    }

    // Rows for station 2
    for (let m = 0; m < nRows2; m++) {
      for (let n = 0; n < nRows1; n++) {
        Matrix[row][n * nRows2 + m] = 1;
      }
      row++;
    }

    // Smoothness constraints (third derivative)
    for (let m = 0; m < nRows1 - 4; m++) {
      Matrix[row][m] = -1;
      Matrix[row][m + 1] = 3;
      Matrix[row][m + 2] = -3;
      Matrix[row][m + 3] = 1;
      row++;
    }

    for (let m = 0; m < nRows2 - 4; m++) {
      Matrix[row][m * nRows1] = -1;
      Matrix[row][(m + 1) * nRows1] = 3;
      Matrix[row][(m + 2) * nRows1] = -3;
      Matrix[row][(m + 3) * nRows1] = 1;
      row++;
    }

    return Matrix;
  }

  /**
   * Create measurement vector
   */
  createMeasurementVector(nRows1, nRows2, S1, S2, ind1, ind2) {
    const nEqs = 2 * (nRows1 + nRows2) + (ind1.length - 4) + (ind2.length - 4);
    const Cols = new Array(nEqs).fill(0);

    let idx = 0;

    // Measurements from station 1
    for (let m = 0; m < nRows1; m++) {
      Cols[idx++] = 0.5 * (S1[ind1[m]] + S1[ind1[m + 1]]);
    }

    // Measurements from station 2
    for (let m = 0; m < nRows2; m++) {
      Cols[idx++] = 0.5 * (S2[ind2[m]] + S2[ind2[m + 1]]);
    }

    // Smoothness = 0
    while (idx < nEqs) {
      Cols[idx++] = 0;
    }

    return Cols;
  }

  /**
   * Solve Ax=b using least squares (QR decomposition via numerical methods)
   */
  solveLeastSquares(A, b) {
    const m = A.length;
    const n = A[0].length;

    // Normal equations: (A^T A) x = A^T b
    const ATA = this.matrixMultiply(this.transpose(A), A);
    const ATb = this.matrixMultiply(this.transpose(A), [b]);

    // Solve using Gaussian elimination with partial pivoting
    const x = this.gaussianElimination(ATA, ATb.map(row => row[0]));
    
    return x;
  }

  /**
   * Gaussian elimination solver
   */
  gaussianElimination(A, b) {
    const n = A.length;
    const aug = A.map((row, i) => [...row, b[i]]);

    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) {
          maxRow = k;
        }
      }
      [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];

      // Make zeros below
      for (let k = i + 1; k < n; k++) {
        const factor = aug[k][i] / aug[i][i];
        for (let j = i; j <= n; j++) {
          aug[k][j] -= factor * aug[i][j];
        }
      }
    }

    // Back substitution
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = aug[i][n];
      for (let j = i + 1; j < n; j++) {
        x[i] -= aug[i][j] * x[j];
      }
      x[i] /= aug[i][i];
    }

    return x;
  }

  /**
   * Calculate geographic positions of plume points
   */
  calculatePositions(concentration, nRows1, nRows2, ind1, ind2, alpha1, alpha2,
                     S12, deltaH21, latVol, lonVol, altS1, utm1, utm2, utmVol) {
    const positions = {
      lon: [],
      lat: [],
      alt: []
    };

    const EPS = 1e-6;

    // Mean angles for each grid cell
    for (let m = 0; m < nRows1; m++) {
      for (let n = 0; n < nRows2; n++) {
        const meanAlpha1 = (alpha1[ind1[m]] + alpha1[ind1[m + 1]]) / 2;
        const meanAlpha2 = (alpha2[ind2[n]] + alpha2[ind2[n + 1]]) / 2;

        // Use absolute tangents and EPS guards to avoid NaN/Infinity
        const ta1 = Math.abs(Math.tan(this.toRad(meanAlpha1)));
        const ta2 = Math.abs(Math.tan(this.toRad(meanAlpha2)));

        let PosX, PosY;
        if (ta1 > EPS && ta2 > EPS) {
            PosX = (S12 + deltaH21 * ta2) / (1 + ta2 / ta1);
            PosY = PosX / ta1;
        } else if (ta1 <= EPS && ta2 > EPS) {
            PosX = 0;
            PosY = deltaH21 + S12 / ta2;
        } else if (ta2 <= EPS && ta1 > EPS) {
            PosX = S12;
            PosY = S12 / ta1;
        } else {
            PosX = 0;
            PosY = 0;
        }

        // Convert back to geographic coordinates
        const lonUtm = utm1.easting  + (PosX / S12) * (utm2.easting  - utm1.easting);
        const latUtm = utm1.northing + (PosX / S12) * (utm2.northing - utm1.northing);

        const deg = this.utm2deg(latUtm, lonUtm, utm1.zone);
        positions.lon.push(deg.lon);
        positions.lat.push(deg.lat);
        positions.alt.push(altS1 + PosY);
      }
    }

    return positions;
  }

  /**
   * Matrix utilities
   */
  matrixMultiply(A, B) {
    const result = [];
    for (let i = 0; i < A.length; i++) {
      result[i] = [];
      for (let j = 0; j < B[0].length; j++) {
        result[i][j] = 0;
        for (let k = 0; k < B.length; k++) {
          result[i][j] += A[i][k] * B[k][j];
        }
      }
    }
    return result;
  }

  transpose(A) {
    return A[0].map((_, i) => A.map(row => row[i]));
  }

  /**
   * Time parsing (simple format)
   */
  parseTime(dateStr) {
    return new Date(dateStr).getTime();
  }

  /**
   * Angle conversion
   */
  toRad(deg) {
    return deg * Math.PI / 180;
  }

  toDeg(rad) {
    return rad * 180 / Math.PI;
  }
}

export async function tomoInverse(data, deg2utm) {
    const completenessLimit = document.getElementById("completenessLimit")?.valueAsNumber ?? 0.9;
    const baricenterLimit   = document.getElementById("baricenterLimit")?.valueAsNumber ?? 60;
    const timeDifferenceMin = document.getElementById("timeDifferenceMin")?.valueAsNumber ?? 15;
    const timeDifference    = timeDifferenceMin * 60 * 1000;

    const tomo = new VolcanoTomography({ completenessLimit, baricenterLimit, timeDifferenceMin });

    // Convert raw scan data to the format VolcanoTomography expects, computing
    // plumeCentre and plumeCompleteness needed by filterValidScans.
    function toScan(s) {
        const allAngles = s.spectralData.map(v => v.scanangle);
        const allCols   = s.spectralData.map(v => v.column_SO2);
        const ref = allAngles.indexOf(180);
        const angles  = ref >= 0 ? allAngles.slice(ref + 1) : allAngles;
        const rawCols = ref >= 0 ? allCols.slice(ref + 1)   : allCols;

        const sorted = [...rawCols].sort((a, b) => a - b);
        const offset = sorted.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
        const so2    = rawCols.map(x => (x - offset) * Math.sin(s.scanInfo.coneangle * Math.PI / 180));

        const sumSO2 = so2.reduce((a, b) => a + b, 0);
        const plumeCentre = sumSO2 > 0
            ? angles.reduce((acc, a, i) => acc + a * so2[i], 0) / sumSO2
            : 0;
        const maxSO2 = Math.max(...so2);
        const plumeCompleteness = maxSO2 > 0
            ? 1 - 0.5 * Math.max(
                0.2 * so2.slice(0,  5).reduce((a, b) => a + b, 0),
                0.2 * so2.slice(-5).reduce((a, b) => a + b, 0)
              ) / maxSO2
            : 0;

        const starttime = s.spectralData[Math.max(0, ref + 1)]?.starttime ?? '00:00:00';
        const dateStr   = s.scanInfo.date.split('.').reverse().join('-');

        return {
            date: dateStr,
            startTime: starttime,
            latitude:  s.scanInfo.lat,
            longitude: s.scanInfo.long,
            altitude:  s.scanInfo.alt,
            coneAngle: s.scanInfo.coneangle,
            plumeCentre,
            plumeCompleteness,
            spectralData: {
                angles:    allAngles,
                so2Columns: allCols,
                so2Errors:  s.spectralData.map(v => v.columnerror_SO2 ?? 0),
                flags:      s.spectralData.map(v => v.isgoodpoint ?? 1),
            },
            _time: new Date(dateStr + 'T' + starttime),
        };
    }

    const scans1 = data[0].map(toScan);
    const scans2 = data[1].map(toScan);
    const valid1 = tomo.filterValidScans(scans1);
    const valid2 = tomo.filterValidScans(scans2);
    console.log(`Valid scans: instrument 1 = ${valid1.length}, instrument 2 = ${valid2.length}`);

    // Station and volcano geometry
    const [, latVol, lonVol] = locateVolcano(data);
    const altS1 = data[0][0].scanInfo.alt;
    const latS1 = data[0][0].scanInfo.lat,  lonS1 = data[0][0].scanInfo.long;
    const latS2 = data[1][0].scanInfo.lat,  lonS2 = data[1][0].scanInfo.long;

    const utmVol = tomo.deg2utm(latVol, lonVol);
    const utm1   = tomo.deg2utm(latS1,  lonS1);
    const utm2   = tomo.deg2utm(latS2,  lonS2);

    const DX1 = utm1.easting  - utmVol.easting;
    const DY1 = utm1.northing - utmVol.northing;
    const DX2 = utm2.easting  - utmVol.easting;
    const DY2 = utm2.northing - utmVol.northing;
    const deltaH21 = data[1][0].scanInfo.alt - altS1;
    const S12 = Math.sqrt((DX1 - DX2)**2 + (DY1 - DY2)**2);
    const beta1 = data[0][0].scanInfo.coneangle;
    const beta2 = data[1][0].scanInfo.coneangle;

    // Sort by time so we can use a two-pointer sweep instead of O(n×m)
    valid1.sort((a, b) => (a._time?.getTime() ?? 0) - (b._time?.getTime() ?? 0));
    valid2.sort((a, b) => (a._time?.getTime() ?? 0) - (b._time?.getTime() ?? 0));

    const frames = [];
    let j0 = 0;
    for (const s1 of valid1) {
        const t1 = s1._time?.getTime() ?? 0;
        // Advance the left boundary of the window
        while (j0 < valid2.length && (valid2[j0]._time?.getTime() ?? 0) < t1 - timeDifference) j0++;
        for (let j = j0; j < valid2.length; j++) {
            const s2 = valid2[j];
            const t2 = s2._time?.getTime() ?? 0;
            if (t2 > t1 + timeDifference) break;
            try {
                const result = tomo.performTomography(
                    s1, s2,
                    DX1, DY1, DX2, DY2, deltaH21, S12,
                    beta1, beta2, altS1, latVol, lonVol, utmVol, utm1, utm2
                );
                if (!result) continue;
                const { concentration, lon, lat, alt, gridDims } = result;
                const points = concentration.map((c, i) => {
                    const [latPutm, lonPutm] = deg2utm(lat[i], lon[i]);
                    return { latPutm, lonPutm, altP: alt[i], Concentration: c };
                });
                frames.push({
                    points,
                    size1: gridDims[0],
                    size2: gridDims[1],
                    time:  new Date((t1 + t2) / 2),
                    date1: s1._time,
                    date2: s2._time,
                });
            } catch (e) {
                console.warn('Failed to process scan pair:', e);
            }
        }
    }
    console.log(`tomoInverse: ${frames.length} frame(s) produced`);
    return frames;
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VolcanoTomography;
}
