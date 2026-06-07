// © 2025 David Dalmazzo.All Rights Reserved.

// This code and associated research materials are proprietary and confidential.This work is part of the ANIMA MSCA Postdoctoral Fellowship(Project ID: 101203318) funded by the European Union's Horizon Europe program.
// Usage Terms:

// Academic Citation: Permitted with proper attribution to the author and project
// Non - Commercial Research: Contact for collaboration inquiries
// Commercial Use: Strictly prohibited without explicit written permission
// Code Distribution: Not permitted without authorization
// Unauthorized copying, distribution, modification, or commercial use of this software, algorithms, or associated methods is strictly prohibited.

// Attribution

// When referencing this work in academic publications, please cite:

// Dalmazzo, D. (2025).ANIMA Harmonic Eigenspace: 4D Psychoacoustic
// Dissonance Visualization for Microtonal Harmony.MSCA Project 101203318.

/**
 * Load a binary file and return its contents as a Float32Array
 * @param {string} url - URL of the binary file
 * @returns {Promise<Float32Array>}
 */
async function loadBinaryFile(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    return new Float32Array(buffer);
}

/**
 * Load a pre-computed dissonance map from binary files
 * Format matches Python dataset_eigenspace.ipynb output:
 * - metadata.bin: [numNodes, node1_data[4], node2_data[4], ..., alphaRange[nodes], betaRange[nodes], gammaRange[nodes]]
 * - chunkXXX.bin: Flattened dissonance 3D array in ~25MB chunks
 * 
 * @param {number} baseFreq - Base frequency in Hz
 * @param {number} nodes - Grid size (N for NxNxN grid)
 * @param {(percent:number, text:string)=>void} [onProgress] - Optional progress callback
 * @returns {Promise<{alphaRange: Float32Array, betaRange: Float32Array, gammaRange: Float32Array, dissonance3d: Float32Array[][][], nodes: Array<{alpha: number, beta: number, gamma: number, dissonance: number}>}>}
 */
async function loadDissonanceMap(baseFreq = 220, nodes = 400, onProgress) {
    if (!Number.isFinite(baseFreq) || baseFreq <= 0) {
        throw new Error('Invalid base frequency');
    }
    if (!Number.isInteger(nodes) || nodes <= 0) {
        throw new Error('Invalid number of nodes');
    }

    try {
        console.log('Loading dissonance map from binary files...');
        const baseFilename = `harmonic-${baseFreq}Hz-${nodes}nodes`;

        // Load metadata
        if (typeof onProgress === 'function') onProgress(1, 'Loading metadata…');
        const metadataArray = await loadBinaryFile(`dataset/${baseFilename}-metadata.bin`);
        if (typeof onProgress === 'function') onProgress(5, 'Metadata loaded');

        // Parse metadata
        const numNodes = Math.round(metadataArray[0]);
        if (!Number.isFinite(numNodes) || numNodes <= 0 || numNodes > 10000) {
            throw new Error(`Invalid number of nodes in metadata: ${numNodes}`);
        }
        const harmonicNodes = Array.from({ length: numNodes }, (_, i) => ({
            alpha: metadataArray[1 + i * 4],
            beta: metadataArray[1 + i * 4 + 1],
            gamma: metadataArray[1 + i * 4 + 2],
            dissonance: metadataArray[1 + i * 4 + 3]
        }));

        const rangeStart = 1 + numNodes * 4;
        const alphaRange = new Float32Array(metadataArray.slice(rangeStart, rangeStart + nodes));
        const betaRange = new Float32Array(metadataArray.slice(rangeStart + nodes, rangeStart + 2 * nodes));
        const gammaRange = new Float32Array(metadataArray.slice(rangeStart + 2 * nodes, rangeStart + 3 * nodes));

        console.log('✓ Metadata parsed');

    // Load chunks until reaching expected size (preferred) or 404 (fallback)
    if (typeof onProgress === 'function') onProgress(8, 'Loading dataset…');
        const chunks = [];
        const maxRetries = 3;
        // Don't assume a fixed chunk count — datasets vary (400 nodes → 10 chunks,
        // 500 nodes → 20, etc.). Load until we've accumulated the expected element
        // count (reachedTarget) or a chunk 404s. MAX_CHUNKS is just a safety bound.
        const MAX_CHUNKS = 10000;
        let totalSize = 0; // number of Float32 elements accumulated
        let loadedChunks = 0;
        const expectedSize = nodes * nodes * nodes; // exact element count
        let percent = 0;

        for (let idx = 1; idx <= MAX_CHUNKS; idx++) {
            const chunkNum = String(idx).padStart(3, '0');
            const chunkUrl = `dataset/${baseFilename}-chunk${chunkNum}.bin`;

            let attempt = 0;
            let loaded = false;
            let reachedTarget = false;
            while (attempt < maxRetries) {
                try {
                    const response = await fetch(chunkUrl);
                    if (!response.ok) {
                        if (response.status === 404) {
                            attempt = maxRetries; // stop retries for this idx
                            break;
                        }
                        throw new Error(`HTTP ${response.status} ${response.statusText}`);
                    }
                    const buffer = await response.arrayBuffer();
                    const chunk = new Float32Array(buffer);
                    chunks.push(chunk);
                    totalSize += chunk.length;
                    loadedChunks++;
                    loaded = true;
                        if (totalSize >= expectedSize) {
                        reachedTarget = true;
                    }
                    if (typeof onProgress === 'function') {
                        // Scale with data actually loaded (works for any chunk count): 8→97%.
                        percent = 8 + Math.min(1, totalSize / expectedSize) * 89;
                        percent = Math.floor(percent * 10) / 10;
                        onProgress(percent, `Loading dataset… (${percent}%)`);
                    }
                    break;
                } catch (err) {
                    attempt++;
                    if (attempt >= maxRetries) {
                        const msg = String(err && err.message || err);
                        if (/404/.test(msg)) {
                            // treat as end-of-chunks
                            break;
                        } else {
                            throw new Error(`Failed to load ${chunkUrl}: ${msg}`);
                        }
                    }
                    await new Promise(r => setTimeout(r, 300 * attempt));
                }
            }
                if (!loaded) {
                    // likely 404 -> end
                    break;
                }
            if (reachedTarget) {
                // We've loaded all expected elements; stop without probing next chunk
                break;
            }
        }

        console.log(`Total chunks: ${loadedChunks}`);
        console.log(`Total data loaded: ${(totalSize * 4 / 1024 / 1024).toFixed(2)} MB`);

        // Combine chunks
        const flatDissonance = new Float32Array(totalSize);
        let offset = 0;
        for (const chunk of chunks) {
            flatDissonance.set(chunk, offset);
            offset += chunk.length;
        }
        if (typeof onProgress === 'function') onProgress(97, 'Reconstructing 3D array…');

        // Reconstruct 3D array (C-order: i, j, k)
        const dissonance3d = Array.from({ length: nodes }, () =>
            Array.from({ length: nodes }, () => new Float32Array(nodes))
        );
        for (let i = 0; i < nodes; i++) {
            for (let j = 0; j < nodes; j++) {
                const baseIndex = (i * nodes * nodes) + (j * nodes);
                dissonance3d[i][j].set(flatDissonance.subarray(baseIndex, baseIndex + nodes));
            }
        }
        if (typeof onProgress === 'function') onProgress(100, 'Dataset loaded');

        return { alphaRange, betaRange, gammaRange, dissonance3d, nodes: harmonicNodes };
    } catch (error) {
        console.error('Failed to load dissonance map:', error);
        throw error;
    }
}

// Export the loading function
window.loadDissonanceMap = loadDissonanceMap;