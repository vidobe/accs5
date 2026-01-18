# Commerce Rewards Tile Block

Displays the customer's current rewards points balance on the account page.

## Usage

Add the block to your account page content:

```
commerce-rewards-tile
```

## Features

- Displays current rewards points balance
- Automatically redirects to login if user is not authenticated
- Handles loading and error states
- Uses GraphQL to fetch customer reward points data

## GraphQL Query

The block queries the customer's reward points using:

```graphql
query {
  customer {
    reward_points_balance {
      balance
      currency_amount
    }
  }
}
```

## Styling

The block uses CSS custom properties for consistent theming with the rest of the site.