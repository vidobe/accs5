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
  title: 'Tokens',
  subtitleLoading: 'Loading…',
  subtitleSignedOut: 'Sign in to view your balance',
  subtitleNoBalance: 'No reward points available',
  subtitleError: 'Couldn’t load reward points',
  showMoney: true,
};

const readConfig = (block) => ([...block.querySelectorAll(':scope > div')]
  .map((row) => [...row.children])
  .filter((cols) => cols.length >= 2)
  .reduce((acc, cols) => {
    const key = (cols[0].textContent || '').trim();
    const val = (cols[1].textContent || '').trim();

    if (!key) {
      return acc;
    }

    if (key === 'title') {
      return { ...acc, title: val || DEFAULTS.title };
    }

    if (key === 'showMoney') {
      return { ...acc, showMoney: val.toLowerCase() !== 'false' };
    }

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

const formatSubtitle = (balance, showMoney) => {
  const points = (balance && balance.points) || 0;

  if (!showMoney) {
    return `${points} pts`;
  }

  const value = balance && balance.money && balance.money.value;
  const currency = balance && balance.money && balance.money.currency;
  const hasMoney = value !== undefined && value !== null && currency;

  if (hasMoney) {
    return `${points} pts (≈ ${value} ${currency})`;
  }

  return `${points} pts`;
};

const createPrizeIcon = () => {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false"><path fill="#f5c518" stroke="none" d="M12 2.5 L14.95 8.35 L21.4 9.25 L16.7 13.75 L17.9 20.15 L12 17 L6.1 20.15 L7.3 13.75 L2.6 9.25 L9.05 8.35 Z"/></svg>';
  return wrapper;
};

const findReturnsTile = () => {
  const leaf = [...document.querySelectorAll('*')]
    .filter((el) => el.childElementCount === 0)
    .find((el) => (el.textContent || '').trim() === 'Returns');

  return leaf ? leaf.closest('a') : null;
};

export default async function decorate(block) {
  const cfg = readConfig(block);

  block.textContent = '';
  block.classList.add('commerce-rewards-tile');

  const placeholder = document.createElement('div');
  placeholder.textContent = cfg.subtitleLoading;
  block.append(placeholder);

  const returnsTile = await new Promise((resolve) => {
    const start = Date.now();
    const maxMs = 8000;

    const tick = () => {
      const found = findReturnsTile();

      if (found) {
        resolve(found);
        return;
      }

      if (Date.now() - start > maxMs) {
        resolve(null);
        return;
      }

      window.setTimeout(tick, 200);
    };

    tick();
  });

  if (!returnsTile) {
    placeholder.textContent = 'Couldn’t find account tiles.';
    return;
  }

  const rewardsTile = returnsTile.cloneNode(true);
  rewardsTile.classList.add('commerce-rewards-tile--prize');
  rewardsTile.setAttribute('data-commerce-rewards-tile', 'true');
  rewardsTile.href = '/customer/reward-points';

  const existingIconSvg = rewardsTile.querySelector('svg');
  const newIconSvg = createPrizeIcon().querySelector('svg');

  if (existingIconSvg && newIconSvg) {
    existingIconSvg.replaceWith(newIconSvg);
  }

  const titleNode = [...rewardsTile.querySelectorAll('*')]
    .filter((el) => el.childElementCount === 0)
    .find((el) => (el.textContent || '').trim() === 'Returns');

  if (titleNode) {
    titleNode.textContent = cfg.title;
  }

  const leafs = [...rewardsTile.querySelectorAll('*')].filter((el) => el.childElementCount === 0);
  const titleIndex = titleNode ? leafs.indexOf(titleNode) : -1;
  const subtitleNode = titleIndex >= 0 ? leafs.slice(titleIndex + 1).find((n) => (n.textContent || '').trim().length) : null;

  if (subtitleNode) {
    subtitleNode.textContent = cfg.subtitleLoading;
  }

  returnsTile.insertAdjacentElement('afterend', rewardsTile);
  placeholder.remove();

  const token = getCustomerToken();

  if (!token) {
    if (subtitleNode) {
      subtitleNode.textContent = cfg.subtitleSignedOut;
    }
    return;
  }

  try {
    const balance = await fetchRewardsBalance(token);

    if (!balance) {
      if (subtitleNode) {
        subtitleNode.textContent = cfg.subtitleNoBalance;
      }
      return;
    }

    if (subtitleNode) {
      subtitleNode.textContent = formatSubtitle(balance, cfg.showMoney);
    }
  } catch (e) {
    if (subtitleNode) {
      subtitleNode.textContent = cfg.subtitleError;
    }
  }
}
