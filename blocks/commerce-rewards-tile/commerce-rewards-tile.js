import {
  CORE_FETCH_GRAPHQL,
  checkIsAuthenticated,
  CUSTOMER_LOGIN_PATH,
  rootLink,
} from '../../scripts/commerce.js';

export default async function decorate(block) {
  if (!checkIsAuthenticated()) {
    window.location.href = rootLink(CUSTOMER_LOGIN_PATH);
    return;
  }

  // Create the tile container
  const tile = document.createElement('div');
  tile.classList.add('commerce-rewards-tile');

  // Loading state
  tile.innerHTML = `
    <div class="rewards-tile-loading">
      <p>Loading rewards points...</p>
    </div>
  `;

  block.innerHTML = '';
  block.appendChild(tile);

  try {
    // GraphQL query for customer reward points
    // Try multiple possible field names for reward points
    const query = `
      query {
        customer {
          reward_points {
            balance
            currency_amount
          }
          reward_points_balance {
            balance
            currency_amount
          }
        }
      }
    `;

    const response = await CORE_FETCH_GRAPHQL.query(query);

    const rewardData = response?.data?.customer?.reward_points ||
      response?.data?.customer?.reward_points_balance;

    if (rewardData) {
      const { balance, currency_amount: currencyAmount } = rewardData;

      tile.innerHTML = `
        <div class="rewards-tile-content">
          <h3>Rewards Points</h3>
          <div class="rewards-balance">
            <span class="balance-amount">${balance || 0}</span>
            <span class="balance-currency">${currencyAmount || ''}</span>
          </div>
          <p class="rewards-description">Earn more points with every purchase!</p>
        </div>
      `;
    } else {
      tile.innerHTML = `
        <div class="rewards-tile-content">
          <h3>Rewards Points</h3>
          <p>No rewards points available.</p>
        </div>
      `;
    }
  } catch (error) {
    tile.innerHTML = `
      <div class="rewards-tile-error">
        <p>Unable to load rewards points. Please try again later.</p>
      </div>
    `;
  }
}
