document.getElementById("year").textContent = new Date().getFullYear();

const heroCanvas = document.getElementById("hero-canvas");
const heroDossier = document.querySelector(".hero-dossier");

if (heroCanvas && heroDossier) {
  const context = heroCanvas.getContext("2d");

  if (context) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointCount = 78;
    const points = Array.from({ length: pointCount }, (_, index) => {
      const y = 1 - (index / (pointCount - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const angle = Math.PI * (3 - Math.sqrt(5)) * index;

      return { x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius };
    });
    const edges = [];

    points.forEach((point, index) => {
      points
        .map((other, otherIndex) => ({
          index: otherIndex,
          distance: Math.hypot(point.x - other.x, point.y - other.y, point.z - other.z)
        }))
        .filter((other) => other.index !== index)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3)
        .forEach((other) => {
          const start = Math.min(index, other.index);
          const end = Math.max(index, other.index);
          if (!edges.some((edge) => edge.start === start && edge.end === end)) {
            edges.push({ start, end });
          }
        });
    });

    const state = {
      width: 1,
      height: 1,
      frame: 0,
      active: true,
      pointerX: 0,
      pointerY: 0
    };

    function resizeCanvas() {
      const bounds = heroCanvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;

      state.width = bounds.width;
      state.height = bounds.height;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      heroCanvas.width = Math.floor(bounds.width * pixelRatio);
      heroCanvas.height = Math.floor(bounds.height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      draw(0);
    }

    function draw(timestamp) {
      const { width, height } = state;
      const rotation = timestamp * 0.00023 + state.pointerX * 0.22;
      const tilt = state.pointerY * 0.16;
      const cosRotation = Math.cos(rotation);
      const sinRotation = Math.sin(rotation);
      const cosTilt = Math.cos(tilt);
      const sinTilt = Math.sin(tilt);
      const focalLength = Math.min(width, height) * 0.43;
      const projected = points.map((point) => {
        const rotatedX = point.x * cosRotation - point.z * sinRotation;
        const rotatedZ = point.x * sinRotation + point.z * cosRotation;
        const tiltedY = point.y * cosTilt - rotatedZ * sinTilt;
        const tiltedZ = point.y * sinTilt + rotatedZ * cosTilt;
        const scale = focalLength / (1.9 + tiltedZ);

        return {
          x: width / 2 + rotatedX * scale,
          y: height * 0.4 + tiltedY * scale,
          depth: (tiltedZ + 1) / 2
        };
      });

      context.clearRect(0, 0, width, height);

      const glow = context.createRadialGradient(width / 2, height * 0.4, 0, width / 2, height * 0.4, focalLength * 1.35);
      glow.addColorStop(0, "rgba(255, 152, 8, 0.11)");
      glow.addColorStop(1, "rgba(255, 152, 8, 0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      context.lineWidth = 0.8;
      edges.forEach((edge) => {
        const start = projected[edge.start];
        const end = projected[edge.end];
        const opacity = 0.035 + ((start.depth + end.depth) / 2) * 0.16;
        context.strokeStyle = `rgba(187, 104, 0, ${opacity})`;
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.stroke();
      });

      projected
        .slice()
        .sort((a, b) => a.depth - b.depth)
        .forEach((point, index) => {
          const radius = 1.2 + point.depth * 2.2;
          const opacity = 0.18 + point.depth * 0.66;
          context.beginPath();
          context.fillStyle = index % 7 === 0
            ? `rgba(17, 16, 14, ${opacity})`
            : `rgba(255, 152, 8, ${opacity})`;
          context.arc(point.x, point.y, radius, 0, Math.PI * 2);
          context.fill();
        });
    }

    function stopAnimation() {
      if (!state.frame) return;
      cancelAnimationFrame(state.frame);
      state.frame = 0;
    }

    function animate(timestamp) {
      if (!state.active || reduceMotion.matches || document.hidden) {
        state.frame = 0;
        return;
      }

      draw(timestamp);
      state.frame = requestAnimationFrame(animate);
    }

    function startAnimation() {
      if (!state.active || reduceMotion.matches || document.hidden || state.frame) return;
      state.frame = requestAnimationFrame(animate);
    }

    heroDossier.addEventListener("pointermove", (event) => {
      const bounds = heroDossier.getBoundingClientRect();
      state.pointerX = (event.clientX - bounds.left) / bounds.width - 0.5;
      state.pointerY = (event.clientY - bounds.top) / bounds.height - 0.5;
      if (reduceMotion.matches) draw(0);
    }, { passive: true });

    heroDossier.addEventListener("pointerleave", () => {
      state.pointerX = 0;
      state.pointerY = 0;
      if (reduceMotion.matches) draw(0);
    }, { passive: true });

    if (typeof IntersectionObserver === "function") {
      const visibilityObserver = new IntersectionObserver((entries) => {
        state.active = entries[0].isIntersecting;
        if (state.active) startAnimation();
        else stopAnimation();
      }, { threshold: 0.05 });

      visibilityObserver.observe(heroDossier);
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopAnimation();
      else startAnimation();
    });

    const motionChanged = () => {
      stopAnimation();
      draw(0);
      startAnimation();
    };

    if (typeof reduceMotion.addEventListener === "function") {
      reduceMotion.addEventListener("change", motionChanged);
    } else if (typeof reduceMotion.addListener === "function") {
      reduceMotion.addListener(motionChanged);
    }

    if (typeof ResizeObserver === "function") {
      new ResizeObserver(resizeCanvas).observe(heroCanvas);
    } else {
      window.addEventListener("resize", resizeCanvas, { passive: true });
    }

    resizeCanvas();
    startAnimation();
  }
}

const revealItems = document.querySelectorAll(".glass-panel, .project-card, .timeline-item");

if ("IntersectionObserver" in window) {
  revealItems.forEach((item) => item.classList.add("reveal-ready"));

  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      currentObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  revealItems.forEach((item) => observer.observe(item));
}
