/**
 * Authorable block: reward-balance
 *
 * Optional authoring rows:
 * | reward-balance |
 * |---|
 * | title | Reward points |
 * | showMoney | true |
 */

const GRAPHQL_ENDPOINT =
  'https://na1-sandbox.api.commerce.adobe.com/GR9ME1ZbVW5pKKUTNwdvfE/graphql';

const DEFAULTS = {
  title: 'Reward points',
  showMoney: true,
};

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

function readBlockConfig(block) {
  const config = { ...DEFAULTS };
  const rows = [...block.querySelectorAll(':scope > div')];

  for (const row of rows) {
    const cols = [...row.children];
    if (cols.length < 2) continue;

    const key = (cols[0].textContent || '').trim();
    const val = (cols[1].textContent || '').trim();

    if (!key) continue;

    if (key === 'title') config.title = val || DEFAULTS.title;
    if (key === 'showMoney') config.showMoney = val.toLowerCase() !== 'false';
  }

  return config;
}

function getCookie(name) {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

function getCustomerToken() {
  // Adobe storefront auth drop-in cookie
  const cookieToken = getCookie('auth_dropin_user_token');
  if (cookieToken) return decodeURIComponent(cookieToken);

  // optional fallbacks if you store it elsewhere
  return (
    window.localStorage.getItem('auth_dropin_user_token') ||
    window.localStorage.getItem('customerToken') ||
    null
  );
}

async function fetchRewardsBalance(token) {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      // If your setup requires store headers, add them here, e.g.:
      // store: 'default',
      // 'magento-store-code': 'main_website_store',
    },
    body: JSON.stringify({ query: REWARDS_QUERY }),
    credentials: 'include',
  });

  const json = await res.json();

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join(' | '));
  }

  return json?.data?.customer?.reward_points?.balance ?? null;
}

function formatApproxMoney(balance) {
  const value = balance?.money?.value;
  const currency = balance?.money?.currency;
  if (value === undefined || value === null || !currency) return '';
  return `≈ ${value} ${currency}`;
}

export default async function decorate(block) {
  const cfg = readBlockConfig(block);

  // clear authored table content
  block.textContent = '';
  block.classList.add('reward-balance');

  const card = document.createElement('div');
  card.className = 'reward-balance__card';

  const title = document.createElement('div');
  title.className = 'reward-balance__title';
  title.textContent = cfg.title;

  const body = document.createElement('div');
  body.className = 'reward-balance__body';

  const status = document.createElement('div');
  status.className = 'reward-balance__status';
  status.textContent = 'Loading…';

  const points = document.createElement('div');
  points.className = 'reward-balance__points';

  const approx = document.createElement('div');
  approx.className = 'reward-balance__approx';

  body.append(status, points, approx);
  card.append(title, body);
  block.append(card);

  const token = getCustomerToken();
  if (!token) {
    status.textContent = 'Sign in to view your balance.';
    return;
  }

  try {
    const balance = await fetchRewardsBalance(token);

    if (!balance) {
      status.textContent = 'No reward points available.';
      return;
    }

    status.textContent = '';
    points.textContent = `${balance.points ?? 0} pts`;
    approx.textContent = cfg.showMoney ? formatApproxMoney(balance) : '';
  } catch (e) {
    status.textContent = 'Couldn’t load reward points.';
    // Uncomment for debugging:
    // approx.textContent = String(e.message || e);
  }
}
