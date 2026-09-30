(() => {
  const fileInput = document.querySelector('#logo-file');
  const canvas = document.querySelector('#logo-canvas');
  const ctx = canvas?.getContext('2d');
  const logoImage = document.querySelector('#logo-preview-image');
  const logoColor = document.querySelector('#logo-color');
  const backgroundColor = document.querySelector('#logo-background');
  const scaleInput = document.querySelector('#logo-scale');
  const rotationInput = document.querySelector('#logo-rotation');
  const scaleValue = document.querySelector('#logo-scale-value');
  const rotationValue = document.querySelector('#logo-rotation-value');
  const downloadButton = document.querySelector('#download-logo');
  const resetButton = document.querySelector('#reset-logo-editor');
  const status = document.querySelector('#logo-editor-status');

  if (!canvas || !ctx || !logoImage) return;

  let source = logoImage;
  let uploadedUrl = null;

  const defaults = {
    background: '#050505',
    color: '#ffffff',
    scale: 78,
    rotation: 0
  };

  function draw() {
    const background = backgroundColor.value;
    const scale = Number(scaleInput.value) / 100;
    const rotation = Number(rotationInput.value) * Math.PI / 180;

    canvas.width = 900;
    canvas.height = 700;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const maxWidth = canvas.width * scale;
    const maxHeight = canvas.height * scale;
    const ratio = Math.min(maxWidth / source.naturalWidth, maxHeight / source.naturalHeight);
    const width = source.naturalWidth * ratio;
    const height = source.naturalHeight * ratio;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rotation);
    ctx.drawImage(source, -width / 2, -height / 2, width, height);
    ctx.restore();

    scaleValue.textContent = `${scaleInput.value}%`;
    rotationValue.textContent = `${rotationInput.value}°`;
  }

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  logoImage.addEventListener('load', draw);
  logoColor.addEventListener('input', draw);
  backgroundColor.addEventListener('input', draw);
  scaleInput.addEventListener('input', draw);
  rotationInput.addEventListener('input', draw);

  fileInput.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      setStatus('Escolha uma imagem PNG, JPG, WEBP ou SVG.');
      return;
    }

    if (uploadedUrl) URL.revokeObjectURL(uploadedUrl);
    uploadedUrl = URL.createObjectURL(file);
    source = new Image();
    source.onload = () => {
      setStatus(`Imagem carregada: ${file.name}. Ajuste e baixe sua logo.`);
      draw();
    };
    source.src = uploadedUrl;
  });

  downloadButton.addEventListener('click', () => {
    draw();
    const link = document.createElement('a');
    link.download = 'nolefy-logo-editada.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    setStatus('Logo baixada. Para colocá-la no site, envie o arquivo para a pasta assets no GitHub.');
  });

  resetButton.addEventListener('click', () => {
    backgroundColor.value = defaults.background;
    logoColor.value = defaults.color;
    scaleInput.value = defaults.scale;
    rotationInput.value = defaults.rotation;
    fileInput.value = '';
    source = logoImage;
    setStatus('Editor restaurado.');
    draw();
  });

  draw();
})();
