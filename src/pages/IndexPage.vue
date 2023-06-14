<template>
  <q-page class="flex flex-center" style="padding-top: 1em;">

    <div class="column">
    <canvas id="c_numbers"></canvas>
    <canvas id="c"></canvas>
    </div>

    <q-color v-model="topColor" />
    <q-color v-model="bottomColor" />
    
    
    <div class="column">
    <q-badge color="secondary">
     Start : {{ start }}
    </q-badge>
    <q-slider v-model="start" :min="0" :max="224" :inner-max="end"/>
    <q-badge color="secondary">
     End : {{ end }}
    </q-badge>
    <q-slider v-model="end" :inner-min="start" :min="0" :max="224"/>

    <q-btn color="white" text-color="black" label="Download .png" @click="downloadGradient" />
    <br/>
    
    <div><q-select
        filled v-model="selected" label="Gradient number" 
        map-options emit-value
        :options="[ 'RGB (naive)', 'RGB gamma corrected', 'HSV', 'HSV (reverse)', 'LAB' ].map((o, i) => { return {label: (i + 1) + ' ' + o, value: i + ''}})"
        behavior="menu"/>
      </div>
    <div><q-btn color="white" text-color="black" label="Copy BG Code" @click="copyCode" />
    </div>
  </div>
</q-page>
</template>

<script>
import { defineComponent, ref, watch } from 'vue'
import { Notify, useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'

import download from 'downloadjs';
// import { number } from 'yargs';

const bottomColor = ref('#f66363')
const topColor = ref('#3b8edb')
const start = ref(0)
const end = ref(224)

var gradients;
var canvas;
var ctx;
var scanlines = 224;
const countGradients = 5;

var mounted = function() {
  canvas = document.getElementById("c");
  ctx = canvas.getContext("2d");    
  canvas.width = 200;
  canvas.height = scanlines * 2;
  draw();

  const numbers = document.getElementById('c_numbers');
  numbers.width = 200;
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
  var m = input.match(/^#([0-9a-f]{6})$/i)[1];
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
    return Math.round(255.9999 * to_sRGB_f(x))
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
  if (!ctx || !topColor.value || !bottomColor.value)
    return;
ctx.clearRect(0, 0, canvas.width, canvas.height);
//ctx.fillStyle = `rgba(${topColor.value}, 1)`
const t = parseColor(topColor.value);
const b = parseColor(bottomColor.value);

function mix(t, b, index) {
  const scanlines2 = scanlines - start.value - (scanlines - end.value)
return t[index] * ((scanlines2-i)/scanlines2) + b[index] * (i/scanlines2);
}
function mix3(t, b) {
  return [0, 1, 2].map((v, index) => mix(t, b, index));
}

// naive rgb
function mixrgb(index) {
  return mix(t, b, index);
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

var i;

gradients = Array(countGradients).fill(1).map(() => []);

for (i = 0; i < start.value; i++) {
  gradients.forEach(g => g.push(t));
}

for (i = 0; i < scanlines - start.value - (scanlines - end.value); i++) {
  gradients[0].push([mixrgb(0), mixrgb(1), mixrgb(2)]);

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
  color = color.map(to_sRGB);
  gradients[1].push([color[0], color[1], color[2]]);



  gradients[2].push(hsv2rgb.apply(null, [0, 1, 2].map(mixhsv)).map(v => v * 255));

  var hsvReverse = [0, 1, 2].map(mixhsv);
  if (topHSV[0] > bottomHSV[0]) {
    hsvReverse[0] = mix([topHSV[0]], [bottomHSV[0]+360], 0);
  } else {
    hsvReverse[0] = mix([topHSV[0] + 360], [bottomHSV[0]], 0);
  }
  hsvReverse[0] = (hsvReverse[0] + 720) % 360;

  gradients[3].push(hsv2rgb.apply(null, hsvReverse).map(v => v * 255));
  //ctx.fillRect(canvas.width*2/4, i, canvas.width*3/4, i+1);


  gradients[4].push(LABtoRGB(mix3(topLAB, bottomLAB, i)));
}

for (i = 0; i < scanlines - end.value; i++) {
  gradients.forEach(g => g.push(b));
}


// round to nearest 5bit color
// [(i, (i>>3)*8, (i >> 3) *8 + (i>>5)) for i in range(238, 255)]
gradients = gradients.map(gradient => {
  return gradient.map(entry => {
    return entry.map(color => {
      return (color >> 3) * 8 + (color >> 5);
    });
  });
});

var ncols = gradients.length;
var currentCol = 0;
function fillColumn(currentCol) {
  // ctx.fillRect(canvas.width * (currentCol/ncols), i, canvas.width * ((currentCol+1)/ncols), i+1);
  ctx.fillRect(canvas.width * (currentCol/ncols), i, canvas.width * (1/ncols), 1);
  currentCol = (currentCol + 1) % ncols;
}
for (i = 0; i < canvas.height; i++) {
  gradients.forEach((g, j) => {
    ctx.fillStyle = 'rgb(' + g[Math.floor(i/ (canvas.height/scanlines))] + ')';
    
    //ctx.fillRect(canvas.width/4, i, canvas.width*2/4, i+1);
    fillColumn(j);
  }
  );
}
};
watch([topColor, bottomColor, start, end], draw);

function downloadGradient() {
  download(canvas.toDataURL('image/png'), 'gradient.png');
}

function copyCode() {



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
function internalSlice(arr, ind1, ind2) {
  return arr.map(e => [e[ind1], e[ind2]]);
}
const gradient = gradients[selected.value];
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

function genTable(countAndColors, mask) {
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
const singleTable = genTable(single,
[[0x20, 0x40, 0x80][singleIndex]]
);

const doubleTable = genTable(pairs[minIndex],
[
  [0x20, 0x40],
  [0x20, 0x80],
  [0x40, 0x80],
][minIndex]);

  var code = `
; Background gradient ${topColor.value} to ${bottomColor.value}
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

const selected = ref(1)

export default defineComponent({
  name: 'IndexPage',
  mounted,
  setup: function () {
    const inHash = [topColor, bottomColor, start, end, selected];

    function updateValues(new_) {
      for (var i = 0; i < inHash.length; i++) {
        inHash[i].value = decodeURIComponent(new_[i]);
      }
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
        var hash = '/v1';
        for (var i = 0; i < inHash.length; i++) {
          hash += '/' + encodeURIComponent(inHash[i].value);
        }
        history.pushState(null, null, '#' + hash);
      }),
    )

    return {
      draw,
      topColor,
      bottomColor,
      start,
      end,
      downloadGradient,
      copyCode,
      selected
    }
  }
})


function debounce(func, timeout = 300){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}


function RGBtoLAB(rgb) {
  return XYZtoLAB(RGBtoXYZ(rgb));
}

function LABtoRGB(lab) {
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
    const X = var_R * 0.4124 + var_G * 0.3576 + var_B * 0.1805
    const Y = var_R * 0.2126 + var_G * 0.7152 + var_B * 0.0722
    const Z = var_R * 0.0193 + var_G * 0.1192 + var_B * 0.9505
    return [X, Y, Z]
}

function XYZtoRGB([X, Y, Z]) {
    //X, Y and Z input refer to a D65/2° standard illuminant.
    //sR, sG and sB (standard RGB) output range = 0 ÷ 255

    let var_X = X / 100
    let var_Y = Y / 100
    let var_Z = Z / 100

    const var_R = var_X *  3.2406 + var_Y * -1.5372 + var_Z * -0.4986
    const var_G = var_X * -0.9689 + var_Y *  1.8758 + var_Z *  0.0415
    const var_B = var_X *  0.0557 + var_Y * -0.2040 + var_Z *  1.0570

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
