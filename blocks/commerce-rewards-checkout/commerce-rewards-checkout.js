const GRAPHQL_ENDPOINT = 'https://na1-sandbox.api.commerce.adobe.com/GR9ME1ZbVW5pKKUTNwdvfE/graphql';

const REWARDS_QUERY = `
  query RewardsBalance {
    customer {
      reward_points {
        balance {
          points
          money { value currency }
        }
      }
    }
  }
`;

// Common mutation names (depends on your Commerce version)
const APPLY_REWARDS_MUTATION = `
  mutation ApplyRewardPoints($cartId: String!) {
    applyRewardPointsToCart(cart_id: $cartId) {
      cart {
        id
      }
    }
  }
`;

const REMOVE_REWARDS_MUTATION = `
  mutation RemoveRewardPoints($cartId: String!) {
    removeRewardPointsFromCart(cart_id: $cartId) {
      cart {
        id
      }
    }
  }
`;

const DEFAULTS = {
  title: 'Prize Tokens',
  description: 'Use your prize tokens to reduce your order total.',
  applyLabel: 'Apply tokens',
  removeLabel: 'Remove tokens',
};

const readConfig = (block) => ([...block.querySelectorAll(':scope > div')]
  .map((row) => [...row.children])
  .filter((cols) => cols.length >= 2)
  .reduce((acc, cols) => {
    const key = (cols[0].textContent || '').trim();
    const val = (cols[1].textContent || '').trim();
    if (!key) return acc;

    if (key === 'title') return { ...acc, title: val || DEFAULTS.title };
    if (key === 'description') return { ...acc, description: val || DEFAULTS.description };
    if (key === 'applyLabel') return { ...acc, applyLabel: val || DEFAULTS.applyLabel };
    if (key === 'removeLabel') return { ...acc, removeLabel: val || DEFAULTS.removeLabel };

    return acc;
  }, { ...DEFAULTS }));

const getCookie = (name) => (document.cookie
  .split('; ')
  .map((c) => c.split('='))
  .filter((pair) => pair[0] === name)
  .map((pair) => pair.slice(1).join('='))
  .shift());

const getCustomerToken = () => {
  const cookieToken = getCookie('auth_dropin_user_token');
  const decodedCookie = cookieToken ? decodeURIComponent(cookieToken) : null;

  return decodedCookie
    || window.localStorage.getItem('auth_dropin_user_token')
    || window.localStorage.getItem('customerToken')
    || null;
};

// Best-effort cart id lookup for boilerplate/dev:
// adjust if you already know your cart id storage key
const getCartId = () => {
  const fromLs = window.localStorage.getItem('cartId')
    || window.localStorage.getItem('commerce_cart_id')
    || window.localStorage.getItem('cart_id');

  const fromSs = window.sessionStorage.getItem('cartId')
    || window.sessionStorage.getItem('commerce_cart_id')
    || window.sessionStorage.getItem('cart_id');

  const fromCookie = getCookie('cartId')
    || getCookie('commerce_cart_id')
    || getCookie('cart_id');

  return fromLs || fromSs || fromCookie || null;
};

const gql = async ({ query, variables, token }) => {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
    credentials: 'omit',
  });

  const json = await res.json();
  if (json.errors && json.errors.length) {
    throw new Error(json.errors.map((e) => e.message).join(' | '));
  }
  return json.data;
};

const createStarIcon = () => {
  const wrap = document.createElement('span');
  wrap.className = 'commerce-rewards-checkout__icon';
  wrap.innerHTML = `
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path fill="#f5c518" stroke="none"
        d="M12 2.5 L14.95 8.35 L21.4 9.25 L16.7 13.75 L17.9 20.15
           L12 17 L6.1 20.15 L7.3 13.75 L2.6 9.25 L9.05 8.35 Z"/>
    </svg>
  `;
  return wrap;
};

const formatBalanceLine = (balance) => {
  const pts = (balance && balance.points) || 0;
  const v = balance && balance.money && balance.money.value;
  const c = balance && balance.money && balance.money.currency;
  const hasMoney = v !== undefined && v !== null && c;
  return hasMoney ? `${pts} pts (≈ ${v} ${c}) available` : `${pts} pts available`;
};

export default async function decorate(block) {
  const cfg = readConfig(block);

  block.textContent = '';
  block.classList.add('commerce-rewards-checkout');

  const panel = document.createElement('div');
  panel.className = 'commerce-rewards-checkout__panel';

  const header = document.createElement('div');
  header.className = 'commerce-rewards-checkout__header';

  const title = document.createElement('div');
  title.className = 'commerce-rewards-checkout__title';
  title.textContent = cfg.title;

  header.append(createStarIcon(), title);

  const desc = document.createElement('div');
  desc.className = 'commerce-rewards-checkout__desc';
  desc.textContent = cfg.description;

  const status = document.createElement('div');
  status.className = 'commerce-rewards-checkout__status';
  status.textContent = 'Loading reward points…';

  const actions = document.createElement('div');
  actions.className = 'commerce-rewards-checkout__actions';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'commerce-rewards-checkout__button';
  btn.textContent = cfg.applyLabel;
  btn.disabled = true;

  actions.append(btn);
  panel.append(header, desc, status, actions);
  block.append(panel);

  const token = getCustomerToken();
  if (!token) {
    status.textContent = 'Sign in to use reward points.';
    return;
  }

  // Load balance to decide if button should be enabled
  let balance = null;
  try {
    const data = await gql({ query: REWARDS_QUERY, variables: {}, token });
    balance = data
      && data.customer
      && data.customer.reward_points
      && data.customer.reward_points.balance;

    if (!balance || !balance.points) {
      status.textContent = 'No reward points available.';
      return;
    }

    status.textContent = formatBalanceLine(balance);
    btn.disabled = false;
  } catch (e) {
    status.textContent = 'Couldn’t load reward points.';
    return;
  }

  // simple toggle state (per-session)
  const storageKey = 'rewards_applied';
  const applied = window.sessionStorage.getItem(storageKey) === 'true';
  btn.textContent = applied ? cfg.removeLabel : cfg.applyLabel;

  btn.addEventListener('click', async () => {
    const cartId = getCartId();
    if (!cartId) {
      status.textContent = 'Couldn’t find cart id (cart_id).';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Applying…';

    try {
      if (window.sessionStorage.getItem(storageKey) === 'true') {
        await gql({
          query: REMOVE_REWARDS_MUTATION,
          variables: { cartId },
          token,
        });
        window.sessionStorage.setItem(storageKey, 'false');
      } else {
        await gql({
          query: APPLY_REWARDS_MUTATION,
          variables: { cartId },
          token,
        });
        window.sessionStorage.setItem(storageKey, 'true');
      }

      // simplest reliable way to refresh totals and UI
      window.location.reload();
    } catch (e) {
      status.textContent = `Couldn’t apply reward points: ${String(e.message || e)}`;
      btn.disabled = false;
      btn.textContent = window.sessionStorage.getItem(storageKey) === 'true'
        ? cfg.removeLabel
        : cfg.applyLabel;
    }
  });
}
