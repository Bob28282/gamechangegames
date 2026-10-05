exports.handler = async function () {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/coins/dogwifcoin?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false"
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "CoinGecko API error",
          details: data
        })
      };
    }

    const market = data.market_data;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30"
      },
      body: JSON.stringify({
        name: data.name,
        symbol: data.symbol,

        price: market.current_price.usd,
        change24h: market.price_change_percentage_24h,

        marketCap: market.market_cap.usd,
        volume24h: market.total_volume.usd,

        high24h: market.high_24h.usd,
        low24h: market.low_24h.usd,

        chart: market.sparkline_7d?.price || [],

        updated: data.last_updated
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        error: "Unable to retrieve WIF data",
        details: error.message
      })
    };
  }
};
