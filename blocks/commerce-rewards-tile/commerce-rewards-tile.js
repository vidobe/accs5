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

const DEFAULTS = {
  title: 'Reward points',
  showMoney: true,
};

const readConfig = (block) => ([...block.querySelectorAll(':scope > div')]
  .map((row) => [...row.children])
  .filter((cols) => cols.length >= 2)
  .reduce((acc, cols) => {
    const key = (cols[0].textContent || '').trim();
    const val = (cols[1].textContent || '').trim();

    if (!key) return acc;

    if (key === 'title') return { ...acc, title: val || DEFAULTS.title };
    if (key === 'showMoney') return { ...acc, showMoney: val.toLowerCase() !== 'false' };

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

const fetchRewardsBalance = async (token) => {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: REWARDS_QUERY }),
    // Avoid credentials include (fixes your allow-credentials error)
    credentials: 'omit',
  });

  const json = await res.json();

  if (json.errors && json.errors.length) {
    throw new Error(json.errors.map((e) => e.message).join(' | '));
  }

  return (json.data
    && json.data.customer
    && json.data.customer.reward_points
    && json.data.customer.reward_points.balance)
    || null;
};

const formatApprox = (balance) => {
  const value = balance && balance.money && balance.money.value;
  const currency = balance && balance.money && balance.money.currency;

  if (value === undefined || value === null || !currency) return '';
  return `≈ ${value} ${currency}`;
};

const el = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
};

export default async function decorate(block) {
  const cfg = readConfig(block);

  block.textContent = '';
  block.classList.add('commerce-rewards-tile');

  const card = el('div', 'commerce-rewards-tile__card');
  const title = el('div', 'commerce-rewards-tile__title', cfg.title);

  const status = el('div', 'commerce-rewards-tile__status', 'Loading…');
  const points = el('div', 'commerce-rewards-tile__points', '');
  const approx = el('div', 'commerce-rewards-tile__approx', '');

  card.append(title, status, points, approx);
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
    points.textContent = `${balance.points || 0} pts`;
    approx.textContent = cfg.showMoney ? formatApprox(balance) : '';
  } catch (e) {
    status.textContent = 'Couldn’t load reward points.';
  }
}
