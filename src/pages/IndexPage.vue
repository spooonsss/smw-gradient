<template>
  <q-page class="flex flex-center">
    <canvas id="c"></canvas>

    <q-color v-model="topColor" />
    <q-color v-model="bottomColor" />
    <q-btn color="white" text-color="black" label="Download" @click="downloadGradient" />
</q-page>
</template>

<script>
import { defineComponent, ref, watch } from 'vue'
import download from 'downloadjs';

const bottomColor = ref('#f66363')
const topColor = ref('#3b8edb')

var canvas;
var ctx;
var mounted = function() {
  canvas = document.getElementById("c");
  ctx = canvas.getContext("2d");    
  canvas.width = 200;
  canvas.height = 224 * 2;
  draw();
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
ctx.clearRect(0, 0, canvas.width, canvas.height);
//ctx.fillStyle = `rgba(${topColor.value}, 1)`
const t = parseColor(topColor.value);
const b = parseColor(bottomColor.value);
const height = canvas.height;

function mix(t, b, index) {
return t[index] * ((height-i)/height) + b[index] * (i/height);
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

// Mark method
const gamma = .43
const color1_lin = t.map(from_sRGB);
const bright1 = color1_lin.reduce((a,b)=>a+b)**gamma;
const color2_lin = b.map(from_sRGB);
const bright2 = color2_lin.reduce((a,b)=>a+b)**gamma;

var i;
var ncols = 4;
var currentCol = 0;
function fillColumn() {
  ctx.fillRect(canvas.width * (currentCol/ncols), i, canvas.width * ((currentCol+1)/ncols), i+1);
  currentCol = (currentCol + 1) % ncols;
}


for (i = 0; i < canvas.height; i++) {
  ctx.fillStyle = `rgb(${mixrgb(0)}, ${mixrgb(1)}, ${mixrgb(2)})`;
  // ctx.fillRect(0, i, canvas.width/4, i+1);
  fillColumn();

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
  ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  // ctx.fillRect(canvas.width*3/4, i, canvas.width*4/4, i+1);
  fillColumn();


  ctx.fillStyle = 'rgb(' + hsv2rgb.apply(null, [0, 1, 2].map(mixhsv)).map(v => v * 255) + ')';
  //ctx.fillRect(canvas.width/4, i, canvas.width*2/4, i+1);
  fillColumn();

  var hsvReverse = [0, 1, 2].map(mixhsv);
  if (topHSV[0] > bottomHSV[0]) {
    hsvReverse[0] = mix([topHSV[0]], [bottomHSV[0]+360], 0);
  } else {
    hsvReverse[0] = mix([topHSV[0] + 360], [bottomHSV[0]], 0);
  }
  hsvReverse[0] = (hsvReverse[0] + 720) % 360;

  ctx.fillStyle = 'rgb(0,0,0)';
  ctx.fillStyle = 'rgb(' + hsv2rgb.apply(null, hsvReverse).map(v => v * 255) + ')';
  //ctx.fillRect(canvas.width*2/4, i, canvas.width*3/4, i+1);
  fillColumn();


}
};
watch([topColor, bottomColor], draw);

function downloadGradient() {
  download(canvas.toDataURL('image/png'), 'gradient.png');
}

export default defineComponent({
  name: 'IndexPage',
  mounted,
  setup: function () {
    return {
      draw,
      topColor,
      bottomColor,
      downloadGradient
    }
  }
})
</script>
