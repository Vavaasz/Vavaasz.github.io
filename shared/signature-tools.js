(function () {
  function pointerPosition(event, canvas) {
    var point = event.touches && event.touches[0] ? event.touches[0] : event;
    var rect = canvas.getBoundingClientRect();
    return {
      x: point.clientX - rect.left,
      y: point.clientY - rect.top
    };
  }

  function createSignaturePad(options) {
    var canvas = options.canvas;
    var lineWidth = options.lineWidth || 2.2;
    var strokeStyle = options.strokeStyle || "#221815";
    var background = options.background === "transparent"
      ? null
      : (Object.prototype.hasOwnProperty.call(options, "background") ? options.background : "#ffffff");
    var showGuide = options.showGuide !== false;
    var placeholder = options.placeholder || "Assine aqui";
    var ratio = 1;
    var cssWidth = 0;
    var cssHeight = 0;
    var drawing = false;
    var enabled = options.enabled !== false;
    var storedDataUrl = String(options.initialDataUrl || "").trim();
    var context = canvas.getContext("2d");

    function drawFrame() {
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, cssWidth, cssHeight);
      if (background) {
        context.fillStyle = background;
        context.fillRect(0, 0, cssWidth, cssHeight);
      }
      if (!showGuide) return;
      context.strokeStyle = "rgba(120, 92, 77, 0.3)";
      context.setLineDash([9, 7]);
      context.beginPath();
      context.moveTo(24, Math.max(24, cssHeight - 34));
      context.lineTo(cssWidth - 24, Math.max(24, cssHeight - 34));
      context.stroke();
      context.setLineDash([]);
      if (!storedDataUrl && placeholder) {
        context.fillStyle = "rgba(98, 79, 69, 0.68)";
        context.font = "600 14px 'Segoe UI', sans-serif";
        context.textAlign = "center";
        context.fillText(placeholder, cssWidth / 2, Math.max(32, cssHeight - 42));
      }
    }

    function drawStoredSignature() {
      drawFrame();
      if (!storedDataUrl) return;
      var image = new Image();
      image.onload = function () {
        context.drawImage(image, 10, 10, cssWidth - 20, cssHeight - 30);
      };
      image.src = storedDataUrl;
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      cssWidth = Math.max(Math.round(rect.width || 0), options.minWidth || 320);
      cssHeight = Math.max(Math.round(rect.height || 0), options.minHeight || 180);
      ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssWidth * ratio);
      canvas.height = Math.round(cssHeight * ratio);
      canvas.style.width = cssWidth + "px";
      canvas.style.height = cssHeight + "px";
      drawStoredSignature();
    }

    function save() {
      storedDataUrl = canvas.toDataURL("image/png");
      return storedDataUrl;
    }

    function begin(event) {
      if (!enabled) return;
      event.preventDefault();
      drawing = true;
      var point = pointerPosition(event, canvas);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (!storedDataUrl) drawFrame();
      storedDataUrl = "";
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = strokeStyle;
      context.lineWidth = lineWidth;
      context.beginPath();
      context.moveTo(point.x, point.y);
    }

    function move(event) {
      if (!drawing || !enabled) return;
      event.preventDefault();
      var point = pointerPosition(event, canvas);
      context.lineTo(point.x, point.y);
      context.stroke();
    }

    function end(event) {
      if (!drawing) return;
      if (event) event.preventDefault();
      drawing = false;
      save();
    }

    canvas.addEventListener("pointerdown", begin);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointerleave", end);
    canvas.addEventListener("touchstart", begin, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end, { passive: false });

    resize();

    return {
      resize: resize,
      clear: function () {
        storedDataUrl = "";
        drawFrame();
      },
      load: function (dataUrl) {
        storedDataUrl = String(dataUrl || "").trim();
        drawStoredSignature();
      },
      read: function () {
        return storedDataUrl;
      },
      hasData: function () {
        return Boolean(String(storedDataUrl || "").trim());
      },
      setEnabled: function (nextEnabled) {
        enabled = Boolean(nextEnabled);
        canvas.classList.toggle("is-disabled", !enabled);
      }
    };
  }

  window.TKASignatureTools = {
    createSignaturePad: createSignaturePad
  };
})();
