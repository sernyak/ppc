import{t as e}from"./url.DPIMSB8L.js";var t=24,n=`
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`,r=`
precision highp float;
#define MAXD ${t}
uniform sampler2D uBefore;
uniform sampler2D uAfter;
uniform vec2 uRes;
uniform vec2 uRectMin;
uniform vec2 uRectSize;
uniform float uAspect;
uniform float uResidual;
uniform vec3 uBg;
uniform float uFeather;     // fade the photo's top and bottom into uBg (0 = off)
uniform int uCount;
uniform vec4 uDent[MAXD];   // centre (aspect-corrected), heal 0..1, unused
uniform vec4 uAxes[MAXD];   // a.xy, b.xy (aspect-corrected)

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 uv = (px - uRectMin) / uRectSize;
  vec2 q = vec2(uv.x * uAspect, uv.y);

  float m = 0.0;       // how much of the dented photo to show
  float cover = 0.0;   // inside any dent region
  float glint = 0.0;
  vec2 bq = q;

  for (int i = 0; i < MAXD; i++) {
    if (i >= uCount) break;
    vec2 c = uDent[i].xy;
    float e = uDent[i].z;
    vec2 a = uAxes[i].xy, b = uAxes[i].zw;
    float det = a.x * b.y - b.x * a.y;
    vec2 r = q - c;
    vec2 l = vec2(b.y * r.x - b.x * r.y, -a.y * r.x + a.x * r.y) / det;
    float rho = length(l);
    if (rho > 1.6) continue;
    float w = 1.0 - smoothstep(0.95, 1.45, rho);
    // the unhealed core shrinks towards the centre
    float front = 1.45 * (1.0 - e);
    float d = 1.0 - smoothstep(front - 0.32, front, rho);
    float mi = w * d;
    if (mi > m) {
      m = mi;
      // the damaged pattern contracts with the core, like metal being pushed back
      bq = c + r / max(0.35, 1.0 - 0.45 * e);
    }
    cover = max(cover, w);
    float ring = exp(-pow((rho - front + 0.12) / 0.14, 2.0));
    glint += ring * w * sin(3.14159 * e) * step(0.001, e);
  }

  vec3 after = texture2D(uAfter, uv).rgb;
  vec3 before = texture2D(uBefore, vec2(bq.x / uAspect, bq.y)).rgb;
  float mm = max(m, (1.0 - cover) * uResidual);
  vec3 col = mix(after, before, clamp(mm, 0.0, 1.0));
  col += vec3(1.0, 0.97, 0.92) * glint * 0.09;
  if (uFeather > 0.0) {
    float f = smoothstep(0.0, uFeather, uv.y) * smoothstep(0.0, uFeather, 1.0 - uv.y);
    col = mix(uBg, col, f);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;function i(e){return new Promise((t,n)=>{let r=new Image;r.decoding=`async`,r.onload=()=>t(r),r.onerror=n,r.src=e})}function a(e){let t=e;return()=>((t=t*16807%2147483647)-1)/2147483646}var o=e=>Math.min(1,Math.max(0,e)),s=e=>e*e*(3-2*e),c=e=>e<.5?4*e*e*e:1-(-2*e+2)**3/2;async function l(e){let{section:l,canvas:u,map:d}=e,f=u.getContext(`webgl`,{antialias:!1,alpha:!1,premultipliedAlpha:!1,powerPreference:`high-performance`});if(!f)throw Error(`webgl-unavailable`);let p=(e,t)=>{let n=f.createShader(e);if(f.shaderSource(n,t),f.compileShader(n),!f.getShaderParameter(n,f.COMPILE_STATUS))throw Error(f.getShaderInfoLog(n)||`shader`);return n},m=f.createProgram();if(f.attachShader(m,p(f.VERTEX_SHADER,n)),f.attachShader(m,p(f.FRAGMENT_SHADER,r)),f.linkProgram(m),!f.getProgramParameter(m,f.LINK_STATUS))throw Error(f.getProgramInfoLog(m)||`link`);f.useProgram(m);let h=f.createBuffer();f.bindBuffer(f.ARRAY_BUFFER,h),f.bufferData(f.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),f.STATIC_DRAW);let g=f.getAttribLocation(m,`aPos`);f.enableVertexAttribArray(g),f.vertexAttribPointer(g,2,f.FLOAT,!1,0,0);let _=e=>f.getUniformLocation(m,e),v={before:_(`uBefore`),after:_(`uAfter`),res:_(`uRes`),rectMin:_(`uRectMin`),rectSize:_(`uRectSize`),aspect:_(`uAspect`),residual:_(`uResidual`),count:_(`uCount`),dent:_(`uDent`),axes:_(`uAxes`),bg:_(`uBg`),feather:_(`uFeather`)},[y,b]=await Promise.all([i(e.before),i(e.after)]),x=(e,t)=>{let n=f.createTexture();f.activeTexture(f.TEXTURE0+e),f.bindTexture(f.TEXTURE_2D,n),f.pixelStorei(f.UNPACK_FLIP_Y_WEBGL,!1),f.texImage2D(f.TEXTURE_2D,0,f.RGB,f.RGB,f.UNSIGNED_BYTE,t),f.texParameteri(f.TEXTURE_2D,f.TEXTURE_MIN_FILTER,f.LINEAR),f.texParameteri(f.TEXTURE_2D,f.TEXTURE_MAG_FILTER,f.LINEAR),f.texParameteri(f.TEXTURE_2D,f.TEXTURE_WRAP_S,f.CLAMP_TO_EDGE),f.texParameteri(f.TEXTURE_2D,f.TEXTURE_WRAP_T,f.CLAMP_TO_EDGE)};x(0,y),x(1,b),f.uniform1i(v.before,0),f.uniform1i(v.after,1);let S=d.width/d.height;f.uniform1f(v.aspect,S),f.uniform3f(v.bg,10/255,11/255,13/255);let C=e.fit??`stage`,w=d.dents.slice(0,t),T=a(20240925),E=w.map((e,t)=>t).sort(()=>T()-.5),D=w.map(()=>({start:0,dur:0}));E.forEach((e,t)=>{let n=w[e],r=Math.hypot(n.ax,n.ay)*Math.hypot(n.bx,n.by),i=.16+Math.min(.14,r*12)+T()*.04,a=.06+t/Math.max(1,w.length-1)*(.76-i)+(T()-.5)*.03;D[e]={start:Math.max(.04,a),dur:i}});let O=new Float32Array(96),k=new Float32Array(96);w.forEach((e,t)=>k.set([e.ax,e.ay,e.bx,e.by],t*4)),f.uniform1i(v.count,w.length),f.uniform4fv(v.axes,k);let A=0,j=0,M=1,N={x:0,y:0,w:0,h:0},P=0;function F(e,t,n){let r=Math.max(A/d.width,j/d.height)*e;if(P=0,C===`full`&&A/j<.9){let t=A/(d.width*.56);if(d.height*t<j){r=t*e,P=.16;let n=d.width*r,i=d.height*r;N.w=n,N.h=i,N.x=Math.min(0,Math.max(A-n,A/2-d.focus.x*n)),N.y=j*.54-d.focus.y*i;return}}let i=d.width*r,a=d.height*r;N.w=i,N.h=a,N.x=(e=>Math.min(0,Math.max(A-i,e)))(A/2-d.focus.x*i+t*M),N.y=(e=>Math.min(0,Math.max(j-a,e)))(j/2-d.focus.y*a+n*M),C===`full`&&(N.y+=j*.07,P=.1)}let I=.07;function L(){let t=window.matchMedia(`(max-width: 767px)`).matches;I=t?.015:e.fit===`full`?.04:.07,M=Math.min(window.devicePixelRatio||1,t?2:1.75),A=Math.max(1,Math.round(u.clientWidth*M)),j=Math.max(1,Math.round(u.clientHeight*M)),u.width=A,u.height=j,f.viewport(0,0,A,j),B=!0}let R=0,z=0,B=!0,V={x:0,y:0},H={x:0,y:0},U=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches,W=()=>{let e=l.getBoundingClientRect(),t=e.height-window.innerHeight;R=o(t>0?-e.top/t:0)};function G(t){let n=1-Math.exp(-t*9),r=z;if(z+=(R-z)*n,Math.abs(R-z)<2e-4&&(z=R),H.x+=(V.x-H.x)*n*.6,H.y+=(V.y-H.y)*n*.6,!(Math.abs(z-r)>1e-5||Math.abs(V.x-H.x)>.001||Math.abs(V.y-H.y)>.001)&&!B)return;B=!1;let i=z,a=0;w.forEach((e,t)=>{let n=D[t],r=o((i-n.start)/n.dur);O.set([e.x*S,e.y,c(r),0],t*4),r<.75&&a++}),F(1+I*(1-s(i)),H.x*12,H.y*8),f.uniform2f(v.res,A,j),f.uniform2f(v.rectMin,N.x,N.y),f.uniform2f(v.rectSize,N.w,N.h),f.uniform1f(v.residual,1-s(o((i-.1)/.72))),f.uniform1f(v.feather,P),f.uniform4fv(v.dent,O),f.drawArrays(f.TRIANGLE_STRIP,0,4),e.onProgress?.(i,a,w.length)}let K=0,q=performance.now(),J=!0,Y=e=>{let t=Math.min(.05,(e-q)/1e3);q=e,W(),G(t),K=J?requestAnimationFrame(Y):0};new IntersectionObserver(([e])=>{J=e.isIntersecting,J&&!K&&(q=performance.now(),K=requestAnimationFrame(Y))}).observe(l),U||window.addEventListener(`pointermove`,e=>{e.pointerType===`mouse`&&(V.x=(e.clientX/window.innerWidth-.5)*-1,V.y=(e.clientY/window.innerHeight-.5)*-1)},{passive:!0}),new ResizeObserver(L).observe(u),L(),W(),z=R,G(.016),K=requestAnimationFrame(Y),u.addEventListener(`webglcontextlost`,e=>{e.preventDefault(),cancelAnimationFrame(K),l.classList.add(`hero-no-webgl`)}),window.__heroSet=e=>{R=z=o(e),B=!0,G(.016)}}var u={width:1376,height:768,focus:{x:.58,y:.57},dents:[{x:.7673,y:.6573,ax:-.003,ay:.1885,bx:-.1552,by:-.0025},{x:.4014,y:.5369,ax:-.0791,ay:.0132,bx:-.0099,by:-.0591},{x:.3158,y:.5169,ax:-.0021,ay:.122,bx:-.0556,by:-.001},{x:.3971,y:.6369,ax:.0163,ay:.0363,bx:-.0248,by:.0112},{x:.8844,y:.5031,ax:-.0743,ay:-.0309,bx:.0063,by:-.0151},{x:.5278,y:.551,ax:-.0478,ay:.0614,bx:-.0127,by:-.0099},{x:.5978,y:.5201,ax:-.0326,ay:-.0045,bx:.0025,by:-.0179},{x:.6093,y:.416,ax:-.0542,ay:.0055,bx:-.0014,by:-.0136},{x:.4729,y:.7211,ax:-.0408,ay:-.0071,bx:.0025,by:-.0145}]};function d(t){let n=document.querySelector(`[data-hero]`);if(!n)return;let r=e=>n.querySelector(e),i=r(`[data-hero-canvas]`),a=r(`[data-hud-count]`),o=r(`[data-hud-bar]`),s=r(`[data-hud-done]`),c=r(`[data-hud-counter]`),d=r(`[data-hud-state]`),f=r(`[data-hud-after]`),p=r(`[data-scroll-hint]`),m=-1;l({section:n,canvas:i,fit:t,before:e(`hero/before.webp`),after:e(`hero/after.webp`),map:u,onProgress(e,t){t!==m&&(a.textContent=String(t),m=t),o.style.transform=`scaleX(${e.toFixed(4)})`;let n=t===0;s.style.opacity=n?`1`:`0`,c.style.opacity=n?`0`:`1`,d&&(d.textContent=(n?d.dataset.after:d.dataset.before)??``,d.classList.toggle(`!bg-accent`,n),d.classList.toggle(`!text-[#16110a]`,n)),f?.classList.toggle(`!text-accent`,n),p&&(p.style.opacity=e>.04?`0`:`1`)}}).then(()=>i.classList.remove(`opacity-0`)).catch(()=>n.classList.add(`hero-no-webgl`))}export{d as t};