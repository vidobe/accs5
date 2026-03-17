/**
 * Top Bar block for Edge Delivery Services
 * Authoring: table rows where each row can define message + optional CTA + dismissible
 */
function normalizeUrl(href) {
  try {
    // allow relative URLs
    return href?.trim() || '';
  } catch (e) {
    return '';
  }
}

function buildItem(cells) {
  const [messageCell, ctaLabelCell, ctaUrlCell, dismissCell] = cells;

  const message = messageCell?.innerHTML?.trim() || '';
  const ctaLabel = ctaLabelCell?.textContent?.trim() || '';
  const ctaUrl = normalizeUrl(ctaUrlCell?.textContent);
  const dismissible = (dismissCell?.textContent || '').trim().toLowerCase() === 'true';

  const item = document.createElement('div');
  item.className = 'top-bar__item';
  item.setAttribute('role', 'status');

  const content = document.createElement('div');
  content.className = 'top-bar__content';

  const msg = document.createElement('div');
  msg.className = 'top-bar__message';
  msg.innerHTML = message;

  content.append(msg);

  if (ctaLabel && ctaUrl) {
    const cta = document.createElement('a');
    cta.className = 'top-bar__cta';
    cta.href = ctaUrl;
    cta.textContent = ctaLabel;
    content.append(cta);
  }

  item.append(content);

  if (dismissible) {
    const btn = document.createElement('button');
    btn.className = 'top-bar__dismiss';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Dismiss notification');
    btn.innerHTML = '&times;';
    item.append(btn);
  }

  return item;
}

function setDismissBehavior(root, storageKey) {
  const dismissBtn = root.querySelector('.top-bar__dismiss');
  if (!dismissBtn) return;

  // If previously dismissed, keep it hidden
  const dismissed = window.sessionStorage.getItem(storageKey) === '1';
  if (dismissed) {
    root.classList.add('is-hidden');
    return;
  }

  dismissBtn.addEventListener('click', () => {
    root.classList.add('is-hidden');
    window.sessionStorage.setItem(storageKey, '1');
  });
}

function setupRotation(root) {
  const items = [...root.querySelectorAll('.top-bar__item')];
  if (items.length <= 1) return;

  root.classList.add('is-rotating');
  let index = 0;

  const show = (i) => {
    items.forEach((el, idx) => el.classList.toggle('is-active', idx === i));
  };

  // start
  show(index);

  // rotate every 6s (simple + lightweight)
  window.setInterval(() => {
    index = (index + 1) % items.length;
    show(index);
  }, 6000);
}

export default function decorate(block) {
  // Capture authored rows
  const rows = [...block.querySelectorAll(':scope > div')];
  const authored = rows
    .map((row) => [...row.children])
    .filter((cells) => cells.length && cells.some((c) => c.textContent.trim() || c.querySelector('*')));

  // Build shell
  const bar = document.createElement('div');
  bar.className = 'top-bar';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Site announcement');

  const inner = document.createElement('div');
  inner.className = 'top-bar__inner';

  // Build items
  authored.forEach((cells) => inner.append(buildItem(cells)));

  bar.append(inner);

  // Replace block markup with decorated bar
  block.textContent = '';
  block.append(bar);

  // Make it appear above the header by moving the containing section
  const section = block.closest('.section');
  const header = document.querySelector('header');
  if (section && header && header.parentElement) {
    header.parentElement.insertBefore(section, header);
    section.classList.add('top-bar-container');
  }

  // Dismiss: if any item has dismiss button, dismiss hides the whole bar
  const storageKey = `eds.topbar.dismissed.${window.location.host}`;
  setDismissBehavior(bar, storageKey);

  // Optional rotation if multiple rows/items
  setupRotation(bar);
}