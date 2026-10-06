exports.handler = async function () {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=dogwifcoin,bitcoin&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_24hr_high=true&include_24hr_low=true"
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        },
        body: JSON.stringify({
          error: "CoinGecko API error",
          details: data
        })
      };
    }

    if (!data.dogwifcoin || !data.bitcoin) {
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        },
        body: JSON.stringify({
          error: "Missing crypto data",
          details: data
        })
      };
    }

    const wif = data.dogwifcoin;
    const btc = data.bitcoin;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
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
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        error: "Unable to retrieve crypto data",
        details: error.message
      })
    };
  }
};
