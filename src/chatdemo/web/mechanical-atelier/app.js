import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const TAU = Math.PI * 2;
const viewport = document.getElementById('viewport');
const $ = (id) => document.getElementById(id);
const state = { model: 'geneva', playing: !matchMedia('(prefers-reduced-motion: reduce)').matches, speed: .55, time: 0, explode: 0, explodeTarget: 0, labels: true };
const models = new Map();
let renderer, scene, camera, controls, current, cameraTransition;
const geometries = new Map();
const M = {};

function material(name, color, metalness, roughness) {
  return M[name] = new THREE.MeshStandardMaterial({ color, metalness, roughness });
}
material('brass', '#bfa065', .84, .28);
material('gold', '#d9bd86', .86, .24);
material('steel', '#303e49', .7, .3);
material('silver', '#abb7ba', .88, .24);
material('ruby', '#8d302c', .38, .24);
material('ivory', '#e4ddca', .15, .47);
material('wood', '#372f28', .07, .55);

function group(parent, x = 0, y = 0, z = 0, name = '') {
  const o = new THREE.Group(); o.position.set(x, y, z); o.name = name; parent.add(o); return o;
}
function mesh(parent, geometry, mat, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geometry, mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
}
function box(parent, x, y, z, width, height, depth, mat) {
  return mesh(parent, new THREE.BoxGeometry(width, height, depth), mat, x, y, z);
}
function disk(parent, x, y, z, radius, depth, mat, segments = 64) {
  const o = mesh(parent, new THREE.CylinderGeometry(radius, radius, depth, segments), mat, x, y, z); o.rotation.x = Math.PI / 2; return o;
}
function sphere(parent, x, y, z, radius, mat) {
  return mesh(parent, new THREE.SphereGeometry(radius, 24, 12), mat, x, y, z);
}
function ring(parent, x, y, z, radius, tube, mat) {
  return mesh(parent, new THREE.TorusGeometry(radius, tube, 8, 96), mat, x, y, z);
}
function beam(parent, a, b, width, depth, mat) {
  const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), vector = to.clone().sub(from);
  const o = mesh(parent, new THREE.BoxGeometry(width, vector.length(), depth), mat);
  o.position.copy(from.add(to).multiplyScalar(.5));
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize());
  return o;
}
function bolt(parent, x, y, z, radius = .045) {
  const screw = group(parent, x, y, z);
  disk(screw, 0, 0, 0, radius, .055, M.silver, 6);
  box(screw, 0, 0, .033, radius * 1.05, .012, .007, M.steel);
  return screw;
}
function text(parent, content, x, y, z, width, height, color = '#e3d5b6', background = null, font = 'Georgia') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, 512, 128); }
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `52px ${font}`; ctx.fillText(content, 256, 67);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  return mesh(parent, new THREE.PlaneGeometry(width, height), mat, x, y, z);
}
function extrude(parent, shape, depth, mat) {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: 2, curveSegments: 48, steps: 1 });
  geometry.translate(0, 0, -depth / 2);
  return mesh(parent, geometry, mat);
}
function addHole(shape, radius) {
  const p = new THREE.Path(); p.absarc(0, 0, radius, 0, TAU, true); shape.holes.push(p);
}

// Build each tooth from its two involute flanks, rather than a row of boxes.
function gearOutline(teeth, module = .055) {
  const rp = module * teeth / 2, rb = rp * Math.cos(Math.PI / 9), ra = rp + module, rd = rp - 1.25 * module;
  const inv = (r) => { const t = Math.sqrt(Math.max(0, (r / rb) ** 2 - 1)); return t - Math.atan(t); };
  const half = Math.PI / (2 * teeth), atPitch = inv(rp), pitch = TAU / teeth, points = [];
  const add = (r, a) => points.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)));
  for (let i = 0; i < teeth; i++) {
    const a = i * pitch, rootAngle = half + atPitch;
    add(rd, a - pitch / 2); add(rd, a - rootAngle);
    for (let j = 0; j <= 6; j++) { const r = Math.max(rd, rb) + (ra - Math.max(rd, rb)) * j / 6; add(r, a - half - atPitch + inv(r)); }
    const tip = half + atPitch - inv(ra);
    for (let j = 1; j <= 3; j++) add(ra, a - tip + 2 * tip * j / 3);
    for (let j = 6; j >= 0; j--) { const r = Math.max(rd, rb) + (ra - Math.max(rd, rb)) * j / 6; add(r, a + half + atPitch - inv(r)); }
    add(rd, a + rootAngle); add(rd, a + pitch / 2);
  }
  return { points, rp };
}
function gear(parent, teeth, mat = M.brass, options = {}) {
  const depth = options.depth ?? .14, spokes = options.spokes ?? (teeth > 30 ? 6 : 4), module = options.module ?? .055;
  const data = gearOutline(teeth, module), g = group(parent);
  const cacheKey = `${teeth}/${depth}/${module}`;
  if (!geometries.has(cacheKey)) {
    const shape = new THREE.Shape(data.points); addHole(shape, data.rp * .71);
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .006, bevelThickness: .006, bevelSegments: 1, curveSegments: 48 });
    geo.translate(0, 0, -depth / 2); geometries.set(cacheKey, geo);
  }
  mesh(g, geometries.get(cacheKey), mat);
  ring(g, 0, 0, depth / 2 + .008, data.rp * .74, .018, M.gold);
  for (let i = 0; i < spokes; i++) {
    const a = i * TAU / spokes;
    beam(g, [.10 * Math.cos(a), .10 * Math.sin(a), 0], [data.rp * .77 * Math.cos(a), data.rp * .77 * Math.sin(a), 0], .09, depth * .7, mat);
    bolt(g, data.rp * .62 * Math.cos(a), data.rp * .62 * Math.sin(a), depth / 2 + .025, .03);
  }
  disk(g, 0, 0, 0, .18, depth * 1.45, M.steel);
  ring(g, 0, 0, depth * .85, .12, .022, M.gold);
  disk(g, 0, 0, depth * .9, .052, .07, M.silver, 32);
  return g;
}
function layer(model, object, amount) { model.layers.push({ object, z: object.position.z, amount }); return object; }
function label(model, object, caption, offset, point = [0, 0, 0]) { model.labels.push({ object, caption, offset, point: new THREE.Vector3(...point) }); }
function base(model, width = 6.9) {
  const root = model.root;
  box(root, 0, .18, -.08, width, .3, 2.7, M.wood);
  box(root, 0, .355, -.08, width - .18, .07, 2.53, M.brass);
  box(root, 0, .43, -.08, width - .35, .08, 2.34, M.steel);
  for (const x of [-width / 2 + .45, width / 2 - .45]) for (const z of [-.85, .72]) {
    box(root, x, .055, z, .46, .11, .43, M.steel);
    const b = bolt(root, x, .48, z); // The base screws point upwards.
    b.rotation.x = -Math.PI / 2;
  }
  box(root, 0, .3, 1.294, 2.6, .22, .025, M.steel);
  text(root, model.plaque, 0, .303, 1.312, 2.35, .18);
}
function frame(model, left = -3.18, right = 2.78, top = 6.04) {
  const root = model.root;
  for (const x of [left, right]) {
    box(root, x, (top + .47) / 2, -.91, .15, top - .47, .19, M.steel);
    box(root, x, .61, -.91, .56, .28, .62, M.brass);
    for (const y of [.77, top - .1]) bolt(root, x, y, -.78, .055);
  }
  beam(root, [left, top, -.9], [right, top, -.9], .12, .18, M.brass);
  beam(root, [left, 1.15, -.93], [right, 1.15, -.93], .10, .15, M.brass);
}
function bearing(parent, x, y, z = -.9) {
  box(parent, x, y, z, .49, .45, .14, M.steel);
  disk(parent, x, y, z + .1, .2, .13, M.gold);
  disk(parent, x, y, z + .2, .078, .10, M.ruby, 24);
  for (const dx of [-.18, .18]) bolt(parent, x + dx, y + .14, z + .12, .028);
}
function spring(parent, x, y, z, radius = .98) {
  const root = group(parent, x, y, z, 'Wound spring');
  disk(root, 0, 0, -.14, radius + .06, .08, M.steel);
  ring(root, 0, 0, 0, radius, .055, M.brass);
  ring(root, 0, 0, -.08, radius, .035, M.gold);
  const points = [];
  for (let i = 0; i <= 220; i++) { const a = i / 220 * TAU * 5, r = .10 + (radius - .17) * i / 220; points.push(new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), .025)); }
  const curve = new THREE.CatmullRomCurve3(points);
  mesh(root, new THREE.TubeGeometry(curve, 220, .018, 6, false), M.silver);
  disk(root, 0, 0, .07, .12, .13, M.brass);
  return root;
}
function windKey(parent, x, y, z) {
  const key = group(parent, x, y, z);
  disk(key, 0, 0, .04, .067, .5, M.silver, 24);
  beam(key, [-.31, 0, .28], [.31, 0, .28], .075, .06, M.brass);
  for (const xx of [-.23, .23]) ring(key, xx, 0, .31, .10, .038, M.brass);
  return key;
}
function dial(parent, radius, height, z, count = 120) {
  const d = group(parent, 0, height, z);
  ring(d, 0, 0, 0, radius, .035, M.steel);
  ring(d, 0, 0, .018, radius + .055, .016, M.gold);
  for (let i = 0; i < count; i++) {
    const a = i * TAU / count, length = i % 5 === 0 ? .12 : .045;
    beam(d, [(radius - length) * Math.cos(a), (radius - length) * Math.sin(a), .02], [radius * Math.cos(a), radius * Math.sin(a), .02], i % 5 ? .009 : .014, .013, M.ivory);
  }
  const roman = ['III','II','I','XII','XI','X','IX','VIII','VII','VI','V','IV'];
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; text(d, roman[i], (radius + .19) * Math.cos(a), (radius + .19) * Math.sin(a), .027, .24, .08, '#705333'); }
  return d;
}

function makeGeneva() {
  const model = { root: new THREE.Group(), layers: [], labels: [], plaque: 'GENEVA / SPRING No. 01' };
  const r = model.root, cy = 2.05, a = Math.sqrt(2.475 ** 2 - 1.65 ** 2), gy = cy + a, pinRadius = a / 2;
  base(model); frame(model);
  beam(r, [-3.18, cy, -.95], [2.78, cy, -.95], .12, .15, M.brass);
  beam(r, [-3.18, gy, -1.02], [2.78, gy, -1.02], .12, .15, M.steel);
  for (const [x, y] of [[-1.98, cy], [0, cy], [1.65, cy], [0, gy]]) {
    bearing(r, x, y); disk(r, x, y, -.02, .063, 2.15, M.silver, 24);
  }
  const barrel = layer(model, spring(r, -1.98, cy, -.31, 1.04), -.65);
  windKey(r, -1.98, cy, .40);
  const main = layer(model, group(r, -1.98, cy, .18), -.2); main.add(gear(main, 48));
  const input = layer(model, group(r, 0, cy, .18), -.2); input.add(gear(input, 24, M.silver));
  const compound = layer(model, group(r, 1.65, cy, .18), -.2); compound.add(gear(compound, 36));
  const small = layer(model, group(r, 1.65, cy, -.64), -.75); small.add(gear(small, 18, M.silver));
  const orbit = layer(model, group(r, 0, gy, -.64), -.75); orbit.add(gear(orbit, 72, M.brass, { spokes: 9, depth: .12 }));
  const dialRoot = layer(model, dial(r, 2.15, gy, -.96), -1.2);
  for (let i = 0; i < 2; i++) {
    const ang = i * Math.PI + .28, radius = i === 0 ? 1.92 : 1.70;
    beam(orbit, [0, 0, .18], [radius * Math.cos(ang), radius * Math.sin(ang), .18], i ? .035 : .075, .06, M.gold);
    sphere(orbit, radius * Math.cos(ang), radius * Math.sin(ang), .22, i ? .105 : .135, i ? M.ivory : M.gold);
    ring(orbit, radius * Math.cos(ang), radius * Math.sin(ang), .22, i ? .14 : .19, .015, M.gold);
  }
  const geneva = layer(model, group(r, 0, gy, .76, 'Six-slot Geneva wheel'), .9);
  const wheel = new THREE.Shape(), radius = 1.61, slotWidth = .078, slotRoot = .78, lockRadius = .82;
  const outerAngle = Math.asin(slotWidth / radius);
  let first = true;
  const add = (x, y) => { if (first) { wheel.moveTo(x, y); first = false; } else wheel.lineTo(x, y); };
  for (let k = 0; k < 6; k++) {
    const angle = -Math.PI / 2 - Math.PI / 6 + k * TAU / 6, dx = Math.cos(angle), dy = Math.sin(angle), tx = -dy, ty = dx;
    add(radius * dx - slotWidth * tx, radius * dy - slotWidth * ty);
    add(slotRoot * dx - slotWidth * tx, slotRoot * dy - slotWidth * ty);
    add(slotRoot * dx + slotWidth * tx, slotRoot * dy + slotWidth * ty);
    add(radius * dx + slotWidth * tx, radius * dy + slotWidth * ty);
    for (let j = 1; j <= 48; j++) {
      const t = angle + outerAngle + (TAU / 6 - 2 * outerAngle) * j / 48;
      const delta = t - (angle + Math.PI / 6), discriminant = lockRadius ** 2 - (a * Math.sin(delta)) ** 2;
      let rad = radius;
      if (discriminant > 0) rad = Math.min(radius, a * Math.cos(delta) - Math.sqrt(discriminant));
      add(rad * Math.cos(t), rad * Math.sin(t));
    }
  }
  wheel.closePath(); addHole(wheel, .22); extrude(geneva, wheel, .14, M.steel);
  ring(geneva, 0, 0, .12, .34, .045, M.gold); disk(geneva, 0, 0, .16, .19, .15, M.brass); disk(geneva, 0, 0, .25, .078, .055, M.ruby);
  for (let i = 0; i < 6; i++) {
    const angle = -Math.PI / 2 - Math.PI / 6 + i * TAU / 6 + .1;
    bolt(geneva, .90 * Math.cos(angle), .90 * Math.sin(angle), .11, .03);
    const numeral = text(geneva, ['I','II','III','IV','V','VI'][i], 1.17 * Math.cos(angle), 1.17 * Math.sin(angle), .09, .16, .065);
    numeral.rotation.z = angle + Math.PI / 2;
  }
  const driver = layer(model, group(r, 0, cy, .76), .9);
  const lock = new THREE.Shape();
  for (let i = 0; i <= 180; i++) {
    const angle = i / 180 * TAU, inCut = angle > Math.PI / 6 && angle < Math.PI * 5 / 6, rad = inCut ? .39 : .817;
    const x = rad * Math.cos(angle), y = rad * Math.sin(angle); i ? lock.lineTo(x, y) : lock.moveTo(x, y);
  }
  lock.closePath(); addHole(lock, .10); extrude(driver, lock, .12, M.brass);
  beam(driver, [0, 0, -.12], [0, pinRadius, -.12], .13, .095, M.steel);
  disk(driver, 0, pinRadius, .10, .064, .42, M.silver, 32);
  disk(driver, 0, pinRadius, .325, .089, .065, M.gold, 32);
  disk(driver, 0, 0, .14, .15, .18, M.silver); bolt(driver, 0, 0, .25, .055);
  label(model, barrel, '发条盒 · 48T', [-58, -35]);
  label(model, geneva, '六槽分度轮', [-52, -62]);
  label(model, compound, '同轴复合轮 · 36/18T', [60, 30]);
  label(model, dialRoot, '连续日月轮 · 72T', [60, -104]);
  const phase = ((18 + 72) * Math.atan2(a, -1.65) + 72 * Math.PI - 18 * Math.PI / 36 - Math.PI) / 72;
  model.update = (seconds) => {
    const raw = seconds * Math.PI, cycle = Math.floor((raw + Math.PI) / TAU), theta = raw - cycle * TAU, alpha = Math.PI / 3;
    const phi = theta < -alpha ? -Math.PI / 6 : theta > alpha ? Math.PI / 6 : Math.atan2(pinRadius * Math.sin(theta), a - pinRadius * Math.cos(theta));
    main.rotation.z = raw / 2 + Math.PI / 48; input.rotation.z = -raw;
    compound.rotation.z = small.rotation.z = raw * 2 / 3 + Math.PI / 36;
    orbit.rotation.z = -raw / 6 + phase; driver.rotation.z = -raw;
    geneva.rotation.z = cycle * TAU / 6 + phi + Math.PI / 6;
    return Math.abs(theta) < alpha ? '销钉入槽，推动分度' : '销钉退出，槽轮停歇';
  };
  return model;
}

function makePendulum() {
  const model = { root: new THREE.Group(), layers: [], labels: [], plaque: 'ESCAPEMENT / STUDY No. 02' };
  const r = model.root, ax = -1.5, cy = 1.8, bx = .48, ey = 3.45;
  base(model); frame(model, -2.85, 2.8, 5.65);
  beam(r, [-2.85, 4.8, -.94], [2.8, 4.8, -.94], .13, .2, M.brass);
  beam(r, [-2.85, cy, -.91], [2.8, cy, -.91], .11, .2, M.brass);
  const barrel = layer(model, spring(r, ax, cy, -.25, .95), -.8);
  const main = layer(model, group(r, ax, cy, .04), -.4); gear(main, 48);
  const middle = layer(model, group(r, bx, cy, .04), -.4); gear(middle, 24, M.silver);
  const escapeBack = layer(model, group(r, bx, ey, .04), -.4); gear(escapeBack, 36);
  windKey(r, ax, cy, .31);
  for (const [x, y] of [[ax, cy], [bx, cy], [bx, ey]]) { bearing(r, x, y); disk(r, x, y, -.03, .060, 1.6, M.silver, 24); }
  const escape = layer(model, group(r, bx, ey, .57, 'Escapement rhythm'), .65);
  const teeth = new THREE.Shape();
  for (let i = 0; i < 24; i++) {
    for (const [fraction, radius] of [[0,.88],[.17,1.02],[.4,.98],[.9,.88]]) {
      const a = (i + fraction) * TAU / 24, x = radius * Math.cos(a), y = radius * Math.sin(a);
      i || fraction ? teeth.lineTo(x,y) : teeth.moveTo(x,y);
    }
  }
  teeth.closePath(); addHole(teeth, .65); extrude(escape, teeth, .085, M.gold);
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5; beam(escape, [0,0,0], [.74*Math.cos(a),.74*Math.sin(a),0], .065, .065, M.gold); }
  disk(escape, 0, 0, .01, .18, .15, M.steel); bolt(escape,0,0,.15,.055);
  const fork = layer(model, group(r, bx, 4.8, .68), .75);
  bearing(r, bx, 4.8, -.88);
  disk(r, bx, 4.8, -.05, .055, 1.59, M.silver, 24);
  beam(fork, [0,0,0], [0,-.35,0], .08, .08, M.steel);
  for (const x of [-.58,.58]) {
    beam(fork, [0,-.30,0], [x,-.64,0], .08, .075, M.steel);
    box(fork,x,-.66,.04,.17,.08,.085,M.ruby);
    bolt(fork,x,-.55,.06,.027);
  }
  ring(fork,0,0,.04,.145,.04,M.gold); disk(fork,0,0,.07,.07,.09,M.silver,24);
  const pendula = [];
  for (const [x, z] of [[-1.85,.8],[2.05,1.05]]) {
    bearing(r,x,4.8,-.88);
    disk(r,x,4.8,(z-.88)/2,.055,z+.97,M.silver,24);
    const p = layer(model,group(r,x,4.8,z),1.02);
    disk(p,0,0,0,.10,.14,M.silver,24);
    beam(p,[0,-.03,0],[0,-2.65,0],.045,.07,M.silver);
    disk(p,0,-2.65,0,.27,.18,M.brass);
    ring(p,0,-2.65,.11,.20,.025,M.gold);
    bolt(p,0,-2.65,.145,.045);
    beam(p,[-.16,-.28,0],[.16,-.28,0],.04,.07,M.brass);
    pendula.push(p);
  }
  const crown = layer(model,dial(r,1.28,ey,-.45,60),-.75);
  label(model,pendula[0],'双摆 · 反相节律',[-45,-70],[0,-1.9,0]);
  label(model,fork,'擒纵叉 / 红宝石托瓦',[56,-25]);
  label(model,escape,'步进逃逸轮',[35,40]);
  label(model,barrel,'发条传动',[0,40]);
  model.update = (seconds) => {
    const cycle = seconds/.7, phase = cycle-Math.floor(cycle);
    const progress = Math.min(1,phase/.28), ease = progress*progress*(3-2*progress), rotation = (Math.floor(cycle)+ease)*TAU/24;
    escape.rotation.z = escapeBack.rotation.z = rotation;
    middle.rotation.z = -1.5*rotation+Math.PI/24; main.rotation.z = -.5*middle.rotation.z+Math.PI/48;
    fork.rotation.z = .135*Math.sin(seconds*TAU/1.4);
    pendula[0].rotation.z = .175*Math.sin(seconds*TAU/1.4);
    pendula[1].rotation.z = -.175*Math.sin(seconds*TAU/1.4);
    return phase < .28 ? '放行一齿，齿轮前进' : '锁止停歇，双摆往复';
  };
  return model;
}

function makePlanetary() {
  const model = { root: new THREE.Group(), layers: [], labels: [], plaque: 'PLANETARY / STUDY No. 03' };
  const r = model.root, height = 3.35, rp = 2.31, planetDistance = 1.65;
  base(model,6.3); frame(model,-2.65,2.65,5.95);
  beam(r,[-2.65,height,-.96],[2.65,height,-.96],.14,.18,M.steel);
  bearing(r,0,height,-.9); disk(r,0,height,-.02,.08,2.05,M.silver,32);
  const ringRoot = layer(model,group(r,0,height,-.02,'84T internal ring'),-.4);
  const shape = new THREE.Shape(); shape.absarc(0,0,rp+.19,0,TAU,false);
  const inner = gearOutline(84).points.map((p)=>{const length=p.length(),rad=2*rp-length;return new THREE.Vector2(p.x/length*rad,p.y/length*rad);}).reverse();
  shape.holes.push(new THREE.Path(inner)); extrude(ringRoot,shape,.21,M.steel);
  ring(ringRoot,0,0,.13,rp+.125,.022,M.gold);
  ring(ringRoot,0,0,-.14,rp+.125,.022,M.gold);
  for(let i=0;i<12;i++){const a=i*TAU/12;bolt(ringRoot,(rp+.11)*Math.cos(a),(rp+.11)*Math.sin(a),.16,.028);}
  for (const xx of [-2.65,2.65]) beam(r,[xx,height,-.1],[Math.sign(xx)*(rp+.17),height,-.1],.16,.16,M.brass);
  const sun = layer(model,group(r,0,height,0,'36T sun'),.15); gear(sun,36,M.gold,{spokes:6});
  const orbit = layer(model,group(r,0,height,0,'Three planets'),.15);
  const carrier = layer(model,group(r,0,height,.40,'Planet carrier'),.94);
  const planets=[];
  for(let i=0;i<3;i++){
    const a=i*TAU/3,x=planetDistance*Math.cos(a),y=planetDistance*Math.sin(a);
    const p=group(orbit,x,y,0);gear(p,24,M.brass);planets.push(p);
    beam(carrier,[0,0,0],[x,y,0],.13,.11,M.brass);
    disk(carrier,x,y,.075,.17,.19,M.steel);ring(carrier,x,y,.19,.105,.025,M.gold);disk(carrier,x,y,.20,.052,.10,M.ruby,24);
    disk(carrier,x,y,-.08,.052,.47,M.silver,24);
  }
  disk(carrier,0,0,0,.26,.22,M.brass); ring(carrier,0,0,.16,.2,.04,M.gold); disk(carrier,0,0,.21,.075,.09,M.ruby,24);
  const dx=Math.sqrt(1.98**2-1.4**2),ax=-dx,ay=height-1.4;
  const barrel=layer(model,spring(r,ax,ay,-.91,.98),-1.05);
  const main=layer(model,group(r,ax,ay,-.59),-.65);gear(main,48,M.brass);
  const input=layer(model,group(r,0,height,-.59),-.65);gear(input,24,M.silver);
  windKey(r,ax,ay,-.05);bearing(r,ax,ay,-1.08);
  const statics=dial(r,rp+.31,height,-.2,84);
  label(model,ringRoot,'固定内齿圈 · 84T',[70,-105]);
  label(model,sun,'太阳轮 · 36T',[-25,-45]);
  label(model,planets[0],'行星轮 · 24T',[20,30]);
  label(model,carrier,'三臂行星架',[50,50]);
  const phaseA=((48+24)*Math.atan2(1.4,dx)+24*Math.PI-Math.PI)/48;
  model.update=(seconds)=>{
    const angle=seconds*TAU/3,carrierAngle=angle*.3;
    sun.rotation.z=input.rotation.z=angle;main.rotation.z=-angle*.5+phaseA;
    carrier.rotation.z=orbit.rotation.z=carrierAngle;
    for(const p of planets)p.rotation.z=-1.5*(angle-carrierAngle)+Math.PI/24;
    return '行星轮自转，同时绕太阳轮公转';
  };
  return model;
}

const designs = {
  geneva: { make: makeGeneva, code:'STUDY 01 / GENEVA', name:'六瓣星轮', description:'连续转动的拨盘，将运动分成六次停走。后层日月轮持续转动，前层星轮缓缓分度。', parts:[['开放发条盒','螺旋弹簧与上弦钥匙'],['双层齿轮传动','48 / 24 / 36 → 18 / 72 齿'],['六槽日内瓦机构','销钉、径向槽与凹弧锁止面'],['日月指针与刻度环','连续显示，与间歇运动并置']], featureLabel:'每次分度',featureValue:'60°',featureNote:'拨盘每圈：120° 拨动，240° 停歇。' },
  pendulum: { make:makePendulum, code:'STUDY 02 / ESCAPEMENT',name:'双摆擒纵',description:'齿轮走一步，擒纵叉锁一次。双摆反向往复，让机械的节律直接成为作品。',parts:[['发条与前层齿轮','储能结构与连续传动轴'],['擒纵轮与托瓦','红宝石托瓦、步进齿轮'],['两组摆杆与配重','反相摆动，银色长杆'],['开放轴承与框架','上横梁固定摆轴与叉轴']],featureLabel:'放行节律',featureValue:'一齿 · 一锁',featureNote:'擒纵动作是节律示意，尚未求解托瓦接触与摆长。' },
  planetary: { make:makePlanetary,code:'STUDY 03 / PLANETARY',name:'行星差速',description:'三个行星轮一边自转，一边绕中心公转。拆开行星架，能直接看见内外齿轮的啮合关系。',parts:[['太阳轮','36 齿 · 连续输入'],['三枚行星轮','24 齿 · 同时自转与公转'],['固定内齿圈','84 齿 · 内啮合'],['三臂行星架','承载行星轴，输出减速运动']],featureLabel:'太阳轮 : 行星架',featureValue:'1 : 0.30',featureNote:'当前固定内齿圈，行星架转速为输入的 30%。' }
};

function selectModel(id) {
  if (!designs[id]) return;
  state.model=id;state.time=0;
  if (!models.has(id)) { const m=designs[id].make();scene.add(m.root);models.set(id,m); }
  for (const [key,m] of models)m.root.visible=key===id;
  current=models.get(id);const design=designs[id];
  $('model-name').textContent=design.name;$('model-code').textContent=design.code;$('model-description').textContent=design.description;
  $('feature-label').textContent=design.featureLabel;$('feature-value').textContent=design.featureValue;$('feature-note').textContent=design.featureNote;
  $('parts').replaceChildren(...design.parts.map(([name,note])=>{const li=document.createElement('li');li.append(name);const span=document.createElement('span');span.textContent=note;li.append(span);return li;}));
  document.querySelectorAll('[data-model]').forEach((b)=>{const selected=b.dataset.model===id;b.classList.toggle('selected',selected);b.setAttribute('aria-selected',String(selected));});
  $('design-panel').setAttribute('aria-labelledby',`tab-${id}`);
  $('labels').replaceChildren(...current.labels.map((l)=>{l.element=document.createElement('span');l.element.className='part-label';l.element.textContent=l.caption;return l.element;}));
  current.update(0);resize();
}
function resize() {
  if (!renderer)return;
  const {width,height}=viewport.getBoundingClientRect(),aspect=width/height,halfHeight=Math.max(3.65,3.7/aspect);
  camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();
  renderer.setSize(width,height);renderer.setPixelRatio(Math.min(devicePixelRatio,2));
}
function updateLabels() {
  const width=viewport.clientWidth,height=viewport.clientHeight;
  for(let i=0;i<current.labels.length;i++){
    const l=current.labels[i],v=l.object.localToWorld(l.point.clone()).project(camera);
    l.element.hidden=!state.labels || (width<440&&i>1) || v.z>1 || v.z< -1;
    const x=Math.max(65,Math.min(width-65,(v.x*.5+.5)*width+l.offset[0])),y=Math.max(55,Math.min(height-35,(-v.y*.5+.5)*height+l.offset[1]));
    l.element.style.left=`${x}px`;l.element.style.top=`${y}px`;
  }
}
function setPlayback() {
  $('play').textContent=state.playing?'暂停':'播放';$('play').setAttribute('aria-pressed',String(state.playing));
  $('motion-state').textContent=state.playing?'运行中':'已暂停';
  document.querySelector('.live-indicator i').style.background=state.playing?'#6d8560':'#b79b74';
}
function preset(kind) {
  const destination=kind==='front'?new THREE.Vector3(0,2.94,13):new THREE.Vector3(6.2,4.8,12.5);
  cameraTransition={from:camera.position.clone(),to:destination,started:performance.now()};
  $('front-view').setAttribute('aria-pressed',String(kind==='front'));$('angle-view').setAttribute('aria-pressed',String(kind!=='front'));
}
function init() {
  scene=new THREE.Scene();
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  viewport.insertBefore(renderer.domElement,$('labels'));
  renderer.domElement.setAttribute('aria-label','可拖动查看的机械三维模型');
  const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();
  scene.environment=pmrem.fromScene(room,.035).texture;scene.environmentIntensity=.65;room.dispose();pmrem.dispose();
  camera=new THREE.OrthographicCamera(-5,5,3.7,-3.7,.1,100);camera.position.set(6.2,4.8,12.5);
  controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,2.94,0);controls.enableDamping=true;controls.dampingFactor=.075;
  controls.enablePan=false;controls.minZoom=.55;controls.maxZoom=2.1;controls.minPolarAngle=.4;controls.maxPolarAngle=Math.PI*.68;
  controls.addEventListener('start',()=>{cameraTransition=null;$('front-view').setAttribute('aria-pressed','false');$('angle-view').setAttribute('aria-pressed','false');});controls.update();
  const ambient=new THREE.HemisphereLight('#fff9e8','#b8afa0',2.0);scene.add(ambient);
  const key=new THREE.DirectionalLight('#fff0ce',4.2);key.position.set(-3,7,6);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-5,right:5,top:7,bottom:-3,near:.1,far:25});key.shadow.normalBias=.035;scene.add(key);scene.add(key.target);
  const rim=new THREE.DirectionalLight('#dbe9ef',3.1);rim.position.set(5,5,-5);scene.add(rim);
  const fill=new THREE.DirectionalLight('#fff6db',1.6);fill.position.set(-5,3,-3);scene.add(fill);
  const floor=mesh(scene,new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({color:'#595543',opacity:.19}),0,-.01,0);floor.rotation.x=-Math.PI/2;floor.castShadow=false;
  selectModel('geneva');$('loading').textContent='';setPlayback();
  new ResizeObserver(resize).observe(viewport);
  let previous=performance.now(),lastStatus='';
  renderer.setAnimationLoop((now)=>{
    const delta=Math.min(.06,(now-previous)/1000);previous=now;
    if(state.playing)state.time+=delta*state.speed;
    state.explode+=(state.explodeTarget-state.explode)*Math.min(1,delta*5);
    for(const l of current.layers)l.object.position.z=l.z+l.amount*state.explode;
    const status=current.update(state.time);
    if(status!==lastStatus){$('motion-state').textContent=state.playing?status:'已暂停';lastStatus=status;}
    if(cameraTransition){const t=Math.min(1,(now-cameraTransition.started)/500),ease=t*t*(3-2*t);camera.position.lerpVectors(cameraTransition.from,cameraTransition.to,ease);if(t===1)cameraTransition=null;}
    controls.update();scene.updateMatrixWorld();updateLabels();renderer.render(scene,camera);
  });
}

document.querySelectorAll('[data-model]').forEach((b)=>b.addEventListener('click',()=>selectModel(b.dataset.model)));
document.querySelector('.design-tabs').addEventListener('keydown',(e)=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const ids=Object.keys(designs),offset=['ArrowLeft','ArrowUp'].includes(e.key)?-1:1,id=ids[(ids.indexOf(state.model)+offset+ids.length)%ids.length];selectModel(id);$(`tab-${id}`).focus();});
$('play').addEventListener('click',()=>{state.playing=!state.playing;setPlayback();});
$('wind').addEventListener('click',()=>{state.time+=2;current.update(state.time);});
$('speed').addEventListener('input',(e)=>{state.speed=Number(e.target.value);$('speed-value').value=`${state.speed.toFixed(2)}×`;});
$('explode').addEventListener('click',()=>{state.explodeTarget=1-state.explodeTarget;$('explode').setAttribute('aria-pressed',String(Boolean(state.explodeTarget)));$('explode').textContent=state.explodeTarget?'合上结构':'拆开看结构';});
$('show-labels').addEventListener('click',()=>{state.labels=!state.labels;$('show-labels').setAttribute('aria-pressed',String(state.labels));});
$('front-view').addEventListener('click',()=>preset('front'));$('angle-view').addEventListener('click',()=>preset('angle'));
try{init();}catch(error){console.error(error);$('loading').textContent='三维预览暂未加载，请刷新页面重试。';document.querySelectorAll('.playback button,.camera-controls button,[data-model]').forEach((b)=>b.disabled=true);}
