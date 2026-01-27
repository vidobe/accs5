// Drop-in Tools
import { events } from '@dropins/tools/event-bus.js';

import { tryRenderAemAssetsImage } from '@dropins/tools/lib/aem/assets.js';
import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { fetchPlaceholders, getProductLink, rootLink } from '../../scripts/commerce.js';

import renderAuthCombine from './renderAuthCombine.js';
import { renderAuthDropdown } from './renderAuthDropdown.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');

const labels = await fetchPlaceholders();

const overlay = document.createElement('div');
overlay.classList.add('overlay');
document.querySelector('header').insertAdjacentElement('afterbegin', overlay);

/**
 * Locale / Market Topbar (Country + Language)
 * - Desktop only (CSS hides on < 900px)
 * - Persists selection via localStorage
 * - Navigates using query params by default: ?country=NL&lang=nl
 *   -> Replace resolveTargetUrl() if you want path-based or store-view based routing.
 */
const LOCALES = [
  {
    country: 'United Kingdom',
    countryCode: 'GB',
    languages: [{ label: 'English', code: 'en' }],
  },
  {
    country: 'Netherlands',
    countryCode: 'NL',
    languages: [
      { label: 'Dutch', code: 'nl' },
      { label: 'English', code: 'en' },
    ],
  },
  {
    country: 'Germany',
    countryCode: 'DE',
    languages: [
      { label: 'Deutsch', code: 'de' },
      { label: 'English', code: 'en' },
    ],
  },
];

function resolveTargetUrl(countryCode, langCode) {
  const { origin, pathname } = window.location;

  // Remove existing locale prefix if present
  const cleanPath = pathname.replace(/^\/(de|nl|en)(\/|$)/, '/');

  // Germany → Deutsch
  if (countryCode === 'DE' && langCode === 'de') {
    return `${origin}/de${cleanPath}`;
  }

  // Netherlands
  if (countryCode === 'NL' && langCode === 'nl') {
    return `${origin}/nl${cleanPath}`;
  }
  if (countryCode === 'NL' && langCode === 'en') {
    return `${origin}/en${cleanPath}`;
  }

  // United Kingdom (default, no prefix)
  if (countryCode === 'GB' && langCode === 'en') {
    return `${origin}${cleanPath}`;
  }

  // Fallback
  return `${origin}${cleanPath}`;
}

function createLocaleTopBar() {
  const topbar = document.createElement('div');
  topbar.className = 'nav-topbar';

  const inner = document.createElement('div');
  inner.className = 'nav-topbar-inner';
  topbar.append(inner);

  const countryWrap = document.createElement('div');
  countryWrap.className = 'nav-topbar-field nav-topbar-country';

  const langWrap = document.createElement('div');
  langWrap.className = 'nav-topbar-field nav-topbar-language';

  const countryLabel = document.createElement('label');
  countryLabel.textContent = 'Country';
  countryLabel.setAttribute('for', 'locale-country');

  const langLabel = document.createElement('label');
  langLabel.textContent = 'Language';
  langLabel.setAttribute('for', 'locale-language');

  const countrySelect = document.createElement('select');
  countrySelect.id = 'locale-country';
  countrySelect.name = 'country';

  const langSelect = document.createElement('select');
  langSelect.id = 'locale-language';
  langSelect.name = 'language';

  // populate country options
  LOCALES.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.countryCode;
    opt.textContent = c.country;
    countrySelect.append(opt);
  });

  function setLanguages(countryCode, preferredLang) {
    const entry = LOCALES.find((c) => c.countryCode === countryCode) || LOCALES[0];
    langSelect.innerHTML = '';

    entry.languages.forEach((l) => {
      const opt = document.createElement('option');
      opt.value = l.code;
      opt.textContent = l.label;
      langSelect.append(opt);
    });

    const exists = entry.languages.some((l) => l.code === preferredLang);
    langSelect.value = exists ? preferredLang : entry.languages[0].code;
  }

  const url = new URL(window.location.href);
  const initCountry = url.searchParams.get('country')
    || localStorage.getItem('country')
    || 'GB';

  const initLang = url.searchParams.get('lang')
    || localStorage.getItem('lang')
    || 'en';

  countrySelect.value = initCountry;
  setLanguages(initCountry, initLang);

  function persistAndNavigate() {
    localStorage.setItem('country', countrySelect.value);
    localStorage.setItem('lang', langSelect.value);
    window.location.assign(resolveTargetUrl(countrySelect.value, langSelect.value));
  }

  countrySelect.addEventListener('change', () => {
    // When switching country: keep english if supported, else first language
    setLanguages(countrySelect.value, langSelect.value || 'en');
    persistAndNavigate();
  });

  langSelect.addEventListener('change', () => {
    persistAndNavigate();
  });

  countryWrap.append(countryLabel, countrySelect);
  langWrap.append(langLabel, langSelect);
  inner.append(countryWrap, langWrap);

  return topbar;
}

function closeOnEscape(e) {
  if (e.code === 'Escape') {
    const nav = document.getElementById('nav');
    if (!nav) return;

    const navSections = nav.querySelector('.nav-sections');
    const navSectionExpanded = navSections?.querySelector('[aria-expanded="true"]');

    if (navSectionExpanded && isDesktop.matches) {
      toggleAllNavSections(navSections, false);
      overlay.classList.remove('show');
      navSectionExpanded.focus();
    } else if (!isDesktop.matches) {
      toggleMenu(nav, navSections, false);
      overlay.classList.remove('show');
      nav.querySelector('button')?.focus();
      const navWrapper = document.querySelector('.nav-wrapper');
      navWrapper?.classList.remove('active');
    }
  }
}

function closeOnFocusLost(e) {
  const nav = e.currentTarget;
  if (!nav) return;

  if (!nav.contains(e.relatedTarget)) {
    const navSections = nav.querySelector('.nav-sections');
    const navSectionExpanded = navSections?.querySelector('[aria-expanded="true"]');

    if (navSectionExpanded && isDesktop.matches) {
      toggleAllNavSections(navSections, false);
      overlay.classList.remove('show');
    } else if (!isDesktop.matches) {
      toggleMenu(nav, navSections, false);
    }
  }
}

function openOnKeydown(e) {
  const focused = document.activeElement;
  const isNavDrop = focused?.className === 'nav-drop';
  if (isNavDrop && (e.code === 'Enter' || e.code === 'Space')) {
    const dropExpanded = focused.getAttribute('aria-expanded') === 'true';
    toggleAllNavSections(focused.closest('.nav-sections'), false);
    focused.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
  }
}

function focusNavSection() {
  document.activeElement?.addEventListener('keydown', openOnKeydown);
}

/**
 * Toggles all nav sections
 * @param {Element} sections The container element
 * @param {Boolean} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  if (!sections) return;
  sections
    .querySelectorAll('.nav-sections .default-content-wrapper > ul > li')
    .forEach((section) => {
      section.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {Boolean|null} forceExpanded Optional param to force nav expanded/collapsed
 */
function toggleMenu(nav, navSections, forceExpanded = null) {
  if (!nav) return;

  // Desired state: expanded=true means menu is open (mobile drawer open)
  const expanded = forceExpanded !== null
    ? forceExpanded
    : nav.getAttribute('aria-expanded') === 'true';

  const button = nav.querySelector('.nav-hamburger button');

  // Apply state (NOT inverted)
  nav.setAttribute('aria-expanded', expanded ? 'true' : 'false');

  // Only lock scroll when mobile menu is open
  document.body.style.overflowY = (!isDesktop.matches && expanded) ? 'hidden' : '';

  // On mobile: opening the menu should expand the section list
  // On desktop: keep sections collapsed (hover handles open)
  toggleAllNavSections(navSections, (!isDesktop.matches && expanded));

  button?.setAttribute('aria-label', expanded ? 'Close navigation' : 'Open navigation');

  // enable nav dropdown keyboard accessibility
  const navDrops = navSections?.querySelectorAll('.nav-drop') || [];
  if (isDesktop.matches) {
    navDrops.forEach((drop) => {
      if (!drop.hasAttribute('tabindex')) {
        drop.setAttribute('tabindex', 0);
        drop.addEventListener('focus', focusNavSection);
      }
    });
  } else {
    navDrops.forEach((drop) => {
      drop.classList.remove('active');
      drop.removeAttribute('tabindex');
      drop.removeEventListener('focus', focusNavSection);
    });
  }

  // enable menu collapse on escape keypress / focus lost when something can be open
  if (expanded || isDesktop.matches) {
    window.addEventListener('keydown', closeOnEscape);
    nav.addEventListener('focusout', closeOnFocusLost);
  } else {
    window.removeEventListener('keydown', closeOnEscape);
    nav.removeEventListener('focusout', closeOnFocusLost);
  }
}

const subMenuHeader = document.createElement('div');
subMenuHeader.classList.add('submenu-header');
subMenuHeader.innerHTML = '<h5 class="back-link">All Categories</h5><hr />';

/**
 * Sets up the submenu
 * @param {Element} navSection The nav section element
 */
function setupSubmenu(navSection) {
  if (navSection.querySelector('ul')) {
    let label;
    if (navSection.childNodes.length) {
      [label] = navSection.childNodes;
    }

    const submenu = navSection.querySelector('ul');
    const wrapper = document.createElement('div');
    const header = subMenuHeader.cloneNode(true);
    const title = document.createElement('h6');
    title.classList.add('submenu-title');
    title.textContent = label?.textContent || '';

    wrapper.classList.add('submenu-wrapper');
    wrapper.appendChild(header);
    wrapper.appendChild(title);
    wrapper.appendChild(submenu.cloneNode(true));

    navSection.appendChild(wrapper);
    navSection.removeChild(submenu);
  }
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // load nav as fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  const navBrand = nav.querySelector('.nav-brand');
  const brandLink = navBrand?.querySelector('.button');
  if (brandLink) {
    brandLink.className = '';
    brandLink.closest('.button-container').className = '';
  }

  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    navSections
      .querySelectorAll(':scope .default-content-wrapper > ul > li')
      .forEach((navSection) => {
        if (navSection.querySelector('ul')) navSection.classList.add('nav-drop');
        setupSubmenu(navSection);

        navSection.addEventListener('click', (event) => {
          if (event.target.tagName === 'A') return;
          if (!isDesktop.matches) {
            navSection.classList.toggle('active');
          }
        });

        navSection.addEventListener('mouseenter', () => {
          toggleAllNavSections(navSections, false);

          if (isDesktop.matches) {
            if (!navSection.classList.contains('nav-drop')) {
              overlay.classList.remove('show');
              return;
            }
            navSection.setAttribute('aria-expanded', 'true');
            overlay.classList.add('show');
          }
        });
      });
  }

  const navTools = nav.querySelector('.nav-tools');

  /** Wishlist */
  const wishlist = document.createRange().createContextualFragment(`
     <div class="wishlist-wrapper nav-tools-wrapper">
       <button type="button" class="nav-wishlist-button" aria-label="Wishlist"></button>
       <div class="wishlist-panel nav-tools-panel"></div>
     </div>
   `);

  navTools?.append(wishlist);

  const wishlistButton = navTools?.querySelector('.nav-wishlist-button');

  const wishlistMeta = getMetadata('wishlist');
  const wishlistPath = wishlistMeta ? new URL(wishlistMeta, window.location).pathname : '/wishlist';

  wishlistButton?.addEventListener('click', () => {
    window.location.href = rootLink(wishlistPath);
  });

  /** Mini Cart */
  const excludeMiniCartFromPaths = ['/checkout'];

  const minicart = document.createRange().createContextualFragment(`
     <div class="minicart-wrapper nav-tools-wrapper">
       <button type="button" class="nav-cart-button" aria-label="Cart"></button>
       <div class="minicart-panel nav-tools-panel"></div>
     </div>
   `);

  navTools?.append(minicart);

  const minicartPanel = navTools?.querySelector('.minicart-panel');
  const cartButton = navTools?.querySelector('.nav-cart-button');

  if (cartButton && excludeMiniCartFromPaths.includes(window.location.pathname)) {
    cartButton.style.display = 'none';
  }

  async function withLoadingState(panel, button, loader) {
    if (!panel) return;
    if (panel.dataset.loaded === 'true' || panel.dataset.loading === 'true') return;

    button?.setAttribute('aria-busy', 'true');
    panel.dataset.loading = 'true';

    try {
      await loader();
      panel.dataset.loaded = 'true';
    } finally {
      panel.dataset.loading = 'false';
      button?.removeAttribute('aria-busy');

      if (panel.dataset.pendingToggle === 'true') {
        // eslint-disable-next-line no-nested-ternary
        const pendingState = panel.dataset.pendingState === 'true'
          ? true
          : (panel.dataset.pendingState === 'false' ? false : undefined);

        panel.removeAttribute('data-pending-toggle');
        panel.removeAttribute('data-pending-state');

        const show = pendingState ?? !panel.classList.contains('nav-tools-panel--show');
        panel.classList.toggle('nav-tools-panel--show', show);
      }
    }
  }

  function togglePanel(panel, state) {
    if (!panel) return;

    if (panel.dataset.loading === 'true') {
      panel.dataset.pendingToggle = 'true';
      panel.dataset.pendingState = state !== undefined ? state.toString() : '';
      return;
    }

    const show = state ?? !panel.classList.contains('nav-tools-panel--show');
    panel.classList.toggle('nav-tools-panel--show', show);
  }

  async function loadMiniCartFragment() {
    if (!minicartPanel) return;
    await withLoadingState(minicartPanel, cartButton, async () => {
      const miniCartMeta = getMetadata('mini-cart');
      const miniCartPath = miniCartMeta ? new URL(miniCartMeta, window.location).pathname : '/mini-cart';
      const miniCartFragment = await loadFragment(miniCartPath);
      minicartPanel.append(miniCartFragment.firstElementChild);
    });
  }

  async function toggleMiniCart(state) {
    if (!minicartPanel) return;

    if (state) {
      await loadMiniCartFragment();
      const { publishShoppingCartViewEvent } = await import('@dropins/storefront-cart/api.js');
      publishShoppingCartViewEvent();
    }

    togglePanel(minicartPanel, state);
  }

  cartButton?.addEventListener('click', () => {
    toggleMiniCart(!minicartPanel?.classList.contains('nav-tools-panel--show'));
  });

  // Cart Item Counter
  events.on('cart/data', (data) => {
    if (data) loadMiniCartFragment();

    if (data?.totalQuantity) {
      cartButton?.setAttribute('data-count', data.totalQuantity);
    } else {
      cartButton?.removeAttribute('data-count');
    }
  }, { eager: true });

  /** Search */
  const searchFragment = document.createRange().createContextualFragment(`
  <div class="search-wrapper nav-tools-wrapper">
    <button type="button" class="nav-search-button">Search</button>
    <div class="nav-search-input nav-search-panel nav-tools-panel">
      <form id="search-bar-form"></form>
      <div class="search-bar-result" style="display: none;"></div>
    </div>
  </div>
  `);

  navTools?.append(searchFragment);

  const searchPanel = navTools?.querySelector('.nav-search-panel');
  const searchButton = navTools?.querySelector('.nav-search-button');
  const searchForm = searchPanel?.querySelector('#search-bar-form');
  const searchResult = searchPanel?.querySelector('.search-bar-result');

  async function toggleSearch(state) {
    const pageSize = 4;

    if (state && searchPanel) {
      await withLoadingState(searchPanel, searchButton, async () => {
        await import('../../scripts/initializers/search.js');

        const [
          { search },
          { render },
          { SearchResults },
          { provider: UI, Input, Button },
        ] = await Promise.all([
          import('@dropins/storefront-product-discovery/api.js'),
          import('@dropins/storefront-product-discovery/render.js'),
          import('@dropins/storefront-product-discovery/containers/SearchResults.js'),
          import('@dropins/tools/components.js'),
          import('@dropins/tools/lib.js'),
        ]);

        render.render(SearchResults, {
          skeletonCount: pageSize,
          scope: 'popover',
          routeProduct: ({ urlKey, sku }) => getProductLink(urlKey, sku),
          onSearchResult: (results) => {
            if (searchResult) searchResult.style.display = results.length > 0 ? 'block' : 'none';
          },
          slots: {
            ProductImage: (ctx) => {
              const { product, defaultImageProps } = ctx;
              const anchorWrapper = document.createElement('a');
              anchorWrapper.href = getProductLink(product.urlKey, product.sku);

              tryRenderAemAssetsImage(ctx, {
                alias: product.sku,
                imageProps: defaultImageProps,
                wrapper: anchorWrapper,
                params: {
                  width: defaultImageProps.width,
                  height: defaultImageProps.height,
                },
              });
            },
            Footer: async (ctx) => {
              const viewAllResultsWrapper = document.createElement('div');

              const viewAllResultsButton = await UI.render(Button, {
                children: labels.Global?.SearchViewAll,
                variant: 'secondary',
                href: rootLink('/search'),
              })(viewAllResultsWrapper);

              ctx.appendChild(viewAllResultsWrapper);

              ctx.onChange((next) => {
                viewAllResultsButton?.setProps((prev) => ({
                  ...prev,
                  href: `${rootLink('/search')}?q=${encodeURIComponent(next.variables?.phrase || '')}`,
                }));
              });
            },
          },
        })(searchResult);

        searchForm?.addEventListener('submit', (e) => {
          e.preventDefault();
          const query = e.target.search.value;
          if (query.length) {
            window.location.href = `${rootLink('/search')}?q=${encodeURIComponent(query)}`;
          }
        });

        UI.render(Input, {
          name: 'search',
          placeholder: labels.Global?.Search,
          onValue: (phrase) => {
            if (!phrase) {
              search(null, { scope: 'popover' });
              return;
            }

            if (phrase.length < 3) return;

            search({
              phrase,
              pageSize,
              filter: [
                { attribute: 'visibility', in: ['Search', 'Catalog, Search'] },
              ],
            }, { scope: 'popover' });
          },
        })(searchForm);
      });
    }

    togglePanel(searchPanel, state);
    if (state) searchForm?.querySelector('input')?.focus();
  }

  searchButton?.addEventListener('click', () => {
    toggleSearch(!searchPanel?.classList.contains('nav-tools-panel--show'));
  });

  navTools?.querySelector('.nav-search-button')?.addEventListener('click', () => {
    if (isDesktop.matches) {
      toggleAllNavSections(navSections, false);
      overlay.classList.remove('show');
    }
  });

  // Close panels when clicking outside
  document.addEventListener('click', (e) => {
    const miniCartElement = document.querySelector('[data-block-name="commerce-mini-cart"]');
    const undoEnabled = miniCartElement
      && (miniCartElement.textContent?.includes('undo-remove-item')
        || miniCartElement.innerHTML?.includes('undo-remove-item'));

    const shouldCloseMiniCart = undoEnabled
      ? !minicartPanel?.contains(e.target)
        && !cartButton?.contains(e.target)
        && !e.target.closest('header')
      : !minicartPanel?.contains(e.target) && !cartButton?.contains(e.target);

    if (shouldCloseMiniCart) toggleMiniCart(false);

    if (!searchPanel?.contains(e.target) && !searchButton?.contains(e.target)) {
      toggleSearch(false);
    }
  });

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';

  // ✅ Insert the desktop-only locale topbar above the nav
  navWrapper.append(createLocaleTopBar());

  navWrapper.append(nav);
  block.append(navWrapper);

  navWrapper.addEventListener('mouseout', (e) => {
    if (isDesktop.matches && !nav.contains(e.relatedTarget)) {
      toggleAllNavSections(navSections, false);
      overlay.classList.remove('show');
    }
  });

  window.addEventListener('resize', () => {
    navWrapper.classList.remove('active');
    overlay.classList.remove('show');
    toggleMenu(nav, navSections, false);
  });

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;

  hamburger.addEventListener('click', () => {
    const next = nav.getAttribute('aria-expanded') !== 'true';
    navWrapper.classList.toggle('active', next);
    overlay.classList.toggle('show', next);
    toggleMenu(nav, navSections, next);
  });

  nav.prepend(hamburger);

  // Force initial state: collapsed everywhere
  toggleMenu(nav, navSections, false);

  // On breakpoint change: collapse (safe default)
  isDesktop.addEventListener('change', () => toggleMenu(nav, navSections, false));

  renderAuthCombine(
    navSections,
    () => !isDesktop.matches && toggleMenu(nav, navSections, false),
  );
  renderAuthDropdown(navTools);
}
