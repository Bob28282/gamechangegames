let cachedData = null;
let cachedAt = 0;

// Keep CoinGecko requests at most once every 30 seconds
const CACHE_TIME = 30000;

exports.handler = async function () {
  try {
    const now = Date.now();

    // Return cached data if it is still fresh
    if (cachedData && now - cachedAt < CACHE_TIME) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        },
        body: JSON.stringify(cachedData)
      };
    }

    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=dogwifcoin,bitcoin&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_24hr_high=true&include_24hr_low=true"
    );

    const data = await response.json();

    if (!response.ok) {
      // If CoinGecko temporarily rejects us,
      // return the previous successful data instead.
      if (cachedData) {
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
          },
          body: JSON.stringify(cachedData)
        };
      }

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

    if (!data.dogwifcoin || !data.bitcoin) {
      throw new Error("Missing crypto data from CoinGecko");
    }

    const wif = data.dogwifcoin;
    const btc = data.bitcoin;

    cachedData = {
      wif: {
        price: wif.usd,
        change24h: wif.usd_24h_change,
        marketCap: wif.usd_market_cap,
        volume24h: wif.usd_24h_vol,
        high24h: wif.usd_24h_high,
        low24h: wif.usd_24h_low,
        chart: []
      },

      bitcoin: {
        price: btc.usd,
        change24h: btc.usd_24h_change,
        marketCap: btc.usd_market_cap,
        volume24h: btc.usd_24h_vol,
        high24h: btc.usd_24h_high,
        low24h: btc.usd_24h_low
      }
    };

    cachedAt = now;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify(cachedData)
    };

  } catch (error) {
    console.error("Crypto function error:", error);

    // Use previous successful data if available
    if (cachedData) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        },
        body: JSON.stringify(cachedData)
      };
    }

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        error: "Unable to retrieve crypto data",
        details: error.message
      })
    };
  }
};
