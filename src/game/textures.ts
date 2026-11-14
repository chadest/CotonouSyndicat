/**
 * Procedural HTML5 Canvas texture library for Cotonou's architecture,
 * Esplanade de l'Amazone stonework, Boulevard de la Marina asphalt,
 * coastal sand, burnished bronze statue patina, and radial grounding shadows.
 * All color textures explicitly configure SRGBColorSpace and anisotropic filtering.
 */
import * as THREE from 'three';

export interface CotonouTextures {
  asphalt: THREE.CanvasTexture;
  esplanadeTile: THREE.CanvasTexture;
  sand: THREE.CanvasTexture;
  ocean: THREE.CanvasTexture;
  buildingWarm: THREE.CanvasTexture;
  buildingTerracotta: THREE.CanvasTexture;
  buildingModern: THREE.CanvasTexture;
  bronzePatina: THREE.CanvasTexture;
  bronzeRock: THREE.CanvasTexture;
  granite: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  policeDoorDecal: THREE.CanvasTexture;
  dispose: () => void;
}

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createCotonouTextures(maxAnisotropy: number): CotonouTextures {
  const created: THREE.Texture[] = [];

  // 1. Weathered Cotonou coastal asphalt road with lane markings
  const asphaltCanvas = document.createElement('canvas');
  asphaltCanvas.width = 256;
  asphaltCanvas.height = 256;
  const actx = asphaltCanvas.getContext('2d')!;
  actx.fillStyle = '#25282e';
  actx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1200; i++) {
    const v = 28 + Math.floor(Math.random() * 24);
    actx.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
    actx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  actx.fillStyle = 'rgba(182, 145, 98, 0.16)';
  actx.fillRect(0, 0, 13, 256);
  actx.fillRect(243, 0, 13, 256);
  actx.fillStyle = '#e5b84b';
  for (let y = 8; y < 256; y += 32) {
    actx.fillRect(125, y, 6, 17);
  }
  const asphalt = finalizeColorTexture(asphaltCanvas, maxAnisotropy, 1, 1);
  created.push(asphalt);

  // 2. Esplanade de l'Amazone pale travertine-beige stone paving (as seen in reference photos)
  const plazaCanvas = document.createElement('canvas');
  plazaCanvas.width = 512;
  plazaCanvas.height = 512;
  const pctx = plazaCanvas.getContext('2d')!;
  pctx.fillStyle = '#cfc5b7';
  pctx.fillRect(0, 0, 512, 512);
  const tileW = 64;
  const tileH = 32;
  for (let y = 0; y < 512; y += tileH) {
    const offset = ((y / tileH) % 2) * (tileW / 2);
    for (let x = -tileW; x < 512 + tileW; x += tileW) {
      const tone = 196 + ((Math.abs(x * 13 + y * 7)) % 18);
      pctx.fillStyle = `rgb(${tone}, ${tone - 9}, ${tone - 20})`;
      pctx.fillRect(x + offset + 1, y + 1, tileW - 2, tileH - 2);
    }
  }
  const esplanadeTile = finalizeColorTexture(plazaCanvas, maxAnisotropy, 12, 12);
  created.push(esplanadeTile);

  // 3. Fidjrossè golden Atlantic beach sand
  const sandCanvas = document.createElement('canvas');
  sandCanvas.width = 256;
  sandCanvas.height = 256;
  const sctx = sandCanvas.getContext('2d')!;
  sctx.fillStyle = '#d7b986';
  sctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1200; i++) {
    const r = 195 + Math.floor(Math.random() * 35);
    const g = 162 + Math.floor(Math.random() * 35);
    const b = 110 + Math.floor(Math.random() * 30);
    sctx.fillStyle = `rgb(${r},${g},${b})`;
    sctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const sand = finalizeColorTexture(sandCanvas, maxAnisotropy, 18, 6);
  created.push(sand);

  // 4. Atlantic Ocean surface pattern
  const oceanCanvas = document.createElement('canvas');
  oceanCanvas.width = 256;
  oceanCanvas.height = 256;
  const octx = oceanCanvas.getContext('2d')!;
  octx.fillStyle = '#125a7a';
  octx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 95; i++) {
    octx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.14)' : 'rgba(28, 126, 166, 0.45)';
    octx.fillRect(Math.random() * 220, Math.random() * 256, 28 + Math.random() * 44, 3);
  }
  const ocean = finalizeColorTexture(oceanCanvas, maxAnisotropy, 24, 10);
  created.push(ocean);

  // 5. Building Facades
  const makeFacade = (wallColor: string, trimColor: string, windowColor: string, litColor: string) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = wallColor;
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 64) {
      ctx.fillStyle = trimColor;
      ctx.fillRect(0, y, 256, 7);
      for (let x = 14; x < 246; x += 48) {
        const isLit = (x * 7 + y * 13) % 5 === 0;
        ctx.fillStyle = isLit ? litColor : windowColor;
        ctx.fillRect(x, y + 16, 30, 34);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(x, y + 32, 30, 3);
      }
    }
    const t = finalizeColorTexture(c, maxAnisotropy, 1, 2);
    created.push(t);
    return t;
  };

  const buildingWarm = makeFacade('#d9c7a8', '#b8a280', '#24323f', '#f4c76b');
  const buildingTerracotta = makeFacade('#c2684b', '#934730', '#1f2933', '#ffd479');
  const buildingModern = makeFacade('#415061', '#2b3643', '#162330', '#9cd3eb');

  // 6. Burnished warm golden-bronze patina (matching the real Monument Amazone sheen)
  const bronzeCanvas = document.createElement('canvas');
  bronzeCanvas.width = 256;
  bronzeCanvas.height = 256;
  const bctx = bronzeCanvas.getContext('2d')!;
  bctx.fillStyle = '#926f46';
  bctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const warm = i % 3 !== 0;
    bctx.fillStyle = warm ? 'rgba(186, 146, 92, 0.22)' : 'rgba(66, 52, 38, 0.22)';
    bctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 5);
  }
  const bronzePatina = finalizeColorTexture(bronzeCanvas, maxAnisotropy, 2, 2);
  created.push(bronzePatina);

  // 7. Darker sculpted bronze rocky crag texture at base of statue
  const rockCanvas = document.createElement('canvas');
  rockCanvas.width = 256;
  rockCanvas.height = 256;
  const rctx = rockCanvas.getContext('2d')!;
  rctx.fillStyle = '#6c5339';
  rctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1500; i++) {
    rctx.fillStyle = i % 2 === 0 ? 'rgba(148, 118, 82, 0.24)' : 'rgba(42, 32, 24, 0.28)';
    rctx.fillRect(Math.random() * 256, Math.random() * 256, 5, 3);
  }
  const bronzeRock = finalizeColorTexture(rockCanvas, maxAnisotropy, 3, 3);
  created.push(bronzeRock);

  // 8. Granite stone plinth texture
  const graniteCanvas = document.createElement('canvas');
  graniteCanvas.width = 256;
  graniteCanvas.height = 256;
  const gctx = graniteCanvas.getContext('2d')!;
  gctx.fillStyle = '#7e766c';
  gctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1200; i++) {
    const shade = 95 + Math.floor(Math.random() * 55);
    gctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 9})`;
    gctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const granite = finalizeColorTexture(graniteCanvas, maxAnisotropy, 3, 2);
  created.push(granite);

  // 9. Soft radial contact shadow decal
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const shctx = shadowCanvas.getContext('2d')!;
  const rad = shctx.createRadialGradient(64, 64, 10, 64, 64, 62);
  rad.addColorStop(0, 'rgba(0, 0, 0, 0.58)');
  rad.addColorStop(0.55, 'rgba(0, 0, 0, 0.24)');
  rad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  shctx.fillStyle = rad;
  shctx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shadowCanvas);
  contactShadow.needsUpdate = true;
  created.push(contactShadow);

  // 10. Police Républicaine du Bénin vehicle door livery decal
  const policeCanvas = document.createElement('canvas');
  policeCanvas.width = 512;
  policeCanvas.height = 128;
  const polCtx = policeCanvas.getContext('2d')!;
  polCtx.fillStyle = '#f8fafc';
  polCtx.fillRect(0, 0, 512, 128);
  // Benin national tricolor stripe along bottom of white door panel
  polCtx.fillStyle = '#008751';
  polCtx.fillRect(0, 100, 170, 28);
  polCtx.fillStyle = '#fcd116';
  polCtx.fillRect(170, 100, 172, 28);
  polCtx.fillStyle = '#e8112d';
  polCtx.fillRect(342, 100, 170, 28);
  // Navy blue "POLICE RÉPUBLICAINE" emblem text
  polCtx.fillStyle = '#12264a';
  polCtx.font = 'bold 34px sans-serif';
  polCtx.textAlign = 'center';
  polCtx.textBaseline = 'middle';
  polCtx.fillText('POLICE RÉPUBLICAINE', 256, 44);
  polCtx.font = 'bold 18px sans-serif';
  polCtx.fillStyle = '#334155';
  polCtx.fillText('BÉNIN · COTONOU', 256, 78);
  const policeDoorDecal = finalizeColorTexture(policeCanvas, maxAnisotropy, 1, 1);
  created.push(policeDoorDecal);

  return {
    asphalt,
    esplanadeTile,
    sand,
    ocean,
    buildingWarm,
    buildingTerracotta,
    buildingModern,
    bronzePatina,
    bronzeRock,
    granite,
    contactShadow,
    policeDoorDecal,
    dispose: () => {
      created.forEach((t) => t.dispose());
    },
  };
}
