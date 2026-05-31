// GK Bike Store - Premium WebGL Interactive Light Rays Background Effect
// Ported from OGL React Shader to High-Performance Vanilla WebGL

(function () {
  const canvas = document.createElement('canvas');
  canvas.id = 'light-rays-canvas';
  canvas.className = 'fixed inset-0 pointer-events-none z-0 opacity-25 select-none transition-opacity duration-1000';
  document.body.prepend(canvas);

  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) {
    console.warn('WebGL not supported by your browser. Running without dynamic background.');
    return;
  }

  // Shader configuration parameters
  const config = {
    raysOrigin: 'top-center',
    raysColor: [0.02, 0.71, 0.83], // Hex #06B6D4 translated to normalized RGB [0-1]
    raysSpeed: 0.7,
    lightSpread: 0.8,
    rayLength: 1.6,
    pulsating: 1.0,
    fadeDistance: 0.9,
    saturation: 1.0,
    mouseInfluence: 0.12,
    noiseAmount: 0.03,
    distortion: 0.15
  };

  // State management
  const mouse = { x: 0.5, y: 0.5 };
  const smoothMouse = { x: 0.5, y: 0.5 };

  // Track cursor position
  window.addEventListener('mousemove', (e) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    mouse.x = e.clientX / w;
    mouse.y = e.clientY / h;
  });

  // Calculate Anchor & Direction for light ray sources
  function getAnchorAndDir(origin, w, h) {
    const outside = 0.2;
    switch (origin) {
      case 'top-left':
        return { anchor: [0, -outside * h], dir: [0, 1] };
      case 'top-right':
        return { anchor: [w, -outside * h], dir: [0, 1] };
      case 'left':
        return { anchor: [-outside * w, 0.5 * h], dir: [1, 0] };
      case 'right':
        return { anchor: [(1 + outside) * w, 0.5 * h], dir: [-1, 0] };
      case 'bottom-left':
        return { anchor: [0, (1 + outside) * h], dir: [0, -1] };
      case 'bottom-center':
        return { anchor: [0.5 * w, (1 + outside) * h], dir: [0, -1] };
      case 'bottom-right':
        return { anchor: [w, (1 + outside) * h], dir: [0, -1] };
      default: // "top-center"
        return { anchor: [0.5 * w, -outside * h], dir: [0, 1] };
    }
  }

  // Vertex Shader source
  const vsSource = `
    attribute vec2 position;
    varying vec2 vUv;
    void main() {
      vUv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  // Fragment Shader source (glorious dynamic volumetric shader)
  const fsSource = `
    precision highp float;

    uniform float iTime;
    uniform vec2  iResolution;

    uniform vec2  rayPos;
    uniform vec2  rayDir;
    uniform vec3  raysColor;
    uniform float raysSpeed;
    uniform float lightSpread;
    uniform float rayLength;
    uniform float pulsating;
    uniform float fadeDistance;
    uniform float saturation;
    uniform vec2  mousePos;
    uniform float mouseInfluence;
    uniform float noiseAmount;
    uniform float distortion;

    varying vec2 vUv;

    float noise(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord,
                      float seedA, float seedB, float speed) {
      vec2 sourceToCoord = coord - raySource;
      vec2 dirNorm = normalize(sourceToCoord);
      float cosAngle = dot(dirNorm, rayRefDirection);

      float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;
      
      float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));

      float distance = length(sourceToCoord);
      float maxDistance = iResolution.x * rayLength;
      float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);
      
      float fadeFalloff = clamp((iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance), 0.5, 1.0);
      float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;

      float baseStrength = clamp(
        (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
        (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
        0.0, 1.0
      );

      return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
    }

    void mainImage(out vec4 fragColor, in vec2 fragCoord) {
      vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
      
      vec2 finalRayDir = rayDir;
      if (mouseInfluence > 0.0) {
        vec2 mouseScreenPos = mousePos * iResolution.xy;
        vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
        finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
      }

      vec4 rays1 = vec4(1.0) *
                   rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349,
                               1.5 * raysSpeed);
      vec4 rays2 = vec4(1.0) *
                   rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234,
                               1.1 * raysSpeed);

      fragColor = rays1 * 0.5 + rays2 * 0.4;

      if (noiseAmount > 0.0) {
        float n = noise(coord * 0.01 + iTime * 0.1);
        fragColor.rgb *= (1.0 - noiseAmount + noiseAmount * n);
      }

      float brightness = 1.0 - (coord.y / iResolution.y);
      fragColor.x *= 0.1 + brightness * 0.8;
      fragColor.y *= 0.3 + brightness * 0.6;
      fragColor.z *= 0.5 + brightness * 0.5;

      if (saturation != 1.0) {
        float gray = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
        fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation);
      }

      fragColor.rgb *= raysColor;
    }

    void main() {
      vec4 color;
      mainImage(color, gl_FragCoord.xy);
      gl_FragColor  = color;
    }
  `;

  // Shader Helper Compiler functions
  function compileShader(source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vs = compileShader(vsSource, gl.VERTEX_SHADER);
  const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
  if (!vs || !fs) return;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Shader program link error:', gl.getProgramInfoLog(program));
    return;
  }

  // Get Attribute & Uniform Locations
  const positionLoc = gl.getAttribLocation(program, 'position');
  
  const uniforms = {
    iTime: gl.getUniformLocation(program, 'iTime'),
    iResolution: gl.getUniformLocation(program, 'iResolution'),
    rayPos: gl.getUniformLocation(program, 'rayPos'),
    rayDir: gl.getUniformLocation(program, 'rayDir'),
    raysColor: gl.getUniformLocation(program, 'raysColor'),
    raysSpeed: gl.getUniformLocation(program, 'raysSpeed'),
    lightSpread: gl.getUniformLocation(program, 'lightSpread'),
    rayLength: gl.getUniformLocation(program, 'rayLength'),
    pulsating: gl.getUniformLocation(program, 'pulsating'),
    fadeDistance: gl.getUniformLocation(program, 'fadeDistance'),
    saturation: gl.getUniformLocation(program, 'saturation'),
    mousePos: gl.getUniformLocation(program, 'mousePos'),
    mouseInfluence: gl.getUniformLocation(program, 'mouseInfluence'),
    noiseAmount: gl.getUniformLocation(program, 'noiseAmount'),
    distortion: gl.getUniformLocation(program, 'distortion')
  };

  // Setup Triangle Quad buffer (covers full viewport)
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  // Resize Viewport Handler
  let dpr = 1;
  let w = 0, h = 0;
  let anchor = [0, 0], dir = [0, 1];

  function resize() {
    dpr = Math.min(window.devicePixelRatio, 2);
    const wCSS = window.innerWidth;
    const hCSS = window.innerHeight;
    
    canvas.width = wCSS * dpr;
    canvas.height = hCSS * dpr;
    
    w = canvas.width;
    h = canvas.height;
    
    gl.viewport(0, 0, w, h);
    
    // Recalculate anchor positions
    const placement = getAnchorAndDir(config.raysOrigin, w, h);
    anchor = placement.anchor;
    dir = placement.dir;
  }

  window.addEventListener('resize', resize);
  resize();

  // Animation Loop
  function loop(timestamp) {
    // Smooth mouse coordinates with inertia
    const smoothing = 0.93;
    smoothMouse.x = smoothMouse.x * smoothing + mouse.x * (1 - smoothing);
    smoothMouse.y = smoothMouse.y * smoothing + mouse.y * (1 - smoothing);

    // Bind Shader program
    gl.useProgram(program);

    // Bind Attributes
    gl.enableVertexAttribArray(positionLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Bind Uniforms
    gl.uniform1f(uniforms.iTime, timestamp * 0.001);
    gl.uniform2f(uniforms.iResolution, w, h);
    gl.uniform2f(uniforms.rayPos, anchor[0], anchor[1]);
    gl.uniform2f(uniforms.rayDir, dir[0], dir[1]);
    
    gl.uniform3fv(uniforms.raysColor, config.raysColor);
    gl.uniform1f(uniforms.raysSpeed, config.raysSpeed);
    gl.uniform1f(uniforms.lightSpread, config.lightSpread);
    gl.uniform1f(uniforms.rayLength, config.rayLength);
    gl.uniform1f(uniforms.pulsating, config.pulsating);
    gl.uniform1f(uniforms.fadeDistance, config.fadeDistance);
    gl.uniform1f(uniforms.saturation, config.saturation);
    
    gl.uniform2f(uniforms.mousePos, smoothMouse.x, 1.0 - smoothMouse.y); // Match shader coordinate inversion
    gl.uniform1f(uniforms.mouseInfluence, config.mouseInfluence);
    gl.uniform1f(uniforms.noiseAmount, config.noiseAmount);
    gl.uniform1f(uniforms.distortion, config.distortion);

    // Draw full-screen Triangle
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
