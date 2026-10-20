const backendStage = document.querySelector('.stage-backend');
const frontendStage = document.querySelector('.stage-frontend');
if (backendStage && frontendStage) {
  backendStage.dataset.stage = '4';
  frontendStage.dataset.stage = '5';
  frontendStage.parentNode.insertBefore(backendStage, frontendStage);
}

const handoffs = {
  'stage-build': 'Siraj’s structure gave Mohamed one shared place to clean the data.',
  'stage-data': 'Mohamed’s cleaned values became Aya’s input for consistent KPI rules.',
  'stage-rules': 'Aya’s classifications and reasons gave Aseel the content hierarchy the interface needed.',
  'stage-ux': 'Aseel’s wireframes gave Batool and Ayaat a shared shape for the working system.',
  'stage-backend': 'Batool’s API responses gave Ayaat’s frontend reliable data to display.',
  'stage-frontend': 'Ayaat’s screens made the completed pipeline visible and usable for the team.'
};
Object.entries(handoffs).forEach(([className, text]) => {
  const stage = document.querySelector(`.${className} .stage-copy`);
  if (stage) stage.insertAdjacentHTML('beforeend', `<p class="handoff">${text}</p>`);
});

const stages = [...document.querySelectorAll('.stage-section')];
const dots = [...document.querySelectorAll('.stage-dot')];
const caption = document.querySelector('.stage-caption');
const progress = document.querySelector('.stage-progress');
const stageNames = [
  ['Siraj Aldeen', 'project management'],
  ['Mohamed Ramadan', 'data cleaning'],
  ['Aya', 'rules + labels'],
  ['Aseel', 'UI/UX'],
  ['Ayaat', 'frontend'],
  ['Batool', 'backend']
];

const goTo = index => {
  const target = index === 0 ? stages[0] : stages[index];
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

dots.forEach((dot, index) => dot.addEventListener('click', () => goTo(index)));
document.querySelectorAll('[data-jump]').forEach(button => button.addEventListener('click', () => goTo(Number(button.dataset.jump))));

const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('is-visible'); });
}, { threshold: 0.14 });
document.querySelectorAll('.reveal').forEach(element => revealObserver.observe(element));

const stageObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const index = Number(entry.target.dataset.stage);
    dots.forEach((dot, dotIndex) => dot.classList.toggle('active', dotIndex === index));
    const [name, role] = stageNames[index];
    caption.innerHTML = `${name} <span>${role}</span>`;
    progress.style.height = `${(index / (stages.length - 1)) * 100}%`;
  });
}, { threshold: 0.55 });
stages.forEach(stage => stageObserver.observe(stage));

document.addEventListener('keydown', event => {
  if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', ' '].includes(event.key)) return;
  event.preventDefault();
  const current = dots.findIndex(dot => dot.classList.contains('active'));
  const next = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? Math.max(0, current - 1) : Math.min(stages.length - 1, current + 1);
  goTo(next);
});

document.querySelectorAll('.evidence-step').forEach(step => step.addEventListener('click', () => {
  const target = step.dataset.target || 'data';
  const evidenceImage = document.querySelector(`#${target}-evidence-image`);
  const evidenceCaption = document.querySelector(`#${target}-evidence-caption`);
  document.querySelectorAll(`.evidence-step[data-target="${target}"]`).forEach(item => item.classList.remove('active'));
  step.classList.add('active');
  if (evidenceImage && evidenceCaption) {
    evidenceImage.src = `./assets/${step.dataset.image}`;
    evidenceImage.alt = step.dataset.alt;
    evidenceCaption.textContent = step.dataset.caption;
  }
}));

const imageModal = document.querySelector('#image-modal');
const modalImage = document.querySelector('#modal-image');
const modalCaption = document.querySelector('#image-modal-caption');
const modalClose = document.querySelector('.image-modal-close');
const openImageModal = image => {
  modalImage.src = image.currentSrc || image.src;
  modalImage.alt = image.alt;
  modalCaption.textContent = image.closest('figure')?.querySelector('figcaption')?.textContent || 'Enlarged project image';
  imageModal.hidden = false;
  document.body.style.overflow = 'hidden';
  modalClose.focus();
};
const closeImageModal = () => {
  imageModal.hidden = true;
  document.body.style.overflow = '';
};
document.querySelectorAll('.evidence-shot img').forEach(image => image.addEventListener('click', () => openImageModal(image)));
modalClose.addEventListener('click', closeImageModal);
imageModal.addEventListener('click', event => { if (event.target === imageModal) closeImageModal(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !imageModal.hidden) closeImageModal(); });
