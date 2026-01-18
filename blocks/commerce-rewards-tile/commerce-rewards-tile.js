import {
  CORE_FETCH_GRAPHQL,
  checkIsAuthenticated,
  CUSTOMER_LOGIN_PATH,
  rootLink,
} from '../../scripts/commerce.js';

export default async function decorate(block) {
  console.log('Rewards Tile: Block decoration started', block);

  if (!checkIsAuthenticated()) {
    console.log('Rewards Tile: User not authenticated, redirecting');
    window.location.href = rootLink(CUSTOMER_LOGIN_PATH);
    return;
  }

  console.log('Rewards Tile: User authenticated, proceeding with GraphQL call');

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

    console.log('Rewards Tile: About to make GraphQL query');
    const response = await CORE_FETCH_GRAPHQL.query(query);
    console.log('Rewards Tile: GraphQL response received', response);

    const rewardData = response?.data?.customer?.reward_points
      || response?.data?.customer?.reward_points_balance;

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
      console.log('Rewards Tile: Successfully displayed rewards data');
    } else {
      console.log('Rewards Tile: No reward data found in response');
      tile.innerHTML = `
        <div class="rewards-tile-content">
          <h3>Rewards Points</h3>
          <p>No rewards points available.</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Rewards Tile: Error fetching rewards points:', error);
    tile.innerHTML = `
      <div class="rewards-tile-error">
        <p>Unable to load rewards points. Please try again later.</p>
      </div>
    `;
  }
}
