<template>
  <q-page class="flex flex-center" style="padding-top: 1em;">

    <div class="column">
    <canvas id="c_numbers"></canvas>
    <canvas id="c" @click="handleClick($event.offsetY / $event.target.height, $event.offsetX / $event.target.width)"
      @mouseleave="mouseOver(undefined, undefined)"
      @mouseover="mouseOver($event.offsetY / $event.target.height, $event.offsetX / $event.target.width)"
      @mousemove="mouseOver($event.offsetY / $event.target.height, $event.offsetX / $event.target.width)"
      @wheel="canvasWheel($event)"
    ></canvas>
    <span style="">&nbsp; {{ tooltip }}</span>
    <q-select
        filled v-model="clickMode" label="Click mode"
        map-options emit-value
        :options="[ 'Add', 'Skip color' ]"
        behavior="menu"/>
    </div>

    <q-btn round color="primary" icon="add_circle" @click="$event => addInternal(undefined)"/>

    <div class="column" v-for="data, i in internalData" :key="data">
      <q-badge color="secondary" style="margin-bottom: 0.2em;">
        {{ i == 0 ? 'Start' : (i == internalData.length - 1 ? 'End' : 'Internal ' + i) }} :

      &nbsp;
      <PositionAdjust v-model="internalData[i]" :max="scanlinesRef" />
      </q-badge>
      <InternalColor v-model="internalData[i]" :max="scanlinesRef"/>

      <q-btn @click="removeInternal(i)" :disable="internalData.length <= 2">del</q-btn>

      <!-- {{ data.color }} {{ data.position }}
      {{ data.start }} {{ data.end }} -->
    </div>

    <div>
      <q-input filled v-model.number="quantize" label="Step Size" type="number" min="1"
    :rules="[
      (val) => (val && val > 0) || 'Must be 1 or larger',
      (val) => (val && Math.round(val) === val) || 'Must be integer',
      ]"
    />
    <q-input filled v-model.number="quantizeStart" label="Step Offset" type="number"
    :rules="[
      (val) => (Math.round(val) === val) || 'Must be integer',
      ]"
    />
    <q-btn color="white" text-color="black" label="Download .png" @click="downloadGradient" />
    <br/>
    <br/>

    <div><q-select
        style="width: 200px"
        filled v-model="selectedGradientType" label="Gradient number"
        map-options emit-value
        :options="[ 'RGB (naive)', 'RGB gamma corrected', 'LAB', 'Linear RGB interpolation', 'HSV', 'HSV (reverse)' ].map((o, i) => { return {label: (i + 1) + ' ' + o, value: i + ''}})"
        behavior="menu"/>
      </div>
    <div><q-btn color="white" text-color="black" label="Copy BG Code" @click="copyCode" />
      <q-btn color="white" text-color="black" label="Copy Color Code" @click="copyColorCode" />
      <q-btn color="white" v-if="scanlinesRef > 224" text-color="black" label="Copy Scrolling BG Code" @click="copyScrollingBGCode" />
      <q-btn color="white" v-if="scanlinesRef > 224" text-color="black" label="Copy Scrolling Color Code" @click="copyScrollingColorCode" />
      <q-btn color="white" v-if="scanlinesRef > 224" text-color="black" label="Copy Scrolling Dual Color Code" @click="copyScrollingDualColorCode" />
    </div>
  </div>
</q-page>
</template>

<script>
import { defineComponent, ref, watch } from 'vue'
import { Notify, useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import InternalColor from 'components/InternalColor.vue'
import PositionAdjust from 'components/PositionAdjust.vue'
import chroma from 'chroma-js'

import download from 'downloadjs';
// import { number } from 'yargs';

const internalData = ref([
//{color: 'f66363', start: 0, end: scanlines, position:0 },
//{color: '3b8edb', start: 0, end: scanlines, position:scanlines },
])
const selectedGradientType = ref(1)
const quantize = ref(1)
const quantizeStart = ref(1)
const tooltip = ref('')
const clickMode = ref('Add')

watch([internalData], (old, new_) => {
  const a = internalData.value;
  var maxPosition = 0;
  if (a.length) {
    a[0].position = maxPosition = Math.max(maxPosition, a[0].position);
    a[0].start = 0
    a[a.length-1].end = scanlines
  }
  for (var i = 0; i < a.length - 1; i++) {
    a[i+1].position = maxPosition = Math.max(maxPosition, a[i+1].position);
    a[i].end = a[i+1].position;
    a[i+1].start = a[i].position;
  }

}, {deep: true})
watch([internalData, quantize, quantizeStart], draw, {deep: true});


var gradients;
var roundedGradients;
var canvas;
var canvasZoom = ref(2);
var ctx;
var scanlines = 224;
var scanlinesRef = ref(224);
const countGradients = 6;

watch([canvasZoom, scanlinesRef], function () {
  if (canvas) {
    canvas.height = scanlinesRef.value * canvasZoom.value;
    draw();
  }
});

var mounted = function() {
  canvas = document.getElementById("c");
  ctx = canvas.getContext("2d");
  canvas.width = 240 - (240 % countGradients);
  canvas.height = scanlines * canvasZoom.value;
  draw();

  const numbers = document.getElementById('c_numbers');
  numbers.width = canvas.width;
  numbers.height = 20;
  const numberContext = numbers.getContext("2d");
  // numberContext.fillStyle = 'rgb(100, 100, 100)';
  ctx.font = "48px serif";
  const textMetrics = ctx.measureText("12345");
  numbers.height = textMetrics.fontBoundingBoxAscent + 5;
  for (var i = 0; i < countGradients; i++) {
    numberContext.fillText(i + 1, 10 + numbers.width * i / countGradients, textMetrics.fontBoundingBoxAscent);
  }
};

function parseColor(input) {
  var m = input.match(/^([0-9a-f]{6})$/i)[1];
    if (m) {
        return [
            parseInt(m.substr(0,2),16),
            parseInt(m.substr(2,2),16),
            parseInt(m.substr(4,2),16)
        ];
    };
}

// input: h in [0,360] and s,v in [0,1] - output: r,g,b in [0,1]
function hsv2rgb(h,s,v)
{
  let f= (n,k=(n+h/60)%6) => v - v*s*Math.max( Math.min(k,4-k,1), 0);
  return [f(5),f(3),f(1)];
}
//https://stackoverflow.com/questions/8022885/rgb-to-hsv-color-in-javascript
// input: r,g,b in [0,1], out: h in [0,360) and s,v in [0,1]
function rgb2hsv(r,g,b) {
  let v=Math.max(r,g,b), c=v-Math.min(r,g,b);
  let h= c && ((v==r) ? (g-b)/c : ((v==g) ? 2+(b-r)/c : 4+(r-g)/c));
  return [60*(h<0?h+6:h), v&&c/v, v];
}


// https://stackoverflow.com/questions/22607043/color-gradient-algorithm
function to_sRGB_f(x) {
    //return 12.92*x if x <= 0.0031308 else (1.055 * (x ** (1/2.4))) - 0.055
    return x <= 0.0031308 ? 12.92*x  : (1.055 * (x ** (1/2.4))) - 0.055
}

function to_sRGB(x) {
    return Math.floor(255.9999 * to_sRGB_f(x))
}

function from_sRGB(x) {
    x /= 255.0
    var y;
    if (x <= 0.04045)
        y = x / 12.92
    else
        y = ((x + 0.055) / 1.055) ** 2.4
    return y
}

function lerp(color1, color2, frac) {
    return color1 * (1 - frac) + color2 * frac
}


function draw() {
  if (!ctx || internalData.value.length < 2)
    return;
//ctx.fillStyle = `rgba(${topColor.value}, 1)`
const t = parseColor(internalData.value[0].color);
const b = parseColor(internalData.value[internalData.value.length-1].color);

const start = internalData.value[0].position;
const end = internalData.value[internalData.value.length-1].position;
gradients = Array(countGradients).fill(1).map(() => []);

var i;
for (i = 0; i < start; i++) {
  gradients.forEach(g => g.push(t));
}


function doGradient(t, b, start, end) {
  var i;
function mix(t, b, index) {
  const scanlines2 = scanlines - start - (scanlines - end)
  if (t[index] == b[index]) {
    return t[index];
  }
  return t[index] * ((scanlines2-i)/scanlines2) + b[index] * (i/scanlines2) // + 0.0001;
}
function mix3(t, b) {
  return [0, 1, 2].map((v, index) => mix(t, b, index));
}

// naive rgb
function mixrgb(index) {
  var ret = mix(t, b, index);
  return ret;
}

// HSV
const topHSV = rgb2hsv.apply(null, t.map((v) => v/255));
const bottomHSV = rgb2hsv.apply(null, b.map((v) => v/255));
function mixhsv(index) {
  return mix(topHSV, bottomHSV, index);
}

const topLAB = RGBtoLAB(t);
const bottomLAB = RGBtoLAB(b);


// Mark method
const gamma = .43
const color1_lin = t.map(from_sRGB);
const bright1 = color1_lin.reduce((a,b)=>a+b)**gamma;
const color2_lin = b.map(from_sRGB);
const bright2 = color2_lin.reduce((a,b)=>a+b)**gamma;


const lrgb = chroma.scale([t, b]).mode('lrgb').domain([0, scanlines - start - (scanlines - end) - 1]);

// const [gradient_rgb, gradient_rgb_y, gradient_hsv, gradient_hsv_r, gradient_lab, gradient_rgb_lin] = gradients;

const [gradient_rgb, gradient_rgb_y, gradient_lab, gradient_rgb_lin, gradient_hsv, gradient_hsv_r] = gradients;

for (i = 0; i < scanlines - start - (scanlines - end); i++) {
  gradient_rgb.push([mixrgb(0), mixrgb(1), mixrgb(2)]);

// Mark method
    // intensity = lerp(bright1, bright2, step, steps) ** (1/gamma)
  var intensity = mix([bright1], [bright2], 0) ** (1/gamma);
    // color = lerp(color1_lin, color2_lin, step, steps)
  var color = [0,1,2].map(i => mix(color1_lin, color2_lin, i))
  var sum = color.reduce((a,b)=>a+b);
  //if sum(color) != 0:
  //   color = [c * intensity / sum(color) for c in color]
  if (sum != 0) {
    color = color.map(c => c * intensity / sum);
  }
  color = color.map(c => Math.min(1, c));
  color = color.map(c => Math.max(0, c));
  color = color.map(to_sRGB);
  gradient_rgb_y.push([color[0], color[1], color[2]]);


  gradient_hsv.push(hsv2rgb.apply(null, [0, 1, 2].map(mixhsv)).map(v => v * 255));

  var hsvReverse = [0, 1, 2].map(mixhsv);
  if (topHSV[0] > bottomHSV[0]) {
    hsvReverse[0] = mix([topHSV[0]], [bottomHSV[0]+360], 0);
  } else {
    hsvReverse[0] = mix([topHSV[0] + 360], [bottomHSV[0]], 0);
  }
  hsvReverse[0] = (hsvReverse[0] + 720) % 360;

  gradient_hsv_r.push(hsv2rgb.apply(null, hsvReverse).map(v => v * 255));

  // make gradients[2] have shortest distance between hues
  if (Math.abs(topHSV[0] - bottomHSV[0]) > 180) {
    const [t2, t3] = [gradient_hsv_r.pop(), gradient_hsv.pop()]
    gradient_hsv_r.push(t3);
    gradient_hsv.push(t2);
  }
  //ctx.fillRect(canvas.width*2/4, i, canvas.width*3/4, i+1);


  gradient_lab.push(LABtoRGB(mix3(topLAB, bottomLAB, i)));
  var ret = gradient_lab.slice(-1)[0]
  if (ret[0] > 255 || ret[1] > 255 || ret[2] > 255) {
   // console.log(ret)
  }

  gradient_rgb_lin.push(lrgb(i).rgb());

}
}
for (i = 0; i < internalData.value.length - 1; i++) {
  //doGradient(t, b, start, end);
  doGradient(parseColor(internalData.value[i].color), parseColor(internalData.value[i+1].color),
    internalData.value[i].position, internalData.value[i+1].position);
}

for (i = 0; i < scanlines - end; i++) {
  gradients.forEach(g => g.push(b));
}

// round to nearest 5bit color
// [(i, (i>>3)*8, (i >> 3) *8 + (i>>5)) for i in range(238, 255)]
roundedGradients = gradients.map(gradient => {
  return gradient.map(entry => {
    return entry.map(color => {
      return (color >> 3) * 8 + (color >> 5);
    });
  });
});

if (quantize.value) {
  roundedGradients = roundedGradients.map(gradient => {
  return gradient.map((entry, i) => {
    // console.log(`${i}   ${Math.max(0, i - (i % quantize.value) - quantizeStart.value)}`);
    return gradient[Math.max(0, i - ((i - quantizeStart.value) % quantize.value))];
  });
});
}

var ncols = gradients.length;
var currentCol = 0;
ctx.clearRect(0, 0, canvas.width, canvas.height);
function fillColumn(currentCol) {
  // ctx.fillRect(canvas.width * (currentCol/ncols), i, canvas.width * ((currentCol+1)/ncols), i+1);
  ctx.fillRect(canvas.width * (currentCol/ncols), i, canvas.width * (1/ncols), 1);
  currentCol = (currentCol + 1) % ncols;
}
for (i = 0; i < canvas.height; i++) {
  roundedGradients.forEach((g, j) => {
    ctx.fillStyle = 'rgb(' + g[Math.floor(i/ (canvas.height/scanlines))] + ')';

    //ctx.fillRect(canvas.width/4, i, canvas.width*2/4, i+1);
    fillColumn(j);
  }
  );
}
};

function downloadGradient() {
  download(canvas.toDataURL('image/png'), 'gradient.png');
}

function mouseOver(scanline, gradientIndex) {
  if (scanline !== undefined) {
    gradientIndex = Math.floor(gradients.length * gradientIndex);
    gradientIndex = Math.min(gradientIndex, gradients.length - 1);
    scanline = Math.floor(scanlines * scanline);
    scanline = Math.min(scanline, gradients[gradientIndex].length - 1);
    var colorTriple = gradients[gradientIndex][scanline];
    var color = formatTriple(colorTriple);
    var snesColor = formatTriple(colorTriple.map(color => (color >> 3) * 8 + (color >> 5)));
    tooltip.value = `${scanline}: ${color}  (SNES: ${snesColor}) `
  } else {
    tooltip.value = '';
  }
}

function removeInternal(i) {
  internalData.value.splice(i, 1);
}

function formatTriple(ar) {
  return ar.map(v => (v>>0).toString(16).padStart(2, '0')).join('')
}

function canvasWheel(event) {
  if (event.deltaY) {
    canvasZoom.value = canvasZoom.value + (event.deltaY > 0 ? 1 : -1);
    canvasZoom.value = Math.max(1, canvasZoom.value);
    event.preventDefault();
    event.stopPropagation();
  }
}

function handleClick(scanline, gradientIndex) {
  var mode = clickMode.value || 'Add';
  if (mode === 'Add') {
    addInternal(scanline, gradientIndex);
  } else {
    gradientIndex = Math.floor(gradients.length * gradientIndex);
    gradientIndex = Math.min(gradientIndex, gradients.length - 1);
    scanline = Math.floor(scanlines * scanline);
    scanline = Math.min(scanline, gradients[gradientIndex].length - 1);
    const gradient = gradients[gradientIndex];
    const roundedGradient = roundedGradients[gradientIndex];
    var roundedColor = formatTriple(roundedGradient[scanline]);
    // last index of previous color
    var startIndex = roundedGradient.findIndex(v => formatTriple(v) === roundedColor) - 1;
    // first index of next color
    var endIndex = scanline + roundedGradient.slice(scanline).findIndex(v => formatTriple(v) !== roundedColor);
    if (startIndex === -1 || endIndex - scanline === -1) {
      return;
    }
    const targetScanline = Math.floor(startIndex + (endIndex - startIndex) / 2);

    // delete internalData entries with .position in [startIndex, endIndex]
    var i;
    while (true) {
      i = internalData.value.findIndex(d => d.position >= startIndex && d.position <= endIndex);
      if (i === -1) {
        break;
      }
      internalData.value.splice(i, 1);
    }

    // find where to insert new internalData entries
    for (i = 0; i < internalData.value.length; i++) {
      if (internalData.value[i].position > targetScanline) {
        break;
      }
    }
    i = Math.max(0, i);
    internalData.value.splice(i, 0,
      {color: formatTriple(gradient[startIndex]), start: 0, end: scanlines, position: startIndex },
      {color: formatTriple(gradient[startIndex]), start: 0, end: scanlines, position: targetScanline },
      {color: formatTriple(gradient[endIndex]), start: 0, end: scanlines, position: targetScanline + 1 },
      {color: formatTriple(gradient[endIndex]), start: 0, end: scanlines, position: endIndex }
    );
    // FIXME delete 3 consecutive entries with same color
  }
}

function addInternal(scanline, gradientIndex) {
  if (scanline === undefined) {
    scanline = Math.floor(scanlines / 2);
    gradientIndex = 1;
  } else {
    gradientIndex = Math.floor(gradients.length * gradientIndex);
    gradientIndex = Math.min(gradientIndex, gradients.length - 1);
    scanline = Math.floor(scanlines * scanline);
    scanline = Math.min(scanline, gradients[gradientIndex].length - 1);
  }
  var colorTriple = gradients[gradientIndex][scanline];
  var color = formatTriple(colorTriple);
  var i;
  for (i = 0; i < internalData.value.length; i++) {
    if (internalData.value[i].position > scanline) {
      break;
    }
  }
  i = Math.max(0, i);
  internalData.value.splice(i, 0,
    {color, start: 0, end: scanlines, position: scanline }
  );

}


function convertToCountAndColors(gradient) {
  var prevColor = undefined;
  var ret = [];

  var arrEqual = (array1, array2) => array1.length === array2.length && array1.every((value, index) => value === array2[index])

  for (var i = 0; i < gradient.length; i++) {
    if (i > 0 && arrEqual(prevColor, gradient[i])) {
      ret[ret.length-1][0]++;
    } else {
      ret.push([1, ...gradient[i]]);
      prevColor = gradient[i];
    }
  }
  return ret;
}

function RGB2PaletteColor(rgb) {
  const shifts = [0, 5, 10];
  return rgb.map((color, ind) => {
    return (color >> 3) << shifts[ind];
  }).reduce((x, y) => x + y)
}

function copyColorCode() {
  function genColorTable(countAndColors) {
  var table = '';
  countAndColors.forEach((e, index) => {
    var count = e[0];
    do {
      if (index == countAndColors.length - 1) {
        table += 'db  1';
        count = 0;
      } else {
        table += `db ${Math.min(count, 0x7F).toString().padStart(2, ' ')}`;
      }
      table += ' : db 0, !destination_color'
      const snesColor = RGB2PaletteColor(e.slice(1));
      table += ` : dw $${snesColor.toString(16)}`;
      table += '\n'
      count -= 0x7F;
    } while (count > 0)
  });
  return table;
}

const gradient = roundedGradients[selectedGradientType.value];
const countAndColors = convertToCountAndColors(gradient);
const table = genColorTable(countAndColors);
  var code = `
; Color gradient ${internalData.value[0].color} to ${internalData.value[internalData.value.length-1].color}
; generated from ${window.location.href}

!hdma_channel1 = 3
!destination_color = $56

!hdma_base1 #= $4300|(!hdma_channel1<<4)

init:
REP #$20
LDA #$2103  ; CGADD 2121
STA.w !hdma_base1
LDA.w #.ColorTable
STA.w !hdma_base1+2
LDY.b #.ColorTable>>16
STY.w !hdma_base1+4

SEP #$20
LDA.b #(1<<!hdma_channel1)
TSB $0D9F|!addr
RTL

.ColorTable:
${table}
db 0
`

  navigator.clipboard.writeText(code).then(function() {
    Notify.create('Copied!')
  }, function(err) {
    Notify.create('Could not copy: ' + err)
    console.error('Async: Could not copy text: ', err);
  });
}

function internalSlice(arr, ind1, ind2) {
  return arr.map(e => [e[ind1], e[ind2]]);
}

function copyCode() {
const gradient = roundedGradients[selectedGradientType.value];
const countAndColorsRG = convertToCountAndColors(internalSlice(gradient, 0, 1));
const countAndColorsRB = convertToCountAndColors(internalSlice(gradient, 0, 2));
const countAndColorsGB = convertToCountAndColors(internalSlice(gradient, 1, 2));
const pairs = [countAndColorsRG, countAndColorsRB, countAndColorsGB];

const minCombined = Math.min(...pairs.map(a => a.length));
const minIndex = pairs.findIndex(a => a.length === minCombined);

const singleIndex = {
  0: 2,
  1: 1,
  2: 0
}[minIndex];

const single = convertToCountAndColors(gradient.map(e => [e[singleIndex]]));

function genBGTable(countAndColors, mask) {
  var table = '';
  countAndColors.forEach((e, index) => {
    var count = e[0];
    do {
      if (index == countAndColors.length - 1) {
        table += 'db 1';
        count = 0;
      } else {
        table += `db ${Math.min(count, 0x7F)}`;
      }
      e.slice(1).forEach((color, ind) => {
        table += ` : db $${((color >> 3)|mask[ind]).toString(16)}`
      })
      table += '\n'
      count -= 0x7F;
    } while (count > 0)
  });
  return table;
}

// bgrccccc
const singleTable = genBGTable(single,
[[0x20, 0x40, 0x80][singleIndex]]
);

const doubleTable = genBGTable(pairs[minIndex],
[
  [0x20, 0x40],
  [0x20, 0x80],
  [0x40, 0x80],
][minIndex]);

  var code = `
; Background gradient ${internalData.value[0].color} to ${internalData.value[internalData.value.length-1].color}
; generated from ${window.location.href}

!hdma_channel1 = 3
!hdma_channel2 = 4

!hdma_base1 #= $4300|(!hdma_channel1<<4)
!hdma_base2 #= $4300|(!hdma_channel2<<4)

init:
REP #$20
LDA #$3206
STA.w !hdma_base1
LDA.w #.DoubleTable
STA.w !hdma_base1+2
LDY.b #.DoubleTable>>16
STY.w !hdma_base1+4
LDA #$3200
STA.w !hdma_base2
LDA.w #.SingleTable
STA.w !hdma_base2+2
LDY.b #.SingleTable>>16
STY.w !hdma_base2+4

SEP #$20
LDA.b #(1<<!hdma_channel1)|(1<<!hdma_channel2)
TSB $0D9F|!addr
RTL

.DoubleTable:
${doubleTable}
db 0

.SingleTable:
${singleTable}
db 0
`

  navigator.clipboard.writeText(code).then(function() {
    Notify.create('Copied!')
  }, function(err) {
    Notify.create('Could not copy: ' + err)
    console.error('Async: Could not copy text: ', err);
  });
}

function copyScrollingDualColorCode() {
  function genColorTable(colors) {
  var table = '';
  colors.forEach((color, index) => {
    const snesColor = RGB2PaletteColor(color);
    table += `dw $${snesColor.toString(16)}`;
    table += '\n'
  });
  return table;
}

const gradient = roundedGradients[selectedGradientType.value];
const table = genColorTable(gradient);
  var code = `
; Scrolling dual color gradient ${internalData.value[0].color} to ${internalData.value[internalData.value.length-1].color}
; generated from ${window.location.href}

!FreeRAM = $7FC3E0 ; 12 bytes

!hdma_channel1 = 3
!hdma_channel2 = 4 ; should be the next one, or have no color hdmas between them
!hdma_channel3 = 5 ; should be the next one, or have no color hdmas between them

!destination_color1 = $43
; destination_color2 is the next one

; layer to scroll compared to
!Layer = 1
; higher values scroll more slowly
!ScrollFactor = 0

!Overworld = 1

; number of scanlines 2nd color will be ahead of 1st
!Offset = 3

; end of configuration

!hdma_base1 #= $4300|(!hdma_channel1<<4)
!hdma_base2 #= $4300|(!hdma_channel2<<4)
!hdma_base3 #= $4300|(!hdma_channel3<<4)

CGADDTable:
db $F0
!i #= 0
while !i < $70
db !destination_color1
!i #= !i+1
endif
db $F0
!i #= 0
while !i < $70
db !destination_color1
!i #= !i+1
endif

init:

LDA.b #(1<<!hdma_channel1)|(1<<!hdma_channel2)|(1<<!hdma_channel3)
TSB $0D9F|!addr

LDA #$F0
STA !FreeRAM
STA !FreeRAM+3
STA !FreeRAM+6
STA !FreeRAM+9

REP #$20
LDA #$2100 ; CGADD 2121
STA.w !hdma_base1
LDA.w #CGADDTable
STA.w !hdma_base1+2
LDY.b #CGADDTable>>16
STY.w !hdma_base1+4

LDA #$2242 ; CGDATA 2122; indirect, one register write twice
STA.w !hdma_base2
STA.w !hdma_base3

LDA.w #!FreeRAM
STA.w !hdma_base2+2
LDA.w #!FreeRAM+6
STA.w !hdma_base3+2

LDY.b #!FreeRAM>>16
STY.w !hdma_base2+4
STY.w !hdma_base3+4

LDY.b #ColorTable>>16
STY.w !hdma_base2+7
STY.w !hdma_base3+7

; RTL fallthrough

end:
REP #$31
LDA.b $1C+((!Layer-1)*2)
if !Overworld
; CLC
ADC.w #$0028 ; overworld goes negative
endif
LSR #!ScrollFactor
; CLC
ASL
; CLC
ADC.w #ColorTable
; it is possible that hdma runs in between the RAM writes and gets a bogus value
STA !FreeRAM+1
ADC.w #!Offset*2
STA !FreeRAM+1+6
ADC.w #($70*2)-(!Offset*2)
STA !FreeRAM+1+3
ADC.w #!Offset*2
STA !FreeRAM+1+9
SEP #$30
RTL

ColorTable:
${table}
`

  navigator.clipboard.writeText(code).then(function() {
    Notify.create('Copied!')
  }, function(err) {
    Notify.create('Could not copy: ' + err)
    console.error('Async: Could not copy text: ', err);
  });
}

function copyScrollingColorCode() {
  function genColorTable(colors) {
  var table = '';
  colors.forEach((color, index) => {
    table += 'db 1';
    table += ' : db 0, !destination_color'
    const snesColor = RGB2PaletteColor(color);
    table += ` : dw $${snesColor.toString(16)}`;
    table += '\n'
  });
  return table;
}

const gradient = roundedGradients[selectedGradientType.value];
const table = genColorTable(gradient);
  var code = `
; Scrolling color gradient ${internalData.value[0].color} to ${internalData.value[internalData.value.length-1].color}
; generated from ${window.location.href}

!hdma_channel1 = 3
!destination_color = $44

; layer to scroll with
!Layer = 1
; higher values scroll more slowly
!ScrollFactor = 0
!Overworld = 0

; end of configuration

!hdma_base1 #= $4300|(!hdma_channel1<<4)

init:
LDA.b #(1<<!hdma_channel1)
TSB $0D9F|!addr

REP #$20
LDA #$2103  ; CGADD 2121
STA.w !hdma_base1
;LDA.w #ColorTable
;STA.w !hdma_base1+2
LDY.b #ColorTable>>16
STY.w !hdma_base1+4

; SEP #$20
; RTL fallthrough

end:
REP #$21
LDA.b $1C+((!Layer-1)*2)
if !Overworld
; CLC
ADC.w #$0028 ; overworld goes negative
endif
LSR #!ScrollFactor
STA $00
ASL
ASL
; CLC
ADC $00
; CLC
ADC #ColorTable
; if the game is lagging, it is possible that hdma init runs in between the RAM writes and gets a bogus value
STA.w !hdma_base1+2
SEP #$20
RTL

ColorTable:
${table}
db 0
`

  navigator.clipboard.writeText(code).then(function() {
    Notify.create('Copied!')
  }, function(err) {
    Notify.create('Could not copy: ' + err)
    console.error('Async: Could not copy text: ', err);
  });
}


function copyScrollingBGCode() {
const gradient = roundedGradients[selectedGradientType.value];
const gradientRG = internalSlice(gradient, 0, 1)
const gradientB = gradient.map(e => [e[2]]);


function genScrollBGTable(colors, mask) {
  var table = '';
  colors.forEach((e, index) => {
    table += 'db 1';
    e.forEach((color, ind) => {
      table += ` : db $${((color >> 3)|mask[ind]).toString(16)}`
    })
    table += '\n';
  });
  return table;
}

// bgrccccc
const doubleTable = genScrollBGTable(gradientRG, [0x20, 0x40]);
const singleTable = genScrollBGTable(gradientB, [0x80]);

var code = `
; Scrolling background gradient ${internalData.value[0].color} to ${internalData.value[internalData.value.length-1].color}
; generated from ${window.location.href}
!hdma_channel1 = 3
!hdma_channel2 = 4

; Layer to scroll with
!Layer = 1
; Higher values scroll more slowly
!ScrollFactor = 0
; Set to 1 if used on the overworld
!Overworld = 0

; end of configuration

!hdma_base1 #= $4300|(!hdma_channel1<<4)
!hdma_base2 #= $4300|(!hdma_channel2<<4)

init:
REP #$20
LDA #$3206
STA.w !hdma_base1
;LDA.w #DoubleTable
;STA.w !hdma_base1+2
LDY.b #DoubleTable>>16
STY.w !hdma_base1+4
LDA #$3200
STA.w !hdma_base2
;LDA.w #SingleTable
;STA.w !hdma_base2+2
LDY.b #SingleTable>>16
STY.w !hdma_base2+4

SEP #$20
LDA.b #(1<<!hdma_channel1)|(1<<!hdma_channel2)
TSB $0D9F|!addr
; RTL fallthrough

end:
REP #$31
LDA.b $1C+((!Layer-1)*2)
if !Overworld
; CLC
ADC.w #$0028 ; overworld goes negative
endif
LSR #!ScrollFactor
STA $00
ASL
; CLC
ADC $00
; CLC
ADC #DoubleTable
; if the game is lagging, it is possible that snes hdma init runs in between the RAM writes and gets a bogus value
STA.w !hdma_base1+2

LDA.b $1C+((!Layer-1)*2)
if !Overworld
CLC
ADC.w #$0028
endif
LSR #!ScrollFactor
ASL
; CLC
ADC.w #SingleTable
STA.w !hdma_base2+2
SEP #$30
RTL

DoubleTable:
${doubleTable}
db 0

SingleTable:
${singleTable}
db 0
`

  navigator.clipboard.writeText(code).then(function() {
    Notify.create('Copied!')
  }, function(err) {
    Notify.create('Could not copy: ' + err)
    console.error('Async: Could not copy text: ', err);
  });
}

export default defineComponent({
  name: 'IndexPage',
  components: {
    InternalColor,
    PositionAdjust
  },
  mounted,
  setup: function () {

    const inHash = [internalData, selectedGradientType, scanlinesRef, quantize, quantizeStart];

    function updateValues(new_) {
      inHash[1].value = decodeURIComponent(new_[1]);
      inHash[2].value = decodeURIComponent(new_[2]);
      scanlines = parseInt(decodeURIComponent(new_[2]));
      scanlinesRef.value = parseInt(decodeURIComponent(new_[2]));
      quantize.value = parseInt(decodeURIComponent(new_[3]));
      quantizeStart.value = parseInt(decodeURIComponent(new_[4]));

      const encodedInternalData = new_[0];
      const entries = encodedInternalData.split('_');
      internalData.value = entries.map(entry => {
        const [color, position] = entry.split('-')
        return {
          color, position,
          start: 0,
          end: scanlines
        }
      });
    }

    const route = useRoute();
    watch(() => route.params.pathMatch,
      (new_, old) => {
        updateValues(new_);
      }
    )
    updateValues(route.params.pathMatch);
    const router = useRouter();

    watch(inHash, debounce(function () {
        // this scrolls the page:
        //router.push(`/v1/${topColor.value.substring(1)}/${bottomColor.value.substring(1)}`);
        // FIXME: back button is weird with this
        var hash = '/v4';
        for (var i = 0; i < inHash.length; i++) {
          var d = inHash[i].value;
          if (i == 0) {
            d = internalData.value.map(d => `${d.color}-${d.position}`).join('_')
          }
          hash += '/' + encodeURIComponent(d);
        }
        history.pushState(null, null, '#' + hash);
      }), {deep: true}
    )

    return {
      draw,
      downloadGradient,
      copyCode,
      copyColorCode,
      copyScrollingBGCode,
      copyScrollingColorCode,
      copyScrollingDualColorCode,
      selectedGradientType,
      internalData,
      addInternal,
      removeInternal,
      mouseOver,
      tooltip,
      clickMode,
      handleClick,
      canvasWheel: throttle(canvasWheel),
      scanlinesRef,
      quantize,
      quantizeStart,
    }
  }
})

function throttle(func, timeout = 300) {
  let timer;
  let done = true;
  return (...args) => {
    if (done) {
      func.apply(this, args);
      done = false;
      timer = setTimeout(() => { done = true }, timeout);
    }
  };
}

function debounce(func, timeout = 300){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}


function RGBtoLAB(rgb) {
  return chroma.rgb(rgb).lab();
  return XYZtoLAB(RGBtoXYZ(rgb));
}

function LABtoRGB(lab) {
  return chroma.lab(lab).rgb();
  return XYZtoRGB(LABtoXYZ(lab));
}

// https://stackoverflow.com/a/73998199
function RGBtoXYZ([R, G, B]) {
    const [var_R, var_G, var_B] = [R, G, B]
        .map(x => x / 255)
        .map(x => x > 0.04045
            ? Math.pow(((x + 0.055) / 1.055), 2.4)
            : x / 12.92)
        .map(x => x * 100)

    // Observer. = 2°, Illuminant = D65
    const X = var_R * 0.4124564 + var_G * 0.3575761 + var_B * 0.1804375
    const Y = var_R * 0.2126729 + var_G * 0.7151522 + var_B * 0.0721750
    const Z = var_R * 0.0193339 + var_G * 0.1191920 + var_B * 0.9503041
    return [X, Y, Z]
}

function XYZtoRGB([X, Y, Z]) {
    //X, Y and Z input refer to a D65/2° standard illuminant.
    //sR, sG and sB (standard RGB) output range = 0 ÷ 255

    let var_X = X / 100
    let var_Y = Y / 100
    let var_Z = Z / 100

    const var_R = var_X *  3.2404542 + var_Y * -1.5371385 + var_Z * -0.4985314
    const var_G = var_X * -0.9692660 + var_Y *  1.8760108 + var_Z *  0.0415560
    const var_B = var_X *  0.0556434 + var_Y * -0.2040259 + var_Z *  1.0572252

    return [var_R, var_G, var_B]
        .map(n => n > 0.0031308
            ? 1.055 * Math.pow(n, (1 / 2.4)) - 0.055
            : 12.92 * n)
        .map(n => n * 255)
}

const ref_X =  95.047;
const ref_Y = 100.000;
const ref_Z = 108.883;

function XYZtoLAB([x, y, z]) {
    const [ var_X, var_Y, var_Z ] = [ x / ref_X, y / ref_Y, z / ref_Z ]
        .map(a => a > 0.008856
            ? Math.pow(a, 1 / 3)
            : (7.787 * a) + (16 / 116))

    const CIE_L = (116 * var_Y) - 16
    const CIE_a = 500 * (var_X - var_Y)
    const CIE_b = 200 * (var_Y - var_Z)

    return [CIE_L, CIE_a, CIE_b]
}

function LABtoXYZ([l, a, b]) {

    const var_Y = (l + 16) / 116
    const var_X = a / 500 + var_Y
    const var_Z = var_Y - b / 200

    const [X, Y, Z] = [var_X, var_Y, var_Z]
        .map(n => Math.pow(n, 3) > 0.008856
            ? Math.pow(n, 3)
            : (n - 16 / 116) / 7.787)

    return [X * ref_X, Y * ref_Y, Z * ref_Z]
}
</script>
