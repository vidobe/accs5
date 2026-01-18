import { createOptimizedPicture } from '../../scripts/aem.js';

const DEFAULT_TAG = 'Winnaarsverhalen';
const DEFAULT_DATE = '16 januari 2026';

const createMetaRow = () => {
  const meta = document.createElement('div');
  meta.className = 'cards-card-meta';

  const tag = document.createElement('span');
  tag.className = 'cards-card-tag';
  tag.textContent = DEFAULT_TAG;

  const date = document.createElement('span');
  date.className = 'cards-card-date';
  date.textContent = DEFAULT_DATE;

  meta.append(tag, date);
  return meta;
};

const createReadMore = (href) => {
  const a = document.createElement('a');
  a.className = 'cards-card-readmore';
  a.href = href;
  a.setAttribute('aria-label', 'Lees meer');

  const label = document.createElement('span');
  label.textContent = 'Lees meer';

  const icon = document.createElement('span');
  icon.className = 'cards-card-arrow';
  icon.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="M10 6l6 6-6 6-1.4-1.4L13.2 12 8.6 7.4 10 6z"/></svg>';

  a.append(label, icon);
  return a;
};

export default function decorate(block) {
  const ul = document.createElement('ul');

  [...block.children].forEach((row) => {
    const li = document.createElement('li');

    while (row.firstElementChild) {
      li.append(row.firstElementChild);
    }

    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) {
        div.className = 'cards-card-image';
      } else {
        div.className = 'cards-card-body';
      }
    });

    const body = li.querySelector('.cards-card-body');

    if (body) {
      // Insert meta row after the title (first heading), otherwise at top of body
      const heading = body.querySelector('h1, h2, h3, h4, h5, h6');
      const metaRow = createMetaRow();

      if (heading && heading.nextSibling) {
        body.insertBefore(metaRow, heading.nextSibling);
      } else if (heading) {
        body.append(metaRow);
      } else {
        body.prepend(metaRow);
      }

      // Move an existing link (if present) to a footer "Lees meer"
      const existingLink = body.querySelector('a[href]');
      const href = existingLink ? existingLink.getAttribute('href') : null;

      if (existingLink) {
        existingLink.remove();
      }

      if (href) {
        const footer = document.createElement('div');
        footer.className = 'cards-card-footer';
        footer.append(createReadMore(href));
        body.append(footer);
      }
    }

    ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => {
    img.closest('picture').replaceWith(
      createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]),
    );
  });

  block.replaceChildren(ul);
}
